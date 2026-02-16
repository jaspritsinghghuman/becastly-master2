import { prisma } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/crypto';
import axios from 'axios';
import { AISettings, AIProvider } from '@prisma/client';
import { AI_CONFIG, SYSTEM_PROMPTS } from './ai.config';

// OpenAI SDK (to be installed)
// import OpenAI from 'openai';

export interface AIResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: AIProvider;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ==================== AI PROVIDER SERVICE ====================

class AIService {
  private async getSettings(userId: string): Promise<AISettings | null> {
    return prisma.aISettings.findUnique({
      where: { userId },
    });
  }

  private async getOrCreateSettings(userId: string): Promise<AISettings> {
    let settings = await this.getSettings(userId);
    
    if (!settings) {
      settings = await prisma.aISettings.create({
        data: {
          userId,
          provider: AIProvider.OPENAI,
          openaiModel: AI_CONFIG.OPENAI_MODELS.GPT4_MINI,
        },
      });
    }
    
    return settings;
  }

  private async callOpenAI(
    messages: ChatMessage[],
    settings: AISettings
  ): Promise<AIResponse> {
    const apiKey = settings.openaiKey ? decrypt(settings.openaiKey) : process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: settings.openaiModel || AI_CONFIG.OPENAI_MODELS.GPT4_MINI,
          messages,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          top_p: AI_CONFIG.DEFAULTS.TOP_P,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;
      
      return {
        content: data.choices[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
        model: data.model,
        provider: AIProvider.OPENAI,
      };
    } catch (error: any) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      throw new Error(`OpenAI Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  private async callOllama(
    messages: ChatMessage[],
    settings: AISettings
  ): Promise<AIResponse> {
    const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
    const model = settings.ollamaModel || AI_CONFIG.OLLAMA_MODELS.LLAMA3;

    try {
      // Format messages for Ollama
      const prompt = this.formatMessagesForOllama(messages);
      
      const response = await axios.post(
        `${ollamaUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature: settings.temperature,
            num_predict: settings.maxTokens,
          },
        },
        {
          timeout: 60000, // 60 second timeout for local models
        }
      );

      const data = response.data;
      
      return {
        content: data.response || '',
        tokensUsed: data.eval_count || 0,
        model: model,
        provider: AIProvider.OLLAMA,
      };
    } catch (error: any) {
      console.error('Ollama API Error:', error.message);
      throw new Error(`Ollama Error: ${error.message}. Make sure Ollama is running at ${ollamaUrl}`);
    }
  }

  private formatMessagesForOllama(messages: ChatMessage[]): string {
    // Ollama uses a different format - convert chat messages to a single prompt
    let prompt = '';
    
    for (const msg of messages) {
      switch (msg.role) {
        case 'system':
          prompt += `System: ${msg.content}\n\n`;
          break;
        case 'user':
          prompt += `User: ${msg.content}\n`;
          break;
        case 'assistant':
          prompt += `Assistant: ${msg.content}\n`;
          break;
      }
    }
    
    prompt += 'Assistant:';
    return prompt;
  }

  async chat(
    userId: string,
    messages: ChatMessage[],
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    const settings = await this.getOrCreateSettings(userId);
    
    // Add system prompt if provided
    if (options?.systemPrompt) {
      messages = [
        { role: 'system', content: options.systemPrompt },
        ...messages,
      ];
    }

    // Override settings temporarily if provided
    if (options?.temperature !== undefined) {
      settings.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      settings.maxTokens = options.maxTokens;
    }

    // Call appropriate provider
    let response: AIResponse;
    
    switch (settings.provider) {
      case AIProvider.OPENAI:
        response = await this.callOpenAI(messages, settings);
        break;
      case AIProvider.OLLAMA:
        response = await this.callOllama(messages, settings);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${settings.provider}`);
    }

    // Track usage
    await this.trackUsage(userId, response.tokensUsed);

    return response;
  }

  async generateText(
    userId: string,
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    return this.chat(userId, messages, options);
  }

  private async trackUsage(userId: string, tokensUsed: number) {
    try {
      const now = new Date();
      
      await prisma.aISettings.updateMany({
        where: {
          userId,
          lastResetAt: {
            lt: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        },
        data: {
          monthlyTokensUsed: 0,
          lastResetAt: now,
        },
      });

      await prisma.aISettings.update({
        where: { userId },
        data: {
          monthlyTokensUsed: {
            increment: tokensUsed,
          },
        },
      });
    } catch (error) {
      console.error('Failed to track AI usage:', error);
    }
  }

  // ==================== SETTINGS MANAGEMENT ====================

  async getSettings(userId: string) {
    return this.getOrCreateSettings(userId);
  }

  async updateSettings(userId: string, data: {
    provider?: AIProvider;
    openaiKey?: string;
    openaiModel?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    enableLeadCapture?: boolean;
    enableLeadScoring?: boolean;
    enableWhatsAppAI?: boolean;
    enableVoiceAI?: boolean;
    enableAutoRevive?: boolean;
  }) {
    const updateData: any = { ...data };
    
    // Encrypt API key if provided
    if (data.openaiKey) {
      updateData.openaiKey = encrypt(data.openaiKey);
    } else {
      delete updateData.openaiKey;
    }

    return prisma.aISettings.update({
      where: { userId },
      data: updateData,
    });
  }

  async testConnection(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const settings = await this.getOrCreateSettings(userId);
      
      const testResponse = await this.generateText(
        userId,
        'Say "Connection successful" and nothing else.',
        { maxTokens: 20 }
      );

      if (testResponse.content.toLowerCase().includes('successful')) {
        return {
          success: true,
          message: `Connected successfully to ${settings.provider} (${testResponse.model})`,
        };
      }

      return {
        success: true,
        message: `Connection working but unexpected response: ${testResponse.content}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ==================== AI FEATURES ====================

  async generateMessageTemplate(
    userId: string,
    options: {
      category: 'WELCOME' | 'FOLLOW_UP' | 'PROMOTIONAL' | 'APPOINTMENT' | 'PAYMENT' | 'REVIVAL';
      channel: 'WHATSAPP' | 'EMAIL' | 'SMS';
      tone?: 'professional' | 'friendly' | 'casual' | 'urgent';
      productInfo?: string;
      targetAudience?: string;
    }
  ): Promise<AIResponse> {
    const { category, channel, tone = 'friendly', productInfo, targetAudience } = options;
    
    const prompt = `Create a ${tone} ${channel.toLowerCase()} message template for the ${category.toLowerCase().replace('_', ' ')} category.

${productInfo ? `Product/Service: ${productInfo}` : ''}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}

Requirements:
- Channel: ${channel} (${channel === 'WHATSAPP' ? 'concise, emoji-friendly' : channel === 'EMAIL' ? 'professional, can be longer' : 'very concise, under 160 chars'})
- Include placeholders like {name} for personalization
- Clear call-to-action
- ${AI_CONFIG.TEMPLATE_PROMPTS[category as keyof typeof AI_CONFIG.TEMPLATE_PROMPTS]}

Respond with only the message template, no extra text.`;

    return this.generateText(userId, prompt, {
      systemPrompt: SYSTEM_PROMPTS.EMAIL_COPYWRITER,
      temperature: 0.8,
    });
  }

  async improveMessage(
    userId: string,
    message: string,
    options?: {
      goal?: 'engagement' | 'conversion' | 'clarity';
      tone?: string;
    }
  ): Promise<AIResponse> {
    const prompt = `Improve the following message for better ${options?.goal || 'engagement'}:

Original: "${message}"

${options?.tone ? `Desired tone: ${options.tone}` : ''}

Provide 3 variations - one punchy, one detailed, one creative.`;

    return this.generateText(userId, prompt, {
      systemPrompt: SYSTEM_PROMPTS.EMAIL_COPYWRITER,
      temperature: 0.9,
    });
  }

  async analyzeIntent(
    userId: string,
    message: string
  ): Promise<{
    intent: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    urgency: 'low' | 'medium' | 'high';
    confidence: number;
  }> {
    const prompt = `${SYSTEM_PROMPTS.INTENT_DETECTION}

Message: "${message}"

Respond in this exact JSON format:
{
  "intent": "question|complaint|interest|purchase|unsubscribe|other",
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "confidence": 0.95
}`;

    try {
      const response = await this.generateText(userId, prompt, {
        temperature: 0.3,
        maxTokens: 200,
      });

      const parsed = JSON.parse(response.content);
      return {
        intent: parsed.intent || 'other',
        sentiment: parsed.sentiment || 'neutral',
        urgency: parsed.urgency || 'low',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('Intent analysis failed:', error);
      return {
        intent: 'other',
        sentiment: 'neutral',
        urgency: 'low',
        confidence: 0,
      };
    }
  }

  async generateFollowUpSequence(
    userId: string,
    options: {
      context: string;
      steps: number;
      interval: 'daily' | 'every2days' | 'weekly';
      goal: 'appointment' | 'sale' | 'response';
    }
  ): Promise<Array<{ day: number; subject?: string; message: string }>> {
    const { context, steps, interval, goal } = options;
    
    const intervalDays = interval === 'daily' ? 1 : interval === 'every2days' ? 2 : 7;
    
    const prompt = `Create a ${steps}-step follow-up email sequence.

Context: ${context}
Goal: ${goal}
Interval: ${interval}

Each email should build on the previous one. Include:
- Day number
- Subject line
- Email body (with {name} placeholder)

Make them progressively more urgent but always professional.

Respond in JSON format:
[
  { "day": 1, "subject": "...", "message": "..." },
  ...
]`;

    try {
      const response = await this.generateText(userId, prompt, {
        systemPrompt: SYSTEM_PROMPTS.EMAIL_COPYWRITER,
        temperature: 0.8,
        maxTokens: 2000,
      });

      const sequence = JSON.parse(response.content);
      return sequence.map((item: any, index: number) => ({
        day: (index + 1) * intervalDays,
        subject: item.subject,
        message: item.message,
      }));
    } catch (error) {
      console.error('Failed to generate sequence:', error);
      return [];
    }
  }
}

export const aiService = new AIService();
