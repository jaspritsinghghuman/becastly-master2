import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

const redisUrl = config.redis.url || 'redis://localhost:6379';

// Create Redis connection
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Campaign Queue
export const campaignQueue = new Queue('campaign', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Message Queue for individual messages
export const messageQueue = new Queue('message', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 10000,
    },
    removeOnComplete: 500,
    removeOnFail: 100,
  },
});

// Webhook Queue for incoming webhooks
export const webhookQueue = new Queue('webhook', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export type CampaignJobData = {
  campaignId: string;
  userId: string;
};

export type MessageJobData = {
  messageId: string;
  campaignId: string;
  contactId: string;
  channel: string;
  content: string;
  userId: string;
};

export type WebhookJobData = {
  channel: string;
  event: string;
  payload: Record<string, any>;
};

export async function addCampaignJob(data: CampaignJobData, delay?: number) {
  return campaignQueue.add('process-campaign', data, {
    delay,
    jobId: data.campaignId,
  });
}

export async function addMessageJob(data: MessageJobData, delay: number) {
  return messageQueue.add('send-message', data, {
    delay: delay * 1000, // Convert to milliseconds
  });
}

export async function addWebhookJob(data: WebhookJobData) {
  return webhookQueue.add('process-webhook', data);
}

export async function closeQueues() {
  await campaignQueue.close();
  await messageQueue.close();
  await webhookQueue.close();
  await redisConnection.quit();
}

export { Queue, Worker, Job };
