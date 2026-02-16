import { prisma } from '../../lib/prisma';
import { aiService } from './ai.service';
import { leadScoringService } from './lead-scoring.service';
import { SYSTEM_PROMPTS, AI_CONFIG } from './ai.config';
import { Channel, ConversationStatus, SenderType, MessageDirection } from '@prisma/client';

export interface ConversationContext {
  contactName: string;
  previousPurchases: string[];
  interests: string[];
  lastInteraction?: string;
  notes: string;
}

class ConversationService {
  // ==================== CONVERSATION MANAGEMENT ====================

  async getOrCreateConversation(
    userId: string,
    contactId: string,
    channel: Channel
  ) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        userId,
        contactId,
        channel,
        status: ConversationStatus.ACTIVE,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: AI_CONFIG.CONVERSATION.MAX_HISTORY,
        },
        contact: true,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          contactId,
          channel,
          status: ConversationStatus.ACTIVE,
          aiEnabled: true,
        },
        include: {
          messages: true,
          contact: true,
        },
      });
    }

    return conversation;
  }

  async handleIncomingMessage(
    userId: string,
    contactId: string,
    channel: Channel,
    content: string,
    externalId?: string
  ) {
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(userId, contactId, channel);

    // Save incoming message
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        content,
        direction: MessageDirection.INBOUND,
        senderType: SenderType.CONTACT,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    // Update contact's last contact time
    await prisma.contact.update({
      where: { id: contactId },
      data: { lastContactAt: new Date() },
    });

    // Check if AI should respond
    if (conversation.aiEnabled) {
      return this.generateAIResponse(userId, conversation.id, content);
    }

    return { handled: true, aiResponse: null };
  }

  async generateAIResponse(
    userId: string,
    conversationId: string,
    incomingMessage: string
  ) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: AI_CONFIG.CONVERSATION.MAX_HISTORY,
          },
          contact: true,
          user: {
            include: { aiSettings: true },
          },
        },
      });

      if (!conversation || !conversation.user.aiSettings?.enableWhatsAppAI) {
        return { handled: false, reason: 'AI not enabled' };
      }

      // Check for handoff keywords
      const lowerMessage = incomingMessage.toLowerCase();
      for (const keyword of AI_CONFIG.CONVERSATION.HANDOFF_KEYWORDS) {
        if (lowerMessage.includes(keyword)) {
          await this.handoffToHuman(conversationId);
          return {
            handled: true,
            aiResponse: "I'll connect you with a human agent. Please hold on...",
            handoff: true,
          };
        }
      }

      // Analyze intent
      const intent = await aiService.analyzeIntent(userId, incomingMessage);

      // Build conversation context
      const context = this.buildContext(conversation);

      // Prepare messages for AI
      const messages = this.prepareMessages(context, conversation.messages, incomingMessage);

      // Generate response
      const aiResponse = await aiService.chat(userId, messages, {
        systemPrompt: SYSTEM_PROMPTS.WHATSAPP_ASSISTANT,
        temperature: 0.8,
        maxTokens: 300,
      });

      // Save AI response
      await prisma.chatMessage.create({
        data: {
          conversationId,
          content: aiResponse.content,
          direction: MessageDirection.OUTBOUND,
          senderType: SenderType.AI,
          aiGenerated: true,
          intent: intent.intent,
          sentiment: intent.sentiment,
        },
      });

      // Update conversation context
      await this.updateContext(conversationId, intent, incomingMessage);

      // Check for sales signals
      const saleSignals = AI_CONFIG.CONVERSATION.SALE_KEYWORDS;
      const isSalesIntent = saleSignals.some(k => lowerMessage.includes(k));

      if (isSalesIntent && intent.confidence > 0.7) {
        await this.handleSalesSignal(userId, conversation.contactId, intent);
      }

      // Re-score lead after interaction
      await leadScoringService.calculateScore(userId, conversation.contactId);

      return {
        handled: true,
        aiResponse: aiResponse.content,
        intent: intent.intent,
        sentiment: intent.sentiment,
        salesSignal: isSalesIntent,
      };
    } catch (error) {
      console.error('AI Response Generation Error:', error);
      return {
        handled: false,
        error: 'Failed to generate AI response',
      };
    }
  }

  private buildContext(conversation: any): ConversationContext {
    const contact = conversation.contact;
    const context: ConversationContext = {
      contactName: contact.name || 'there',
      previousPurchases: [],
      interests: contact.tags || [],
      notes: '',
    };

    // Parse existing context
    if (conversation.context) {
      try {
        const existing = JSON.parse(conversation.context);
        Object.assign(context, existing);
      } catch (e) {
        // Ignore parse errors
      }
    }

    return context;
  }

  private prepareMessages(
    context: ConversationContext,
    history: any[],
    incomingMessage: string
  ) {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add context as system message
    messages.push({
      role: 'system',
      content: `Contact Information:
Name: ${context.contactName}
Interests: ${context.interests.join(', ') || 'Not specified'}
${context.previousPurchases.length ? `Previous purchases: ${context.previousPurchases.join(', ')}` : ''}
${context.notes ? `Notes: ${context.notes}` : ''}`,
    });

    // Add conversation history
    for (const msg of history) {
      if (msg.senderType === 'CONTACT') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.senderType === 'AI') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Add incoming message
    messages.push({ role: 'user', content: incomingMessage });

    return messages;
  }

  private async updateContext(
    conversationId: string,
    intent: any,
    message: string
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return;

    let context: any = {};
    try {
      context = JSON.parse(conversation.context || '{}');
    } catch (e) {
      context = {};
    }

    // Update intent history
    context.lastIntent = intent.intent;
    context.intentHistory = context.intentHistory || [];
    context.intentHistory.push({
      intent: intent.intent,
      sentiment: intent.sentiment,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 10 intents
    context.intentHistory = context.intentHistory.slice(-10);

    // Track buying signals
    if (intent.intent === 'purchase' || intent.intent === 'interest') {
      context.buyingSignals = (context.buyingSignals || 0) + 1;
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        context: JSON.stringify(context),
      },
    });
  }

  private async handleSalesSignal(
    userId: string,
    contactId: string,
    intent: any
  ) {
    // Could trigger notifications, add to hot leads, etc.
    console.log(`Sales signal detected for contact ${contactId}:`, intent);
    
    // Update lead score to reflect high intent
    await prisma.leadScore.updateMany({
      where: { contactId },
      data: {
        intentScore: { increment: 20 },
      },
    });
  }

  async handoffToHuman(conversationId: string) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        aiEnabled: false,
        aiHandoffAt: new Date(),
        status: ConversationStatus.ACTIVE,
      },
    });

    // Create system message
    await prisma.chatMessage.create({
      data: {
        conversationId,
        content: 'Conversation handed over to human agent',
        direction: MessageDirection.OUTBOUND,
        senderType: SenderType.SYSTEM,
      },
    });
  }

  async resumeAI(conversationId: string) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        aiEnabled: true,
      },
    });
  }

  // ==================== CONVERSATION QUERIES ====================

  async getConversations(
    userId: string,
    options: {
      status?: ConversationStatus;
      channel?: Channel;
      aiEnabled?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, channel, aiEnabled, limit = 20, offset = 0 } = options;

    const where: any = { userId };
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (aiEnabled !== undefined) where.aiEnabled = aiEnabled;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getConversationMessages(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        contact: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return conversation;
  }

  async sendManualMessage(
    userId: string,
    conversationId: string,
    content: string
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Save message
    await prisma.chatMessage.create({
      data: {
        conversationId,
        content,
        direction: MessageDirection.OUTBOUND,
        senderType: SenderType.HUMAN,
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    // Actually send via appropriate channel
    // This would integrate with the message service
    return { success: true };
  }

  // ==================== ANALYTICS ====================

  async getConversationStats(userId: string) {
    const [
      totalConversations,
      activeConversations,
      aiHandledConversations,
      avgMessagesPerConversation,
    ] = await Promise.all([
      prisma.conversation.count({ where: { userId } }),
      prisma.conversation.count({ where: { userId, status: ConversationStatus.ACTIVE } }),
      prisma.conversation.count({ where: { userId, aiEnabled: true } }),
      prisma.conversation.aggregate({
        where: { userId },
        _avg: { messageCount: true },
      }),
    ]);

    return {
      total: totalConversations,
      active: activeConversations,
      aiHandled: aiHandledConversations,
      avgMessages: Math.round(avgMessagesPerConversation._avg.messageCount || 0),
    };
  }
}

export const conversationService = new ConversationService();
