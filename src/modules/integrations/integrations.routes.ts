import { FastifyInstance } from 'fastify';
import {
  getIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  toggleIntegration,
  testIntegration,
  createIntegrationSchema,
} from './integrations.service';

export async function integrationsRoutes(fastify: FastifyInstance) {
  // Get all integrations
  fastify.get('/', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const integrations = await getIntegrations(userId);
      return reply.send({ success: true, integrations });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Get single integration
  fastify.get('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const integration = await getIntegration(userId, id);
      return reply.send({ success: true, integration });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Create integration
  fastify.post('/', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    try {
      const data = createIntegrationSchema.parse(request.body);
      const integration = await createIntegration(userId, data);
      return reply.code(201).send({ success: true, integration });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Update integration
  fastify.put('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const data = createIntegrationSchema.partial().parse(request.body);
      const integration = await updateIntegration(userId, id, data);
      return reply.send({ success: true, integration });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Delete integration
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      await deleteIntegration(userId, id);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Toggle integration status
  fastify.post('/:id/toggle', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const integration = await toggleIntegration(userId, id);
      return reply.send({ success: true, integration });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Test integration
  fastify.post('/:id/test', async (request, reply) => {
    const userId = (request as any).user?.id;
    
    if (!userId) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const result = await testIntegration(userId, id);
      return reply.send({ ...result });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
}
