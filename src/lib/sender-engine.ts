import { prisma } from './prisma';
import { addMessageJob, MessageJobData } from './queue';

type ComplianceOptions = {
  tenantId: string;
  userId: string;
  campaignId: string;
  channel: string;
  dailyLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
};

// Simple in-memory cooldown map (per worker instance)
const contactCooldowns = new Map<string, number>();

function getRandomDelay(minSeconds: number, maxSeconds: number) {
  const min = Math.max(0, minSeconds);
  const max = Math.max(min, maxSeconds);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export async function enqueueComplianceBatch(
  options: ComplianceOptions,
): Promise<{ queued: number }> {
  const { tenantId, userId, campaignId, channel, dailyLimit, minDelaySeconds, maxDelaySeconds } =
    options;

  // Fetch pending messages for this tenant/campaign
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId, userId },
  });

  if (!campaign || campaign.status !== 'RUNNING') {
    return { queued: 0 };
  }

  const remainingForDay = Math.max(0, dailyLimit - campaign.sentCount);
  if (remainingForDay <= 0) {
    return { queued: 0 };
  }

  const pendingMessages = await prisma.message.findMany({
    where: {
      tenantId,
      campaignId,
      status: { in: ['PENDING', 'QUEUED'] },
    },
    include: {
      contact: true,
    },
    orderBy: { id: 'asc' },
    take: remainingForDay,
  });

  if (pendingMessages.length === 0) {
    return { queued: 0 };
  }

  let accumulatedDelaySeconds = 0;
  let queued = 0;

  for (const message of pendingMessages) {
    const contactKey = `${tenantId}:${message.contactId}:${channel}`;
    const now = Date.now();
    const cooldownUntil = contactCooldowns.get(contactKey) || 0;

    // Simple per-contact cooldown: skip if still cooling down
    if (cooldownUntil > now) {
      continue;
    }

    const delay = getRandomDelay(minDelaySeconds, maxDelaySeconds);
    accumulatedDelaySeconds += delay;

    const jobData: MessageJobData = {
      messageId: message.id,
      campaignId,
      contactId: message.contactId,
      channel,
      content: message.content,
      userId,
    };

    await addMessageJob(jobData, accumulatedDelaySeconds);

    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'QUEUED' },
    });

    // Set a basic cooldown per contact (e.g., 5 minutes)
    const cooldownMs = 5 * 60 * 1000;
    contactCooldowns.set(contactKey, now + cooldownMs);
    queued++;
  }

  if (queued > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: { increment: queued },
      },
    });
  }

  return { queued };
}

