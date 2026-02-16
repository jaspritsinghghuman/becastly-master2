import { prisma } from '../../lib/prisma';
import { addMessageJob } from '../../lib/queue';
import { aiService } from './ai.service';
import { Channel, DripStatus, DripMessageStatus, DripTrigger } from '@prisma/client';

export interface DripStep {
  delay: number;
  unit: 'minutes' | 'hours' | 'days';
  channel: Channel;
  template: string;
  subject?: string; // For email
  condition?: {
    type: 'opened' | 'replied' | 'clicked' | 'tag_added';
    value?: string;
  };
}

export interface CreateDripCampaignInput {
  name: string;
  description?: string;
  triggerType: DripTrigger;
  triggerTags: string[];
  steps: DripStep[];
  exitTags: string[];
  maxMessages: number;
}

class DripCampaignService {
  // ==================== CRUD OPERATIONS ====================

  async create(userId: string, input: CreateDripCampaignInput) {
    return prisma.dripCampaign.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerTags: input.triggerTags,
        steps: JSON.stringify(input.steps),
        exitTags: input.exitTags,
        maxMessages: input.maxMessages,
        status: DripStatus.DRAFT,
      },
    });
  }

  async update(userId: string, dripId: string, input: Partial<CreateDripCampaignInput>) {
    const drip = await prisma.dripCampaign.findFirst({
      where: { id: dripId, userId },
    });

    if (!drip) {
      throw new Error('Drip campaign not found');
    }

    if (drip.status === DripStatus.ACTIVE) {
      throw new Error('Cannot update an active drip campaign. Pause it first.');
    }

    const updateData: any = { ...input };
    if (input.steps) {
      updateData.steps = JSON.stringify(input.steps);
    }

    return prisma.dripCampaign.update({
      where: { id: dripId },
      data: updateData,
    });
  }

  async delete(userId: string, dripId: string) {
    const drip = await prisma.dripCampaign.findFirst({
      where: { id: dripId, userId },
    });

    if (!drip) {
      throw new Error('Drip campaign not found');
    }

    if (drip.status === DripStatus.ACTIVE) {
      throw new Error('Cannot delete an active drip campaign. Pause it first.');
    }

    // Delete associated messages
    await prisma.dripMessage.deleteMany({
      where: { dripCampaignId: dripId },
    });

    return prisma.dripCampaign.delete({
      where: { id: dripId },
    });
  }

  async getDripCampaigns(userId: string, options?: { status?: DripStatus }) {
    return prisma.dripCampaign.findMany({
      where: {
        userId,
        status: options?.status,
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDripCampaign(userId: string, dripId: string) {
    const drip = await prisma.dripCampaign.findFirst({
      where: { id: dripId, userId },
      include: {
        messages: {
          include: {
            contact: true,
          },
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });

    if (!drip) {
      throw new Error('Drip campaign not found');
    }

    return {
      ...drip,
      steps: JSON.parse(drip.steps as string),
    };
  }

  // ==================== ACTIVATION ====================

  async activate(userId: string, dripId: string) {
    const drip = await prisma.dripCampaign.findFirst({
      where: { id: dripId, userId },
    });

    if (!drip) {
      throw new Error('Drip campaign not found');
    }

    if (drip.status === DripStatus.ACTIVE) {
      throw new Error('Drip campaign is already active');
    }

    return prisma.dripCampaign.update({
      where: { id: dripId },
      data: { status: DripStatus.ACTIVE },
    });
  }

  async pause(userId: string, dripId: string) {
    const drip = await prisma.dripCampaign.findFirst({
      where: { id: dripId, userId },
    });

    if (!drip) {
      throw new Error('Drip campaign not found');
    }

    return prisma.dripCampaign.update({
      where: { id: dripId },
      data: { status: DripStatus.PAUSED },
    });
  }

  // ==================== TRIGGER HANDLING ====================

  async handleTrigger(
    userId: string,
    contactId: string,
    triggerType: DripTrigger,
    triggerData?: any
  ) {
    // Find active drip campaigns for this trigger
    const drips = await prisma.dripCampaign.findMany({
      where: {
        userId,
        status: DripStatus.ACTIVE,
        triggerType,
      },
    });

    for (const drip of drips) {
      // Check if contact matches trigger criteria
      const shouldTrigger = await this.shouldTriggerDrip(drip, contactId, triggerData);
      
      if (shouldTrigger) {
        await this.enrollContact(userId, drip.id, contactId);
      }
    }
  }

  private async shouldTriggerDrip(
    drip: any,
    contactId: string,
    triggerData?: any
  ): Promise<boolean> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) return false;

    // Check trigger tags
    if (drip.triggerTags.length > 0) {
      const hasTriggerTag = drip.triggerTags.some((tag: string) =>
        contact.tags.includes(tag)
      );
      if (!hasTriggerTag) return false;
    }

    // Check if already enrolled
    const existing = await prisma.dripMessage.findFirst({
      where: {
        dripCampaignId: drip.id,
        contactId,
      },
    });

    if (existing) return false;

    return true;
  }

  async enrollContact(userId: string, dripId: string, contactId: string) {
    const drip = await prisma.dripCampaign.findFirst({
      where: { id: dripId, userId },
    });

    if (!drip || drip.status !== DripStatus.ACTIVE) {
      throw new Error('Drip campaign not found or not active');
    }

    const steps: DripStep[] = JSON.parse(drip.steps as string);
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Schedule all messages
    let cumulativeDelay = 0;
    const now = new Date();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Calculate delay in milliseconds
      const delayMs = this.calculateDelay(step.delay, step.unit);
      cumulativeDelay += delayMs;
      
      const scheduledAt = new Date(now.getTime() + cumulativeDelay);

      // Process template variables
      const content = this.processTemplate(step.template, contact);

      await prisma.dripMessage.create({
        data: {
          dripCampaignId: dripId,
          contactId,
          stepIndex: i,
          scheduledAt,
          content,
          channel: step.channel,
          status: DripMessageStatus.SCHEDULED,
        },
      });
    }

    return { success: true, messagesScheduled: steps.length };
  }

  private calculateDelay(value: number, unit: string): number {
    const msPerUnit = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };
    return value * (msPerUnit[unit as keyof typeof msPerUnit] || msPerUnit.hours);
  }

  private processTemplate(template: string, contact: any): string {
    return template
      .replace(/\{name\}/g, contact.name || 'there')
      .replace(/\{email\}/g, contact.email || '')
      .replace(/\{phone\}/g, contact.phone || '');
  }

  // ==================== MESSAGE PROCESSING ====================

  async processScheduledMessages() {
    const now = new Date();
    
    const pendingMessages = await prisma.dripMessage.findMany({
      where: {
        status: DripMessageStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      include: {
        contact: true,
        dripCampaign: true,
      },
      take: 100,
    });

    for (const message of pendingMessages) {
      try {
        await this.sendDripMessage(message);
      } catch (error) {
        console.error(`Failed to send drip message ${message.id}:`, error);
        
        await prisma.dripMessage.update({
          where: { id: message.id },
          data: { status: DripMessageStatus.FAILED },
        });
      }
    }

    return { processed: pendingMessages.length };
  }

  private async sendDripMessage(message: any) {
    const { contact, dripCampaign } = message;

    // Check exit conditions
    const shouldExit = await this.checkExitConditions(dripCampaign, contact);
    if (shouldExit) {
      await prisma.dripMessage.update({
        where: { id: message.id },
        data: { status: DripMessageStatus.SKIPPED },
      });
      return;
    }

    // Check channel-specific field
    if (message.channel === Channel.WHATSAPP && !contact.phone) {
      throw new Error('Contact has no phone number');
    }
    if (message.channel === Channel.EMAIL && !contact.email) {
      throw new Error('Contact has no email');
    }

    // Send via appropriate channel
    // This would integrate with your existing message sending logic
    // For now, we'll mark as sent
    
    await prisma.dripMessage.update({
      where: { id: message.id },
      data: {
        status: DripMessageStatus.SENT,
        sentAt: new Date(),
      },
    });

    // Create analytics event
    await prisma.analyticsEvent.create({
      data: {
        userId: dripCampaign.userId,
        eventType: 'drip_message_sent',
        contactId: contact.id,
        channel: message.channel,
      },
    });
  }

  private async checkExitConditions(dripCampaign: any, contact: any): Promise<boolean> {
    // Check exit tags
    if (dripCampaign.exitTags.length > 0) {
      const hasExitTag = dripCampaign.exitTags.some((tag: string) =>
        contact.tags.includes(tag)
      );
      if (hasExitTag) return true;
    }

    // Check if contact is unsubscribed
    if (contact.status === 'UNSUBSCRIBED') return true;

    return false;
  }

  // ==================== AI-POWERED DRIPS ====================

  async generateAISteps(
    userId: string,
    options: {
      goal: 'nurture' | 'convert' | 'onboard' | 'revive';
      channel: Channel;
      steps: number;
      productInfo?: string;
    }
  ): Promise<DripStep[]> {
    const { goal, channel, steps, productInfo } = options;

    const prompt = `Create a ${steps}-step drip campaign sequence for ${goal}.

Channel: ${channel}
${productInfo ? `Product/Service: ${productInfo}` : ''}

For each step provide:
1. Delay (number and unit: minutes, hours, or days)
2. Message template with {name} placeholder
${channel === 'EMAIL' ? '3. Subject line' : ''}

Make each message progressively more engaging. First message should be soft introduction, last should have clear CTA.

Respond in JSON format:
[
  {
    "delay": 1,
    "unit": "days",
    "template": "Hi {name}, welcome..."
    ${channel === 'EMAIL' ? ', "subject": "Welcome..."' : ''}
  },
  ...
]`;

    try {
      const response = await aiService.generateText(userId, prompt, {
        temperature: 0.8,
        maxTokens: 2000,
      });

      const generatedSteps = JSON.parse(response.content);
      
      return generatedSteps.map((step: any) => ({
        delay: step.delay,
        unit: step.unit,
        channel: channel,
        template: step.template,
        subject: step.subject,
      }));
    } catch (error) {
      console.error('Failed to generate AI steps:', error);
      return this.getDefaultSteps(goal, channel);
    }
  }

  private getDefaultSteps(goal: string, channel: Channel): DripStep[] {
    const defaults: Record<string, DripStep[]> = {
      nurture: [
        { delay: 1, unit: 'days', channel, template: 'Hi {name}, thanks for connecting! Here\'s something valuable...' },
        { delay: 3, unit: 'days', channel, template: 'Hey {name}, quick question - what\'s your biggest challenge right now?' },
        { delay: 7, unit: 'days', channel, template: '{name}, I thought you might find this helpful...' },
      ],
      convert: [
        { delay: 1, unit: 'hours', channel, template: 'Hi {name}, saw you checked out our offer. Any questions?' },
        { delay: 2, unit: 'days', channel, template: '{name}, limited spots remaining. Interested?' },
        { delay: 5, unit: 'days', channel, template: 'Last chance {name} - offer expires tonight!' },
      ],
      onboard: [
        { delay: 1, unit: 'hours', channel, template: 'Welcome {name}! Here\'s how to get started...' },
        { delay: 1, unit: 'days', channel, template: 'Day 2 tip for you {name}...' },
        { delay: 3, unit: 'days', channel, template: 'How\'s it going {name}? Need help?' },
      ],
      revive: [
        { delay: 1, unit: 'days', channel, template: 'Hey {name}, we miss you! Here\'s what\'s new...' },
        { delay: 7, unit: 'days', channel, template: '{name}, exclusive comeback offer just for you!' },
      ],
    };

    return defaults[goal] || defaults.nurture;
  }

  // ==================== ANALYTICS ====================

  async getStats(userId: string, dripId: string) {
    const [total, sent, failed, scheduled] = await Promise.all([
      prisma.dripMessage.count({
        where: { dripCampaignId: dripId },
      }),
      prisma.dripMessage.count({
        where: { dripCampaignId: dripId, status: DripMessageStatus.SENT },
      }),
      prisma.dripMessage.count({
        where: { dripCampaignId: dripId, status: DripMessageStatus.FAILED },
      }),
      prisma.dripMessage.count({
        where: { dripCampaignId: dripId, status: DripMessageStatus.SCHEDULED },
      }),
    ]);

    return {
      total,
      sent,
      failed,
      scheduled,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    };
  }
}

export const dripCampaignService = new DripCampaignService();
