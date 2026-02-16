import { FastifyInstance } from 'fastify';
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignStats,
  createCampaignSchema,
  updateCampaignSchema,
} from './campaigns.service';

export async function campaignsRoutes(fastify: FastifyInstance) {
  // Get all campaigns
  fastify.get('/', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { status, channel, page, limit } = request.query as any;

    try {
      const result = await getCampaigns(userId, {
        status,
        channel,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });

      return reply.send({ ...result, success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Get single campaign
  fastify.get('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const campaign = await getCampaign(userId, id);
      return reply.send({ success: true, campaign });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Create campaign
  fastify.post('/', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const data = createCampaignSchema.parse(request.body);
      const campaign = await createCampaign(userId, data);
      return reply.code(201).send({ success: true, campaign });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Update campaign
  fastify.put('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const data = updateCampaignSchema.parse(request.body);
      const campaign = await updateCampaign(userId, id, data);
      return reply.send({ success: true, campaign });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Delete campaign
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      await deleteCampaign(userId, id);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Start campaign
  fastify.post('/:id/start', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const result = await startCampaign(userId, id);
      return reply.send({ ...result, success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Pause campaign
  fastify.post('/:id/pause', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const result = await pauseCampaign(userId, id);
      return reply.send({ ...result, success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Resume campaign
  fastify.post('/:id/resume', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const result = await resumeCampaign(userId, id);
      return reply.send({ ...result, success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });

  // Get campaign stats
  fastify.get('/:id/stats', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const stats = await getCampaignStats(userId, id);
      return reply.send({ success: true, stats });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error?.message || 'Unknown error' });
    }
  });
}
