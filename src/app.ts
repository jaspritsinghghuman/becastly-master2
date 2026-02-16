import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';
import { config } from './config';
import { planLimitMiddleware } from './middleware/planLimit.middleware';
import { verifyAccessToken } from './lib/jwt';
import { authRoutes } from './modules/auth/auth.routes';
import { contactsRoutes } from './modules/contacts/contacts.routes';
import { campaignsRoutes } from './modules/campaigns/campaigns.routes';
import { integrationsRoutes } from './modules/integrations/integrations.routes';
import { apiRoutes } from './modules/api/api.routes';
import { aiRoutes } from './modules/ai';
import { adminRoutes } from './modules/admin';
import { validateApiKey } from './lib/auth';

// Load environment variables
dotenv.config();

const app = Fastify({
  logger: true,
});

// Register plugins
async function registerPlugins() {
  // CORS
  await app.register(cors, {
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Cookie
  await app.register(cookie, {
    secret: process.env.ENCRYPTION_KEY || 'secret',
    parseOptions: {},
  });

  // Multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Tenant-aware logging
  app.addHook('onRequest', async (request) => {
    const user = (request as any).user;
    const apiUser = (request as any).apiUser;
    const tenantId = user?.tenantId || apiUser?.tenantId || 'public';
    (request as any).log = request.log.child({ tenantId });
  });
}

// Authentication middleware
async function setupAuth() {
  // Session auth hook
  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for public routes
    const publicRoutes = [
      '/auth/register',
      '/auth/login',
      '/auth/logout',
      '/health',
      '/webhooks/',
      '/ai/public/',
    ];

    const isPublic = publicRoutes.some(route => 
      request.url.startsWith(route)
    );

    if (isPublic) {
      return;
    }

    // Check for API key authentication
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // First try API key
      const validatedApiKey = await validateApiKey(token);
      if (validatedApiKey) {
        (request as any).apiUser = validatedApiKey;
        return;
      }

      // Then try JWT access token
      const claims = await verifyAccessToken(token);
      if (claims) {
        (request as any).user = {
          id: claims.sub,
          tenantId: claims.tenantId,
          plan: claims.plan,
          role: claims.role,
        };
        return;
      }
    }

    // No valid auth
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
    });
  });
}

// Register routes
async function registerRoutes() {
  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // Auth routes
  app.register(authRoutes, { prefix: '/auth' });

  // API routes (requires auth)
  app.register(contactsRoutes, { prefix: '/contacts' });
  app.register(campaignsRoutes, { prefix: '/campaigns' });
  app.register(integrationsRoutes, { prefix: '/integrations' });
  app.register(apiRoutes, { prefix: '/api/v1' });
  app.register(aiRoutes, { prefix: '/ai' });
  app.register(adminRoutes, { prefix: '/admin' });

  // Plan limits on sensitive endpoints (messages send + campaign start)
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url;
    const method = request.method;

    const isMessageSend =
      method === 'POST' && url.startsWith('/api/v1/messages/send');
    const isCampaignStart =
      method === 'POST' && url.includes('/campaigns') && url.endsWith('/start');

    if (isMessageSend || isCampaignStart) {
      await planLimitMiddleware(request, reply);
    }
  });

  // Webhooks (public, validated separately)
  app.register(async function (fastify) {
    // WhatsApp webhook verification
    fastify.get('/webhooks/whatsapp', async (request, reply) => {
      const mode = (request.query as any)['hub.mode'];
      const token = (request.query as any)['hub.verify_token'];
      const challenge = (request.query as any)['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.META_WEBHOOK_TOKEN) {
        console.log('[Webhook] WhatsApp webhook verified');
        return reply.send(challenge);
      }

      return reply.code(403).send('Forbidden');
    });

    // WhatsApp webhook events
    fastify.post('/webhooks/whatsapp', async (request, reply) => {
      const { addWebhookJob } = await import('./lib/queue');
      
      const body = request.body as any;
      
      if (body.entry) {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.value.messages) {
              for (const message of change.value.messages) {
                await addWebhookJob({
                  channel: 'WHATSAPP',
                  event: 'message_received',
                  payload: {
                    from: message.from,
                    text: message.text?.body || '',
                    messageId: message.id,
                  },
                });
              }
            }
            
            if (change.value.statuses) {
              for (const status of change.value.statuses) {
                await addWebhookJob({
                  channel: 'WHATSAPP',
                  event: 'message_status',
                  payload: {
                    messageId: status.id,
                    status: status.status,
                  },
                });
              }
            }
          }
        }
      }

      return reply.send({ status: 'ok' });
    });

    // Twilio webhook
    fastify.post('/webhooks/twilio', async (request, reply) => {
      const { addWebhookJob } = await import('./lib/queue');
      const body = request.body as any;

      if (body.MessageSid) {
        await addWebhookJob({
          channel: 'SMS',
          event: 'status_callback',
          payload: body,
        });
      }

      if (body.Body) {
        await addWebhookJob({
          channel: 'SMS',
          event: 'incoming_message',
          payload: {
            From: body.From,
            Body: body.Body,
          },
        });
      }

      return reply.send({ status: 'ok' });
    });

    // Telegram webhook
    fastify.post('/webhooks/telegram/:token', async (request, reply) => {
      const { token } = request.params as { token: string };
      
      if (token !== process.env.TELEGRAM_BOT_TOKEN) {
        return reply.code(403).send('Forbidden');
      }

      const { addWebhookJob } = await import('./lib/queue');
      const body = request.body as any;

      if (body.message) {
        await addWebhookJob({
          channel: 'TELEGRAM',
          event: 'message',
          payload: body,
        });
      }

      return reply.send({ status: 'ok' });
    });
  });
}

// Start server
async function start() {
  try {
    await registerPlugins();
    await setupAuth();
    await registerRoutes();

    const port = config.app.port;
    const host = '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
