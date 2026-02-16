import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiService } from './ai.service';
import { leadScoringService } from './lead-scoring.service';
import { conversationService } from './conversation.service';
import { dripCampaignService } from './drip-campaigns.service';
import { leadCaptureService } from './lead-capture.service';
import { voiceService } from './voice.service';
import { paymentBotService } from './payment-bot.service';
import { analyticsService } from './analytics.service';
import { AIProvider, LeadTier, DripTrigger, DripStatus } from '@prisma/client';

// ==================== VALIDATION SCHEMAS ====================

const updateAISettingsSchema = z.object({
  provider: z.enum(['OPENAI', 'OLLAMA', 'ANTHROPIC', 'CUSTOM']).optional(),
  openaiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  systemPrompt: z.string().optional(),
  enableLeadCapture: z.boolean().optional(),
  enableLeadScoring: z.boolean().optional(),
  enableWhatsAppAI: z.boolean().optional(),
  enableVoiceAI: z.boolean().optional(),
  enableAutoRevive: z.boolean().optional(),
});

const generateTemplateSchema = z.object({
  category: z.enum(['WELCOME', 'FOLLOW_UP', 'PROMOTIONAL', 'APPOINTMENT', 'PAYMENT', 'REVIVAL']),
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']),
  tone: z.enum(['professional', 'friendly', 'casual', 'urgent']).optional(),
  productInfo: z.string().optional(),
  targetAudience: z.string().optional(),
});

const improveMessageSchema = z.object({
  message: z.string(),
  goal: z.enum(['engagement', 'conversion', 'clarity']).optional(),
  tone: z.string().optional(),
});

const createDripCampaignSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  triggerType: z.enum(['MANUAL', 'TAG_ADDED', 'FORM_SUBMITTED', 'LEAD_SCORE']),
  triggerTags: z.array(z.string()).default([]),
  steps: z.array(z.object({
    delay: z.number(),
    unit: z.enum(['minutes', 'hours', 'days']),
    channel: z.enum(['WHATSAPP', 'EMAIL', 'TELEGRAM', 'SMS']),
    template: z.string(),
    subject: z.string().optional(),
  })),
  exitTags: z.array(z.string()).default([]),
  maxMessages: z.number().default(10),
});

const createLeadFormSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    id: z.string(),
    type: z.enum(['text', 'email', 'phone', 'select', 'textarea', 'checkbox']),
    label: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
  })),
  aiEnabled: z.boolean().default(true),
  aiPrompt: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  webhookUrl: z.string().optional(),
  redirectUrl: z.string().optional(),
});

const scheduleCallSchema = z.object({
  contactId: z.string(),
  script: z.string().optional(),
  aiVoice: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

const createPaymentIntentSchema = z.object({
  contactId: z.string(),
  amount: z.number(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
});

// ==================== ROUTES ====================

export async function aiRoutes(fastify: FastifyInstance) {
  // ==================== AI SETTINGS ====================

  // Get AI settings
  fastify.get('/settings', async (request, reply) => {
    const userId = (request as any).user.id;
    const settings = await aiService.getSettings(userId);
    return { success: true, settings };
  });

  // Update AI settings
  fastify.patch('/settings', async (request, reply) => {
    const userId = (request as any).user.id;
    const data = updateAISettingsSchema.parse(request.body);
    
    const settings = await aiService.updateSettings(userId, data);
    return { success: true, settings };
  });

  // Test AI connection
  fastify.post('/settings/test', async (request, reply) => {
    const userId = (request as any).user.id;
    const result = await aiService.testConnection(userId);
    return result;
  });

  // ==================== AI GENERATION ====================

  // Generate message template
  fastify.post('/generate-template', async (request, reply) => {
    const userId = (request as any).user.id;
    const options = generateTemplateSchema.parse(request.body);
    
    const result = await aiService.generateMessageTemplate(userId, options);
    return { success: true, result };
  });

  // Improve existing message
  fastify.post('/improve-message', async (request, reply) => {
    const userId = (request as any).user.id;
    const { message, goal, tone } = improveMessageSchema.parse(request.body);
    
    const result = await aiService.improveMessage(userId, message, { goal, tone });
    return { success: true, result };
  });

  // Generate follow-up sequence
  fastify.post('/generate-sequence', async (request, reply) => {
    const userId = (request as any).user.id;
    const { context, steps, interval, goal } = request.body as any;
    
    const sequence = await aiService.generateFollowUpSequence(userId, {
      context,
      steps,
      interval,
      goal,
    });
    
    return { success: true, sequence };
  });

  // Analyze text intent
  fastify.post('/analyze-intent', async (request, reply) => {
    const userId = (request as any).user.id;
    const { text } = request.body as { text: string };
    
    const intent = await aiService.analyzeIntent(userId, text);
    return { success: true, intent };
  });

  // ==================== LEAD SCORING ====================

  // Calculate score for a contact
  fastify.post('/leads/:contactId/score', async (request, reply) => {
    const userId = (request as any).user.id;
    const { contactId } = request.params as { contactId: string };
    
    const score = await leadScoringService.calculateScore(userId, contactId);
    return { success: true, score };
  });

  // Score all leads
  fastify.post('/leads/score-all', async (request, reply) => {
    const userId = (request as any).user.id;
    
    const result = await leadScoringService.scoreAllLeads(userId);
    return { success: true, result };
  });

  // Get scored leads
  fastify.get('/leads', async (request, reply) => {
    const userId = (request as any).user.id;
    const { tier, minScore, maxScore, limit, offset } = request.query as any;
    
    const leads = await leadScoringService.getScoredLeads(userId, {
      tier: tier as LeadTier,
      minScore: minScore ? parseInt(minScore) : undefined,
      maxScore: maxScore ? parseInt(maxScore) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    
    return { success: true, ...leads };
  });

  // Get score distribution
  fastify.get('/leads/distribution', async (request, reply) => {
    const userId = (request as any).user.id;
    const distribution = await leadScoringService.getScoreDistribution(userId);
    return { success: true, distribution };
  });

  // Get high value leads
  fastify.get('/leads/high-value', async (request, reply) => {
    const userId = (request as any).user.id;
    const { limit } = request.query as { limit?: string };
    
    const leads = await leadScoringService.getHighValueLeads(
      userId,
      limit ? parseInt(limit) : 10
    );
    return { success: true, leads };
  });

  // ==================== CONVERSATIONS (WHATSAPP AI) ====================

  // Get conversations
  fastify.get('/conversations', async (request, reply) => {
    const userId = (request as any).user.id;
    const { status, channel, aiEnabled, limit, offset } = request.query as any;
    
    const conversations = await conversationService.getConversations(userId, {
      status,
      channel,
      aiEnabled: aiEnabled === 'true',
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });
    
    return { success: true, ...conversations };
  });

  // Get conversation messages
  fastify.get('/conversations/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const conversation = await conversationService.getConversationMessages(id, userId);
    return { success: true, conversation };
  });

  // Send manual message in conversation
  fastify.post('/conversations/:id/message', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    
    await conversationService.sendManualMessage(userId, id, content);
    return { success: true, message: 'Message sent' };
  });

  // Handoff to human
  fastify.post('/conversations/:id/handoff', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await conversationService.handoffToHuman(id);
    return { success: true, message: 'Handed off to human' };
  });

  // Resume AI
  fastify.post('/conversations/:id/resume-ai', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await conversationService.resumeAI(id);
    return { success: true, message: 'AI resumed' };
  });

  // Get conversation stats
  fastify.get('/conversations/stats', async (request, reply) => {
    const userId = (request as any).user.id;
    const stats = await conversationService.getConversationStats(userId);
    return { success: true, stats };
  });

  // ==================== DRIP CAMPAIGNS ====================

  // Create drip campaign
  fastify.post('/drip-campaigns', async (request, reply) => {
    const userId = (request as any).user.id;
    const data = createDripCampaignSchema.parse(request.body);
    
    const campaign = await dripCampaignService.create(userId, data);
    return { success: true, campaign };
  });

  // Get drip campaigns
  fastify.get('/drip-campaigns', async (request, reply) => {
    const userId = (request as any).user.id;
    const { status } = request.query as { status?: DripStatus };
    
    const campaigns = await dripCampaignService.getDripCampaigns(userId, { status });
    return { success: true, campaigns };
  });

  // Get drip campaign
  fastify.get('/drip-campaigns/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const campaign = await dripCampaignService.getDripCampaign(userId, id);
    return { success: true, campaign };
  });

  // Update drip campaign
  fastify.patch('/drip-campaigns/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const campaign = await dripCampaignService.update(userId, id, request.body as any);
    return { success: true, campaign };
  });

  // Delete drip campaign
  fastify.delete('/drip-campaigns/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await dripCampaignService.delete(userId, id);
    return { success: true, message: 'Drip campaign deleted' };
  });

  // Activate drip campaign
  fastify.post('/drip-campaigns/:id/activate', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await dripCampaignService.activate(userId, id);
    return { success: true, message: 'Drip campaign activated' };
  });

  // Pause drip campaign
  fastify.post('/drip-campaigns/:id/pause', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await dripCampaignService.pause(userId, id);
    return { success: true, message: 'Drip campaign paused' };
  });

  // Enroll contact in drip
  fastify.post('/drip-campaigns/:id/enroll', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { contactId } = request.body as { contactId: string };
    
    const result = await dripCampaignService.enrollContact(userId, id, contactId);
    return { success: true, result };
  });

  // Generate AI drip steps
  fastify.post('/drip-campaigns/generate-steps', async (request, reply) => {
    const userId = (request as any).user.id;
    const { goal, channel, steps, productInfo } = request.body as any;
    
    const generatedSteps = await dripCampaignService.generateAISteps(userId, {
      goal,
      channel,
      steps,
      productInfo,
    });
    
    return { success: true, steps: generatedSteps };
  });

  // Get drip stats
  fastify.get('/drip-campaigns/:id/stats', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const stats = await dripCampaignService.getStats(userId, id);
    return { success: true, stats };
  });

  // ==================== LEAD CAPTURE FORMS ====================

  // Create form
  fastify.post('/lead-forms', async (request, reply) => {
    const userId = (request as any).user.id;
    const data = createLeadFormSchema.parse(request.body);
    
    const form = await leadCaptureService.createForm(userId, data);
    return { success: true, form };
  });

  // Get forms
  fastify.get('/lead-forms', async (request, reply) => {
    const userId = (request as any).user.id;
    const forms = await leadCaptureService.getForms(userId);
    return { success: true, forms };
  });

  // Get form
  fastify.get('/lead-forms/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const form = await leadCaptureService.getForm(userId, id);
    return { success: true, form };
  });

  // Update form
  fastify.patch('/lead-forms/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const form = await leadCaptureService.updateForm(userId, id, request.body as any);
    return { success: true, form };
  });

  // Delete form
  fastify.delete('/lead-forms/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await leadCaptureService.deleteForm(userId, id);
    return { success: true, message: 'Form deleted' };
  });

  // Get form embed code
  fastify.get('/lead-forms/:id/embed', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const embedCode = leadCaptureService.generateEmbedCode(id);
    const iframeCode = leadCaptureService.generateIframeCode(id);
    
    return {
      success: true,
      embed: {
        script: embedCode,
        iframe: iframeCode,
      },
    };
  });

  // Get form stats
  fastify.get('/lead-forms/:id/stats', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const stats = await leadCaptureService.getFormStats(userId, id);
    return { success: true, stats };
  });

  // Public form submission (no auth required)
  fastify.post('/public/lead-forms/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const submission = request.body as any;
    const metadata = {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      referrer: request.headers.referer,
      ...request.query,
    };
    
    const result = await leadCaptureService.submitForm(id, submission, metadata);
    return { success: true, ...result };
  });

  // ==================== VOICE CALLS ====================

  // Schedule call
  fastify.post('/voice-calls', async (request, reply) => {
    const userId = (request as any).user.id;
    const data = scheduleCallSchema.parse(request.body);
    
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, userId },
    });

    if (!contact || !contact.phone) {
      return reply.code(400).send({
        success: false,
        error: 'Contact not found or has no phone number',
      });
    }

    const call = await voiceService.scheduleCall(userId, {
      phoneNumber: contact.phone,
      contactId: data.contactId,
      script: data.script,
      aiVoice: data.aiVoice,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    });

    return { success: true, call };
  });

  // Get calls
  fastify.get('/voice-calls', async (request, reply) => {
    const userId = (request as any).user.id;
    const { status, limit, offset } = request.query as any;
    
    const calls = await voiceService.getCalls(userId, {
      status,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });
    
    return { success: true, ...calls };
  });

  // Get call
  fastify.get('/voice-calls/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const call = await voiceService.getCall(userId, id);
    return { success: true, call };
  });

  // Cancel call
  fastify.delete('/voice-calls/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await voiceService.cancelCall(userId, id);
    return { success: true, message: 'Call cancelled' };
  });

  // Schedule bulk calls
  fastify.post('/voice-calls/bulk', async (request, reply) => {
    const userId = (request as any).user.id;
    const { contactIds, script, aiVoice, scheduledAt } = request.body as any;
    
    const result = await voiceService.scheduleBulkCalls(userId, contactIds, {
      script,
      aiVoice,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });
    
    return { success: true, result };
  });

  // Get call stats
  fastify.get('/voice-calls/stats', async (request, reply) => {
    const userId = (request as any).user.id;
    const stats = await voiceService.getCallStats(userId);
    return { success: true, stats };
  });

  // Get available voices
  fastify.get('/voice-calls/voices', async (request, reply) => {
    return {
      success: true,
      voices: voiceService.AVAILABLE_VOICES,
    };
  });

  // ==================== PAYMENT BOT ====================

  // Create payment intent
  fastify.post('/payments/intent', async (request, reply) => {
    const userId = (request as any).user.id;
    const data = createPaymentIntentSchema.parse(request.body);
    
    const intent = await paymentBotService.createPaymentIntent(userId, data);
    return { success: true, intent };
  });

  // Get payment intents
  fastify.get('/payments/intents', async (request, reply) => {
    const userId = (request as any).user.id;
    const { status, contactId, limit, offset } = request.query as any;
    
    const intents = await paymentBotService.getPaymentIntents(userId, {
      status,
      contactId,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });
    
    return { success: true, ...intents };
  });

  // Get payment intent
  fastify.get('/payments/intents/:id', async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const intent = await paymentBotService.getPaymentIntent(userId, id);
    return { success: true, intent };
  });

  // Handle payment inquiry (for chatbot)
  fastify.post('/payments/inquiry', async (request, reply) => {
    const userId = (request as any).user.id;
    const { contactId, inquiry } = request.body as { contactId: string; inquiry: string };
    
    const response = await paymentBotService.handlePaymentInquiry(userId, contactId, inquiry);
    return { success: true, response };
  });

  // Get revenue stats
  fastify.get('/payments/stats', async (request, reply) => {
    const userId = (request as any).user.id;
    const { period } = request.query as { period?: 'day' | 'week' | 'month' };
    
    const stats = await paymentBotService.getRevenueStats(userId, period || 'month');
    return { success: true, stats };
  });

  // ==================== ANALYTICS ====================

  // Get dashboard stats
  fastify.get('/analytics/dashboard', async (request, reply) => {
    const userId = (request as any).user.id;
    const stats = await analyticsService.getDashboardStats(userId);
    return { success: true, stats };
  });

  // Get messages over time
  fastify.get('/analytics/messages-over-time', async (request, reply) => {
    const userId = (request as any).user.id;
    const { period } = request.query as { period?: '7d' | '30d' | '90d' };
    
    const data = await analyticsService.getMessagesOverTime(userId, period || '30d');
    return { success: true, data };
  });

  // Get revenue over time
  fastify.get('/analytics/revenue-over-time', async (request, reply) => {
    const userId = (request as any).user.id;
    const { period } = request.query as { period?: '7d' | '30d' | '90d' };
    
    const data = await analyticsService.getRevenueOverTime(userId, period || '30d');
    return { success: true, data };
  });

  // Get lead acquisition over time
  fastify.get('/analytics/leads-over-time', async (request, reply) => {
    const userId = (request as any).user.id;
    const { period } = request.query as { period?: '7d' | '30d' | '90d' };
    
    const data = await analyticsService.getLeadAcquisitionOverTime(userId, period || '30d');
    return { success: true, data };
  });

  // Get channel performance
  fastify.get('/analytics/channel-performance', async (request, reply) => {
    const userId = (request as any).user.id;
    const performance = await analyticsService.getChannelPerformance(userId);
    return { success: true, performance };
  });

  // Get conversion funnel
  fastify.get('/analytics/conversion-funnel', async (request, reply) => {
    const userId = (request as any).user.id;
    const funnel = await analyticsService.getConversionFunnel(userId);
    return { success: true, funnel };
  });

  // Get ROI calculation
  fastify.get('/analytics/roi', async (request, reply) => {
    const userId = (request as any).user.id;
    const { period } = request.query as { period?: 'month' | 'quarter' | 'year' };
    
    const roi = await analyticsService.getROICalculation(userId, period || 'month');
    return { success: true, roi };
  });

  // Track event
  fastify.post('/analytics/track', async (request, reply) => {
    const userId = (request as any).user.id;
    const { eventType, data } = request.body as any;
    
    await analyticsService.trackEvent(userId, eventType, data);
    return { success: true };
  });
}
