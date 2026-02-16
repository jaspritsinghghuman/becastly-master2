import { FastifyInstance } from 'fastify';
import { getApiKeys, createApiKey, revokeApiKey, createApiKeySchema } from './api-keys.service';
import { sendSingleMessage } from '../messages/messages.service';
import { z } from 'zod';
import { Channel } from '@prisma/client';

// Validation schema for single message
const sendMessageSchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'TELEGRAM', 'SMS']),
  to: z.string(),
  content: z.string().min(1),
  subject: z.string().optional(),
});

// Dashboard stats
async function getDashboardStats(userId: string) {
  const { prisma } = await import('../../lib/prisma');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  const [
    totalContacts,
    totalCampaigns,
    totalMessages,
    messagesSent,
    messagesDelivered,
    messagesFailed,
  ] = await Promise.all([
    prisma.contact.count({ where: { tenantId: user.tenantId, userId } }),
    prisma.campaign.count({ where: { tenantId: user.tenantId, userId } }),
    prisma.message.count({
      where: { tenantId: user.tenantId, campaign: { userId } },
    }),
    prisma.message.count({
      where: { tenantId: user.tenantId, campaign: { userId }, status: 'SENT' },
    }),
    prisma.message.count({
      where: { tenantId: user.tenantId, campaign: { userId }, status: 'DELIVERED' },
    }),
    prisma.message.count({
      where: { tenantId: user.tenantId, campaign: { userId }, status: 'FAILED' },
    }),
  ]);

  return {
    totalContacts,
    totalCampaigns,
    totalMessages,
    messagesSent,
    messagesDelivered,
    messagesFailed,
  };
}

export async function apiRoutes(fastify: FastifyInstance) {
  // API Key management (requires session auth)
  fastify.get('/keys', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const keys = await getApiKeys(userId);
      return reply.send({ success: true, keys });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  fastify.post('/keys', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const data = createApiKeySchema.parse(request.body);
      const result = await createApiKey(userId, data);
      return reply.code(201).send({
        success: true,
        apiKey: result.key, // Only returned once
        name: result.name,
        permissions: result.permissions,
      });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  fastify.delete('/keys/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      await revokeApiKey(userId, id);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Dashboard stats
  fastify.get('/stats', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const stats = await getDashboardStats(userId);
      return reply.send({ success: true, stats });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Public API endpoint - Send single message (requires API key)
  fastify.post('/messages/send', async (request, reply) => {
    const userId = (request as any).apiUser?.userId;
    const permissions = (request as any).apiUser?.permissions || [];
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const data = sendMessageSchema.parse(request.body);
      
      // Check permission
      const channel = data.channel.toLowerCase() as string;
      if (!permissions.includes(`send:${channel}`) && !permissions.includes('send:all')) {
        return reply.code(403).send({
          success: false,
          error: `No permission to send ${channel} messages`,
        });
      }

      const result = await sendSingleMessage(userId, {
        channel: data.channel as Channel,
        to: data.to,
        content: data.content,
        subject: data.subject,
      });

      return reply.send({
        success: result.success,
        externalId: result.externalId,
        error: result.error,
      });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
}
