import { prisma } from '../../lib/prisma';
import { addCampaignJob } from '../../lib/queue';
import { z } from 'zod';
import { Channel, ScheduleType, CampaignStatus } from '@prisma/client';

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['WHATSAPP', 'EMAIL', 'TELEGRAM', 'SMS']),
  template: z.string().min(1),
  subject: z.string().optional(),
  tagFilter: z.array(z.string()).default([]),
  scheduleType: z.enum(['IMMEDIATE', 'SCHEDULED']).default('IMMEDIATE'),
  scheduledAt: z.string().datetime().optional(),
  dailyLimit: z.number().int().min(1).default(50),
  minDelay: z.number().int().min(1).default(30),
  maxDelay: z.number().int().min(1).default(120),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export async function getCampaigns(userId: string, options: {
  status?: string;
  channel?: string;
  page?: number;
  limit?: number;
}) {
  const { status, channel, page = 1, limit = 20 } = options;

  const where: any = { userId };

  if (status) {
    where.status = status;
  }

  if (channel) {
    where.channel = channel;
  }

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    campaigns: campaigns.map(c => ({
      ...c,
      messageCount: c._count.messages,
      _count: undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
      messages: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const messageStats = {
    pending: campaign.messages.filter(m => m.status === 'PENDING').length,
    queued: campaign.messages.filter(m => m.status === 'QUEUED').length,
    sent: campaign.messages.filter(m => m.status === 'SENT').length,
    delivered: campaign.messages.filter(m => m.status === 'DELIVERED').length,
    failed: campaign.messages.filter(m => m.status === 'FAILED').length,
  };

  return {
    ...campaign,
    messageStats,
    messageCount: campaign._count.messages,
    _count: undefined,
    messages: undefined,
  };
}

export async function createCampaign(userId: string, data: CreateCampaignInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }
  // Validate template variables
  const variables = extractVariables(data.template);
  const validVariables = ['name', 'email', 'phone'];
  
  for (const v of variables) {
    if (!validVariables.includes(v)) {
      throw new Error(`Invalid template variable: {${v}}. Valid variables: {name}, {email}, {phone}`);
    }
  }

  // Validate email subject for email channel
  if (data.channel === 'EMAIL' && !data.subject) {
    throw new Error('Subject is required for email campaigns');
  }

  // Check for unsubscribe variable in email
  if (data.channel === 'EMAIL') {
    if (!data.template.includes('{{unsubscribe_url}}') && !data.template.includes('{unsubscribe_url}')) {
      throw new Error('Email template must contain {{unsubscribe_url}} variable');
    }
  }

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: user.tenantId,
      userId,
      name: data.name,
      channel: data.channel,
      template: data.template,
      subject: data.subject,
      tagFilter: data.tagFilter,
      scheduleType: data.scheduleType,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      dailyLimit: data.dailyLimit,
      minDelay: data.minDelay,
      maxDelay: data.maxDelay,
      status: data.scheduleType === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT',
    },
  });

  return campaign;
}

export async function updateCampaign(userId: string, campaignId: string, data: Partial<CreateCampaignInput>) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status === 'RUNNING') {
    throw new Error('Cannot update a running campaign');
  }

  const updateData: any = { ...data };
  
  if (data.scheduledAt) {
    updateData.scheduledAt = new Date(data.scheduledAt);
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: updateData,
  });
}

export async function deleteCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status === 'RUNNING') {
    throw new Error('Cannot delete a running campaign');
  }

  await prisma.campaign.delete({
    where: { id: campaignId },
  });

  return { success: true };
}

export async function startCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      user: true,
    },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status === 'RUNNING') {
    throw new Error('Campaign is already running');
  }

  if (campaign.status === 'COMPLETED') {
    throw new Error('Campaign is already completed');
  }

  // Get target contacts
  const where: any = { userId, status: 'ACTIVE' };
  
  if (campaign.tagFilter.length > 0) {
    where.tags = { hasSome: campaign.tagFilter };
  }

  // Validate channel-specific contact fields
  if (campaign.channel === 'WHATSAPP' || campaign.channel === 'SMS') {
    where.phone = { not: null };
  } else if (campaign.channel === 'EMAIL') {
    where.email = { not: null };
  } else if (campaign.channel === 'TELEGRAM') {
    where.telegramId = { not: null };
  }

  const contacts = await prisma.contact.findMany({
    where,
    select: { id: true },
  });

  if (contacts.length === 0) {
    throw new Error('No contacts found matching the criteria');
  }

  // Check integration
  const integration = await prisma.integration.findFirst({
    where: {
      userId,
      channel: campaign.channel,
      isActive: true,
    },
  });

  if (!integration) {
    throw new Error(`No active ${campaign.channel.toLowerCase()} integration found. Please configure it in settings.`);
  }

  // Create messages for all contacts
  await prisma.$transaction(async (tx) => {
    // Delete existing pending/queued messages
    await tx.message.deleteMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'QUEUED'] },
      },
    });

    // Create new messages
    await tx.message.createMany({
      data: contacts.map(contact => ({
        campaignId,
        contactId: contact.id,
        channel: campaign.channel,
        content: campaign.template,
        status: 'PENDING',
      })),
    });

    // Update campaign status
    await tx.campaign.update({
      where: { id: campaignId },
      data: { 
        status: 'RUNNING',
        sentCount: 0,
      },
    });
  });

  // Add to queue
  const delay = campaign.scheduleType === 'SCHEDULED' && campaign.scheduledAt
    ? Math.max(0, campaign.scheduledAt.getTime() - Date.now())
    : 0;

  await addCampaignJob({ campaignId, userId }, delay);

  return { 
    success: true, 
    message: `Campaign started with ${contacts.length} contacts`,
    totalContacts: contacts.length,
  };
}

export async function pauseCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status !== 'RUNNING') {
    throw new Error('Campaign is not running');
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'PAUSED' },
  });

  return { success: true, message: 'Campaign paused' };
}

export async function resumeCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status !== 'PAUSED') {
    throw new Error('Campaign is not paused');
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'RUNNING' },
  });

  await addCampaignJob({ campaignId, userId });

  return { success: true, message: 'Campaign resumed' };
}

export async function getCampaignStats(userId: string, campaignId: string) {
  const campaign = await getCampaign(userId, campaignId);
  return campaign.messageStats;
}

// Helper function to extract variables from template
function extractVariables(template: string): string[] {
  const matches = template.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  
  return matches
    .map(m => m.slice(1, -1)) // Remove { and }
    .filter((v, i, arr) => arr.indexOf(v) === i); // Unique
}
