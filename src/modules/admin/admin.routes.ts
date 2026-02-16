import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { systemSettingsService } from './system-settings.service';
import { adminAnalyticsService } from './admin-analytics.service';
import { adminUsersService } from './admin-users.service';
import { billingService } from './billing.service';
import { ADMIN_CONFIG } from './admin.config';
import { Plan } from '@prisma/client';

// Validation schemas
const updateSettingsSchema = z.record(z.string());

const aiProviderSchema = z.object({
  provider: z.string(),
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
});

const paymentGatewaySchema = z.object({
  provider: z.enum(['STRIPE', 'RAZORPAY', 'PAYPAL', 'CASHFREE', 'PHONEPE']),
  name: z.string(),
  credentials: z.record(z.string()),
  testMode: z.boolean(),
  isDefault: z.boolean(),
  currency: z.string(),
  region: z.string(),
});

const planConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  currency: z.string(),
  monthlyMessages: z.number(),
  dailyQuota: z.number(),
  aiTokens: z.number(),
  voiceMinutes: z.number(),
  features: z.object({
    channels: z.array(z.string()),
    campaigns: z.boolean(),
    contacts: z.number(),
    api: z.boolean(),
    aiFeatures: z.boolean(),
    voiceCalls: z.boolean(),
    webhooks: z.boolean(),
    teamMembers: z.number(),
    whiteLabel: z.boolean(),
  }),
  enabled: z.boolean(),
});

const appConfigSchema = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  primaryColor: z.string().optional(),
  supportEmail: z.string().optional(),
  termsUrl: z.string().optional(),
  privacyUrl: z.string().optional(),
});

const securitySettingsSchema = z.object({
  sessionTimeout: z.number().optional(),
  maxLoginAttempts: z.number().optional(),
  lockoutDuration: z.number().optional(),
  require2FA: z.boolean().optional(),
  allowedIPs: z.array(z.string()).optional(),
  passwordMinLength: z.number().optional(),
  passwordRequireSpecial: z.boolean().optional(),
});

const featureFlagsSchema = z.object({
  signupEnabled: z.boolean().optional(),
  waitlistEnabled: z.boolean().optional(),
  apiEnabled: z.boolean().optional(),
  whiteLabelEnabled: z.boolean().optional(),
  affiliateEnabled: z.boolean().optional(),
});

// Admin middleware
async function requireAdmin(request: any, reply: any) {
  const user = request.user;
  
  // Check if user is admin (you'd implement proper RBAC here)
  // For now, allow all authenticated users for development
  if (!user) {
    return reply.code(401).send({ success: false, error: 'Unauthorized' });
  }
  
  // TODO: Check admin role from user
  // const isAdmin = await checkAdminRole(user.id);
  // if (!isAdmin) return reply.code(403).send({ success: false, error: 'Forbidden' });
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Apply admin middleware to all routes
  fastify.addHook('preHandler', requireAdmin);

  // ==================== DASHBOARD ====================

  fastify.get('/dashboard', async (request, reply) => {
    const stats = await adminAnalyticsService.getDashboardStats();
    return { success: true, stats };
  });

  // ==================== SYSTEM SETTINGS ====================

  // Get all settings grouped by category
  fastify.get('/settings', async (request, reply) => {
    const settings = await systemSettingsService.getAllSettings();
    return { success: true, settings };
  });

  // Update settings
  fastify.patch('/settings', async (request, reply) => {
    const adminId = (request as any).user.id;
    const data = updateSettingsSchema.parse(request.body);
    
    await systemSettingsService.setMultipleSettings(adminId, data);
    return { success: true, message: 'Settings updated' };
  });

  // Get setting by key
  fastify.get('/settings/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const value = await systemSettingsService.getSetting(key);
    return { success: true, key, value };
  });

  // ==================== AI PROVIDER SETTINGS ====================

  // Get all AI providers configuration
  fastify.get('/ai-providers', async (request, reply) => {
    const providers = await systemSettingsService.getAIProviders();
    return { success: true, providers };
  });

  // Update AI provider
  fastify.patch('/ai-providers/:provider', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { provider } = request.params as { provider: string };
    const data = aiProviderSchema.parse(request.body);
    
    await systemSettingsService.setAIProvider(adminId, provider, data);
    return { success: true, message: 'AI provider updated' };
  });

  // Test AI provider connection
  fastify.post('/ai-providers/:provider/test', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const result = await systemSettingsService.testAIProvider(provider);
    return result;
  });

  // Get available AI providers (metadata)
  fastify.get('/ai-providers/available', async (request, reply) => {
    return {
      success: true,
      providers: ADMIN_CONFIG.AI_PROVIDERS,
    };
  });

  // ==================== PAYMENT GATEWAY SETTINGS ====================

  // Get all payment gateways
  fastify.get('/payment-gateways', async (request, reply) => {
    const gateways = await systemSettingsService.getPaymentGateways();
    return { success: true, gateways };
  });

  // Add payment gateway
  fastify.post('/payment-gateways', async (request, reply) => {
    const adminId = (request as any).user.id;
    const data = paymentGatewaySchema.parse(request.body);
    
    const gateway = await systemSettingsService.addPaymentGateway(adminId, data);
    return { success: true, gateway };
  });

  // Update payment gateway
  fastify.patch('/payment-gateways/:id', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const data = request.body as any;
    
    const gateway = await systemSettingsService.updatePaymentGateway(adminId, id, data);
    return { success: true, gateway };
  });

  // Delete payment gateway
  fastify.delete('/payment-gateways/:id', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    await systemSettingsService.deletePaymentGateway(adminId, id);
    return { success: true, message: 'Payment gateway deleted' };
  });

  // Test payment gateway
  fastify.post('/payment-gateways/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await systemSettingsService.testPaymentGateway(id);
    return result;
  });

  // Get available payment providers (metadata)
  fastify.get('/payment-gateways/available', async (request, reply) => {
    return {
      success: true,
      providers: ADMIN_CONFIG.PAYMENT_PROVIDERS,
    };
  });

  // ==================== PLAN CONFIGURATION ====================

  // Get all plan configurations
  fastify.get('/plans', async (request, reply) => {
    const plans = await systemSettingsService.getAllPlanConfigurations();
    return { success: true, plans };
  });

  // Get single plan configuration
  fastify.get('/plans/:plan', async (request, reply) => {
    const { plan } = request.params as { plan: string };
    const config = await systemSettingsService.getPlanConfiguration(plan);
    return { success: true, config };
  });

  // Update plan configuration
  fastify.patch('/plans/:plan', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { plan } = request.params as { plan: string };
    const data = planConfigSchema.parse(request.body);
    
    await systemSettingsService.setPlanConfiguration(adminId, plan, data);
    return { success: true, message: 'Plan configuration updated' };
  });

  // Get plan templates
  fastify.get('/plans/templates', async (request, reply) => {
    return {
      success: true,
      templates: ADMIN_CONFIG.PLAN_TEMPLATES,
    };
  });

  // ==================== APP CONFIGURATION ====================

  // Get app configuration
  fastify.get('/app-config', async (request, reply) => {
    const config = await systemSettingsService.getAppConfig();
    return { success: true, config };
  });

  // Update app configuration
  fastify.patch('/app-config', async (request, reply) => {
    const adminId = (request as any).user.id;
    const data = appConfigSchema.parse(request.body);
    
    await systemSettingsService.setAppConfig(adminId, data);
    return { success: true, message: 'App configuration updated' };
  });

  // ==================== SECURITY SETTINGS ====================

  // Get security settings
  fastify.get('/security', async (request, reply) => {
    const settings = await systemSettingsService.getSecuritySettings();
    return { success: true, settings };
  });

  // Update security settings
  fastify.patch('/security', async (request, reply) => {
    const adminId = (request as any).user.id;
    const data = securitySettingsSchema.parse(request.body);
    
    await systemSettingsService.setSecuritySettings(adminId, data);
    return { success: true, message: 'Security settings updated' };
  });

  // ==================== FEATURE FLAGS ====================

  // Get feature flags
  fastify.get('/features', async (request, reply) => {
    const flags = await systemSettingsService.getFeatureFlags();
    return { success: true, flags };
  });

  // Update feature flags
  fastify.patch('/features', async (request, reply) => {
    const adminId = (request as any).user.id;
    const data = featureFlagsSchema.parse(request.body);
    
    await systemSettingsService.setFeatureFlags(adminId, data);
    return { success: true, message: 'Feature flags updated' };
  });

  // ==================== ANALYTICS ====================

  // User growth
  fastify.get('/analytics/user-growth', async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await adminAnalyticsService.getUserGrowth(days ? parseInt(days) : 30);
    return { success: true, data };
  });

  // User retention
  fastify.get('/analytics/retention', async (request, reply) => {
    const { cohortDays } = request.query as { cohortDays?: string };
    const data = await adminAnalyticsService.getUserRetention(cohortDays ? parseInt(cohortDays) : 30);
    return { success: true, data };
  });

  // Revenue breakdown
  fastify.get('/analytics/revenue-breakdown', async (request, reply) => {
    const data = await adminAnalyticsService.getRevenueBreakdown();
    return { success: true, data };
  });

  // Revenue growth
  fastify.get('/analytics/revenue-growth', async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await adminAnalyticsService.getRevenueGrowth(days ? parseInt(days) : 30);
    return { success: true, data };
  });

  // Top customers
  fastify.get('/analytics/top-customers', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const data = await adminAnalyticsService.getTopCustomers(limit ? parseInt(limit) : 10);
    return { success: true, data };
  });

  // Message volume
  fastify.get('/analytics/message-volume', async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await adminAnalyticsService.getMessageVolume(days ? parseInt(days) : 30);
    return { success: true, data };
  });

  // Message success rates
  fastify.get('/analytics/message-success', async (request, reply) => {
    const data = await adminAnalyticsService.getMessageSuccessRates();
    return { success: true, data };
  });

  // System metrics
  fastify.get('/analytics/system-metrics', async (request, reply) => {
    const data = await adminAnalyticsService.getSystemMetrics();
    return { success: true, data };
  });

  // Recent errors
  fastify.get('/analytics/errors', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const data = await adminAnalyticsService.getRecentErrors(limit ? parseInt(limit) : 10);
    return { success: true, data };
  });

  // Export data
  fastify.get('/analytics/export/:type', async (request, reply) => {
    const { type } = request.params as { type: 'users' | 'revenue' };
    const { format } = request.query as { format?: 'csv' | 'json' };
    
    if (type === 'users') {
      const data = await adminAnalyticsService.exportUserData(format || 'csv');
      return { success: true, data };
    } else {
      const data = await adminAnalyticsService.exportRevenueData(format || 'csv');
      return { success: true, data };
    }
  });

  // ==================== USER MANAGEMENT ====================

  // Get users list
  fastify.get('/users', async (request, reply) => {
    const {
      page,
      limit,
      plan,
      status,
      search,
      sortBy,
      sortOrder,
    } = request.query as any;

    const result = await adminUsersService.getUsers({
      filters: {
        plan: plan as Plan,
        status,
        search,
      },
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      sortBy,
      sortOrder,
    });

    return { success: true, ...result };
  });

  // Get user details
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await adminUsersService.getUserDetails(id);
    
    if (!user) {
      return reply.code(404).send({ success: false, error: 'User not found' });
    }
    
    return { success: true, user };
  });

  // Get user activity
  fastify.get('/users/:id/activity', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { days } = request.query as { days?: string };
    
    const activity = await adminUsersService.getUserActivity(id, days ? parseInt(days) : 30);
    return { success: true, activity };
  });

  // Impersonate user
  fastify.post('/users/:id/impersonate', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    
    const result = await adminUsersService.impersonateUser(adminId, id);
    return { success: true, ...result };
  });

  // Suspend user
  fastify.post('/users/:id/suspend', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    
    const result = await adminUsersService.suspendUser(adminId, id, reason);
    return result;
  });

  // Unsuspend user
  fastify.post('/users/:id/unsuspend', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    
    const result = await adminUsersService.unsuspendUser(adminId, id, reason);
    return result;
  });

  // Delete user
  fastify.delete('/users/:id', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    
    const result = await adminUsersService.deleteUser(adminId, id, reason);
    return result;
  });

  // Change user plan
  fastify.patch('/users/:id/plan', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { plan, reason } = request.body as { plan: Plan; reason: string };
    
    const result = await adminUsersService.changeUserPlan(adminId, id, plan, reason);
    return result;
  });

  // Reset user quota
  fastify.post('/users/:id/reset-quota', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { id } = request.params as { id: string };
    const { quota, reason } = request.body as { quota: number; reason: string };
    
    const result = await adminUsersService.resetUserQuota(adminId, id, quota, reason);
    return result;
  });

  // Bulk action
  fastify.post('/users/bulk-action', async (request, reply) => {
    const adminId = (request as any).user.id;
    const { action, userIds, data } = request.body as any;
    
    const result = await adminUsersService.bulkAction(adminId, action, userIds, data);
    return result;
  });

  // Admin actions log
  fastify.get('/actions', async (request, reply) => {
    const { page, limit, adminId, action, targetType } = request.query as any;
    
    const result = await adminUsersService.getAdminActions({
      adminId,
      action,
      targetType,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    
    return { success: true, ...result };
  });

  // ==================== BILLING ====================

  // Get subscriptions
  fastify.get('/billing/subscriptions', async (request, reply) => {
    // Would implement subscription listing
    return { success: true, subscriptions: [] };
  });

  // Create subscription
  fastify.post('/billing/subscriptions', async (request, reply) => {
    const data = request.body as any;
    const subscription = await billingService.createSubscription(data);
    return { success: true, subscription };
  });

  // Get invoices
  fastify.get('/billing/invoices', async (request, reply) => {
    const { userId, status, limit } = request.query as any;
    
    if (!userId) {
      return reply.code(400).send({ success: false, error: 'userId required' });
    }
    
    const invoices = await billingService.getInvoices(userId, {
      status,
      limit: limit ? parseInt(limit) : 20,
    });
    
    return { success: true, invoices };
  });

  // Get invoice details
  fastify.get('/billing/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await billingService.getInvoice(id);
    
    if (!invoice) {
      return reply.code(404).send({ success: false, error: 'Invoice not found' });
    }
    
    return { success: true, invoice };
  });

  // Generate invoice PDF
  fastify.get('/billing/invoices/:id/pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const url = await billingService.generateInvoicePDF(id);
    return { success: true, url };
  });

  // Get usage
  fastify.get('/billing/usage', async (request, reply) => {
    const { userId, year, month } = request.query as any;
    
    if (!userId) {
      return reply.code(400).send({ success: false, error: 'userId required' });
    }
    
    const usage = await billingService.getUsage(
      userId,
      year ? parseInt(year) : undefined,
      month ? parseInt(month) : undefined
    );
    
    return { success: true, usage };
  });

  // Plan pricing
  fastify.get('/billing/pricing', async (request, reply) => {
    const pricing = await billingService.getPlanPricing();
    return { success: true, pricing };
  });

  // Update plan pricing
  fastify.patch('/billing/pricing', async (request, reply) => {
    const { pricing } = request.body as { pricing: any[] };
    await billingService.setPlanPricing(pricing);
    return { success: true, message: 'Pricing updated' };
  });
}
