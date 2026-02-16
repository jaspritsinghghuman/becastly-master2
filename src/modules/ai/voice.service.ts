import { prisma } from '../../lib/prisma';
import { aiService } from './ai.service';
import { Channel, CallStatus, CallOutcome } from '@prisma/client';

export interface VoiceCallOptions {
  phoneNumber: string;
  contactId?: string;
  script?: string;
  aiVoice?: string;
  scheduledAt?: Date;
}

class VoiceService {
  // OpenAI Realtime API configuration
  private readonly OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
  
  // Supported voices
  readonly AVAILABLE_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

  // ==================== CALL MANAGEMENT ====================

  async scheduleCall(userId: string, options: VoiceCallOptions) {
    const { phoneNumber, contactId, script, aiVoice = 'alloy', scheduledAt } = options;

    // Validate phone number format
    if (!this.isValidPhoneNumber(phoneNumber)) {
      throw new Error('Invalid phone number format. Use E.164 format (+1234567890)');
    }

    const call = await prisma.voiceCall.create({
      data: {
        userId,
        contactId: contactId || null,
        phoneNumber,
        script: script || (await this.generateDefaultScript(userId)),
        aiVoice,
        status: CallStatus.SCHEDULED,
        scheduledAt: scheduledAt || new Date(),
      },
    });

    return call;
  }

  async initiateCall(userId: string, callId: string) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, userId },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.status !== CallStatus.SCHEDULED) {
      throw new Error('Call is not in scheduled state');
    }

    // Update status to in progress
    await prisma.voiceCall.update({
      where: { id: callId },
      data: {
        status: CallStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    // This would integrate with a telephony provider like Twilio, Vonage, or OpenAI's Realtime API
    // For now, we'll simulate the call flow
    
    return {
      success: true,
      message: 'Call initiated',
      callId,
    };
  }

  async handleCallWebhook(userId: string, callId: string, event: string, data: any) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, userId },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    switch (event) {
      case 'call.answered':
        await this.handleCallAnswered(callId);
        break;
      
      case 'call.completed':
        await this.handleCallCompleted(callId, data);
        break;
      
      case 'call.failed':
        await this.handleCallFailed(callId, data);
        break;
      
      case 'speech.transcription':
        await this.handleTranscription(callId, data);
        break;
      
      case 'ai.response':
        await this.handleAIResponse(callId, data);
        break;
    }

    return { success: true };
  }

  private async handleCallAnswered(callId: string) {
    // Send initial greeting
    const call = await prisma.voiceCall.findUnique({
      where: { id: callId },
    });

    if (!call) return;

    // Generate AI greeting
    const greeting = await this.generateGreeting(call);
    
    // This would send the audio to the telephony provider
    console.log(`[Voice Call ${callId}] AI: ${greeting}`);
  }

  private async handleCallCompleted(callId: string, data: any) {
    const { duration, recordingUrl, transcript } = data;

    // Generate summary using AI
    let summary = null;
    let outcome = null;

    if (transcript) {
      const analysis = await this.analyzeCallTranscript(callId, transcript);
      summary = analysis.summary;
      outcome = analysis.outcome;
    }

    await prisma.voiceCall.update({
      where: { id: callId },
      data: {
        status: CallStatus.COMPLETED,
        endedAt: new Date(),
        duration,
        recordingUrl,
        transcript,
        summary,
        outcome: outcome as CallOutcome,
      },
    });

    // Create analytics event
    const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
    if (call) {
      await prisma.analyticsEvent.create({
        data: {
          userId: call.userId,
          eventType: 'call_completed',
          eventData: JSON.stringify({
            callId,
            duration,
            outcome,
          }),
        },
      });
    }
  }

  private async handleCallFailed(callId: string, data: any) {
    await prisma.voiceCall.update({
      where: { id: callId },
      data: {
        status: CallStatus.FAILED,
        endedAt: new Date(),
      },
    });
  }

  private async handleTranscription(callId: string, data: any) {
    const { text, isFinal } = data;

    if (isFinal) {
      // Process user's speech and generate AI response
      const response = await this.generateAIResponse(callId, text);
      
      // This would convert response to speech and send to telephony provider
      console.log(`[Voice Call ${callId}] User: ${text}`);
      console.log(`[Voice Call ${callId}] AI: ${response}`);
    }
  }

  private async handleAIResponse(callId: string, data: any) {
    // Handle AI-generated response (already converted to speech by telephony provider)
    console.log(`[Voice Call ${callId}] AI Response sent`);
  }

  // ==================== AI INTEGRATION ====================

  private async generateDefaultScript(userId: string): Promise<string> {
    return `You are a friendly sales representative. Your goal is to:
1. Introduce yourself and the company
2. Understand the prospect's needs
3. Qualify them (budget, timeline, decision-maker)
4. Schedule a demo or close the sale

Be conversational, listen more than you talk, and handle objections professionally.`;
  }

  private async generateGreeting(call: any): Promise<string> {
    const prompt = `Generate a warm, professional phone greeting. Keep it under 30 seconds when spoken.`;

    try {
      const response = await aiService.generateText(call.userId, prompt, {
        systemPrompt: call.script,
        temperature: 0.7,
        maxTokens: 150,
      });

      return response.content;
    } catch (error) {
      return "Hello! Thanks for taking my call. I'm calling from our company to see if you'd be interested in learning more about our services.";
    }
  }

  private async generateAIResponse(callId: string, userInput: string): Promise<string> {
    const call = await prisma.voiceCall.findUnique({
      where: { id: callId },
      include: { user: true },
    });

    if (!call) return "I apologize, but I'm having trouble understanding.";

    // Get conversation context (simplified)
    const context = `Previous conversation context: ${call.transcript || 'Just started'}`;

    const prompt = `${context}\n\nProspect just said: "${userInput}"\n\nHow should I respond? Keep it conversational and under 50 words.`;

    try {
      const response = await aiService.generateText(call.userId, prompt, {
        systemPrompt: call.script,
        temperature: 0.8,
        maxTokens: 200,
      });

      return response.content;
    } catch (error) {
      return "That's interesting. Could you tell me more about that?";
    }
  }

  private async analyzeCallTranscript(callId: string, transcript: string): Promise<{
    summary: string;
    outcome: string;
  }> {
    const call = await prisma.voiceCall.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return { summary: '', outcome: 'NOT_QUALIFIED' };
    }

    const prompt = `Analyze this sales call transcript and provide:
1. A brief summary (2-3 sentences)
2. The outcome classification

Transcript:
${transcript}

Respond in JSON format:
{
  "summary": "brief summary",
  "outcome": "QUALIFIED|NOT_QUALIFIED|CALLBACK|NO_INTEREST|APPOINTMENT_SET|SALE"
}`;

    try {
      const response = await aiService.generateText(call.userId, prompt, {
        temperature: 0.5,
        maxTokens: 300,
      });

      return JSON.parse(response.content);
    } catch (error) {
      return {
        summary: 'Call completed',
        outcome: 'NOT_QUALIFIED',
      };
    }
  }

  // ==================== CALL QUERIES ====================

  async getCalls(userId: string, options?: {
    status?: CallStatus;
    limit?: number;
    offset?: number;
  }) {
    const { status, limit = 20, offset = 0 } = options || {};

    const where: any = { userId };
    if (status) where.status = status;

    const [calls, total] = await Promise.all([
      prisma.voiceCall.findMany({
        where,
        include: {
          contact: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.voiceCall.count({ where }),
    ]);

    return {
      calls,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getCall(userId: string, callId: string) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, userId },
      include: {
        contact: true,
      },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    return call;
  }

  async cancelCall(userId: string, callId: string) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, userId },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.status !== CallStatus.SCHEDULED) {
      throw new Error('Can only cancel scheduled calls');
    }

    return prisma.voiceCall.delete({
      where: { id: callId },
    });
  }

  // ==================== BULK OPERATIONS ====================

  async scheduleBulkCalls(
    userId: string,
    contactIds: string[],
    options: {
      script?: string;
      aiVoice?: string;
      scheduledAt?: Date;
    }
  ) {
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        userId,
        phone: { not: null },
      },
    });

    const calls = [];
    for (const contact of contacts) {
      const call = await this.scheduleCall(userId, {
        phoneNumber: contact.phone!,
        contactId: contact.id,
        script: options.script,
        aiVoice: options.aiVoice,
        scheduledAt: options.scheduledAt,
      });
      calls.push(call);
    }

    return {
      scheduled: calls.length,
      skipped: contactIds.length - contacts.length,
      calls,
    };
  }

  // ==================== ANALYTICS ====================

  async getCallStats(userId: string) {
    const [
      totalCalls,
      completedCalls,
      failedCalls,
      avgDuration,
      outcomes,
    ] = await Promise.all([
      prisma.voiceCall.count({ where: { userId } }),
      prisma.voiceCall.count({ where: { userId, status: CallStatus.COMPLETED } }),
      prisma.voiceCall.count({ where: { userId, status: CallStatus.FAILED } }),
      prisma.voiceCall.aggregate({
        where: { userId, status: CallStatus.COMPLETED },
        _avg: { duration: true },
      }),
      prisma.voiceCall.groupBy({
        by: ['outcome'],
        where: { userId, status: CallStatus.COMPLETED },
        _count: { outcome: true },
      }),
    ]);

    return {
      total: totalCalls,
      completed: completedCalls,
      failed: failedCalls,
      successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
      avgDuration: Math.round(avgDuration._avg.duration || 0),
      outcomes: outcomes.reduce((acc: any, o: any) => {
        acc[o.outcome || 'UNKNOWN'] = o._count.outcome;
        return acc;
      }, {}),
    };
  }

  // ==================== HELPERS ====================

  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format validation
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }
}

export const voiceService = new VoiceService();
