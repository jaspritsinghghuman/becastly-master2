import { Worker, Job } from 'bullmq';
import { redisConnection, MessageJobData } from '../lib/queue';
import { prisma } from '../lib/prisma';
import { processMessage } from '../modules/messages/messages.service';
import { enqueueComplianceBatch } from '../lib/sender-engine';

// Campaign processor - queues individual messages
async function processCampaign(job: Job<{ campaignId: string; userId: string }>) {
  const { campaignId, userId } = job.data;

  console.log(`[Campaign Worker] Processing campaign ${campaignId}`);

  // Get campaign details
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status !== 'RUNNING') {
    console.log(`[Campaign Worker] Campaign ${campaignId} is not running (${campaign.status})`);
    return;
  }

  const { queued } = await enqueueComplianceBatch({
    tenantId: campaign.tenantId,
    userId,
    campaignId,
    channel: campaign.channel,
    dailyLimit: campaign.dailyLimit,
    minDelaySeconds: campaign.minDelay,
    maxDelaySeconds: campaign.maxDelay,
  });

  // Check if we need to schedule next batch
  const remainingMessages = await prisma.message.count({
    where: {
      campaignId,
      status: 'PENDING',
    },
  });

  if (remainingMessages > 0 && campaign.status === 'RUNNING') {
    // Schedule next batch for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const { addCampaignJob } = await import('../lib/queue');
    await addCampaignJob({ campaignId, userId }, tomorrow.getTime() - Date.now());
    
    // Reset sent count for next day
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentCount: 0 },
    });

    console.log(`[Campaign Worker] Scheduled next batch for ${tomorrow}`);
  }

  return { processed: pendingMessages.length, nextBatch: remainingMessages > 0 };
}

// Message processor - sends individual messages
async function processMessageJob(job: Job<MessageJobData>) {
  const { messageId, campaignId } = job.data;

  console.log(`[Message Worker] Sending message ${messageId}`);

  try {
    // Check if campaign is still running
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.status !== 'RUNNING') {
      console.log(`[Message Worker] Campaign ${campaignId} not running, skipping message ${messageId}`);
      return;
    }

    await processMessage(messageId);
  } catch (error: any) {
    console.error(`[Message Worker] Error sending message ${messageId}:`, error.message);
    
    // Update message as failed
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        failedAt: new Date(),
      },
    });

    throw error;
  }
}

// Webhook processor - handles incoming webhooks
async function processWebhook(job: Job<any>) {
  const { channel, event, payload } = job.data;

  console.log(`[Webhook Worker] Processing ${channel} ${event}`);

  try {
    switch (channel) {
      case 'WHATSAPP':
        await handleWhatsAppWebhook(event, payload);
        break;
      case 'EMAIL':
        // Handle email webhooks (deliverability, bounces)
        break;
      case 'SMS':
        await handleSMSWebhook(event, payload);
        break;
      case 'TELEGRAM':
        await handleTelegramWebhook(event, payload);
        break;
    }
  } catch (error: any) {
    console.error(`[Webhook Worker] Error processing webhook:`, error.message);
    throw error;
  }
}

async function handleWhatsAppWebhook(event: string, payload: any) {
  if (event === 'message_status') {
    const { messageId, status } = payload;
    
    await prisma.message.updateMany({
      where: { externalId: messageId },
      data: {
        status: status === 'delivered' ? 'DELIVERED' : status === 'failed' ? 'FAILED' : undefined,
        deliveredAt: status === 'delivered' ? new Date() : undefined,
      },
    });
  } else if (event === 'message_received') {
    // Handle incoming message (reply)
    const { from, text } = payload;
    
    // Check for unsubscribe keywords
    const unsubscribeKeywords = ['stop', 'unsubscribe', 'cancel'];
    if (unsubscribeKeywords.some(kw => text.toLowerCase().includes(kw))) {
      // Find contact and unsubscribe
      await prisma.contact.updateMany({
        where: { phone: from },
        data: { status: 'UNSUBSCRIBED' },
      });
    }
  }
}

async function handleSMSWebhook(event: string, payload: any) {
  if (event === 'status_callback') {
    const { MessageSid, MessageStatus } = payload;
    
    await prisma.message.updateMany({
      where: { externalId: MessageSid },
      data: {
        status: MessageStatus === 'delivered' ? 'DELIVERED' : 
                MessageStatus === 'failed' ? 'FAILED' : undefined,
        deliveredAt: MessageStatus === 'delivered' ? new Date() : undefined,
      },
    });
  } else if (event === 'incoming_message') {
    const { From, Body } = payload;
    
    // Check for unsubscribe
    if (Body.toLowerCase().includes('stop')) {
      await prisma.contact.updateMany({
        where: { phone: From },
        data: { status: 'UNSUBSCRIBED' },
      });
    }
  }
}

async function handleTelegramWebhook(event: string, payload: any) {
  if (event === 'message') {
    const { message } = payload;
    const chatId = message.chat.id;
    const text = message.text;

    // Handle /start command to capture chat_id
    if (text === '/start') {
      // The chat_id can be stored for future messages
      console.log(`[Webhook] Telegram user ${chatId} started bot`);
    }

    // Check for unsubscribe
    const unsubscribeKeywords = ['stop', 'unsubscribe', '/stop'];
    if (unsubscribeKeywords.some(kw => text.toLowerCase().includes(kw))) {
      await prisma.contact.updateMany({
        where: { telegramId: String(chatId) },
        data: { status: 'UNSUBSCRIBED' },
      });
    }
  }
}

// Create workers
const campaignWorker = new Worker('campaign', processCampaign, {
  connection: redisConnection,
  concurrency: 5,
});

const messageWorker = new Worker('message', processMessageJob, {
  connection: redisConnection,
  concurrency: 10,
});

const webhookWorker = new Worker('webhook', processWebhook, {
  connection: redisConnection,
  concurrency: 20,
});

// Event handlers
campaignWorker.on('completed', (job) => {
  console.log(`[Campaign Worker] Job ${job.id} completed`);
});

campaignWorker.on('failed', (job, err) => {
  console.error(`[Campaign Worker] Job ${job?.id} failed:`, err.message);
});

messageWorker.on('completed', (job) => {
  console.log(`[Message Worker] Job ${job.id} completed`);
});

messageWorker.on('failed', (job, err) => {
  console.error(`[Message Worker] Job ${job?.id} failed:`, err.message);
});

webhookWorker.on('completed', (job) => {
  console.log(`[Webhook Worker] Job ${job.id} completed`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`[Webhook Worker] Job ${job?.id} failed:`, err.message);
});

console.log('[Workers] Campaign, Message, and Webhook workers started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Workers] Shutting down...');
  await campaignWorker.close();
  await messageWorker.close();
  await webhookWorker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Workers] Shutting down...');
  await campaignWorker.close();
  await messageWorker.close();
  await webhookWorker.close();
  await redisConnection.quit();
  process.exit(0);
});
