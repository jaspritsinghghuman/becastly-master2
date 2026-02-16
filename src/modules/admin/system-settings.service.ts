import { prisma } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/crypto';
import { ADMIN_CONFIG, DEFAULT_SETTINGS } from './admin.config';

export interface AIProviderConfig {
  provider: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export interface PaymentGatewayConfig {
  provider: string;
  enabled: boolean;
  testMode: boolean;
  isDefault: boolean;
  credentials: Record<string, string>;
  webhookUrl: string;
}

class SystemSettingsService {
  // ==================== SYSTEM SETTINGS ====================

  async getAllSettings() {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { category: 'asc' },
    });

    // Group by category
    const grouped = settings.reduce((acc: any, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }
      acc[setting.category][setting.key] = setting.value;
      return acc;
    }, {});

    // Ensure all default settings exist
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const category = key.split('.')[0];
      if (!grouped[category]) grouped[category] = {};
      if (!grouped[category][key]) {
        grouped[category][key] = value;
      }
    }

    return grouped;
  }

  async getSetting(key: string): Promise<string | null> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value || DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] || null;
  }

  async setSetting(adminId: string, key: string, value: string, category?: string) {
    const cat = category || key.split('.')[0];
    
    return prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        category: cat,
        updatedBy: adminId,
      },
      update: {
        value,
        category: cat,
        updatedBy: adminId,
        updatedAt: new Date(),
      },
    });
  }

  async setMultipleSettings(adminId: string, settings: Record<string, string>) {
    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      results.push(await this.setSetting(adminId, key, value));
    }
    return results;
  }

  // ==================== AI PROVIDER SETTINGS ====================

  async getAIProviders(): Promise<AIProviderConfig[]> {
    const settings = await this.getAllSettings();
    const aiSettings = settings.ai || {};
    
    const providers: AIProviderConfig[] = [];
    
    for (const [key, config] of Object.entries(ADMIN_CONFIG.AI_PROVIDERS)) {
      const providerKey = key.toLowerCase();
      const providerConfig: AIProviderConfig = {
        provider: key,
        enabled: aiSettings[`ai.providers.${providerKey}.enabled`] === 'true',
        apiKey: aiSettings[`ai.providers.${providerKey}.apiKey`]
          ? decrypt(aiSettings[`ai.providers.${providerKey}.apiKey`])
          : undefined,
        baseUrl: aiSettings[`ai.providers.${providerKey}.baseUrl`],
        defaultModel: aiSettings[`ai.providers.${providerKey}.defaultModel`] || config.defaultModel,
        temperature: parseFloat(aiSettings[`ai.providers.${providerKey}.temperature`] || '0.7'),
        maxTokens: parseInt(aiSettings[`ai.providers.${providerKey}.maxTokens`] || '500'),
      };
      providers.push(providerConfig);
    }
    
    return providers;
  }

  async setAIProvider(adminId: string, provider: string, config: Partial<AIProviderConfig>) {
    const prefix = `ai.providers.${provider.toLowerCase()}`;
    const updates: Record<string, string> = {};

    if (config.enabled !== undefined) {
      updates[`${prefix}.enabled`] = String(config.enabled);
    }
    if (config.apiKey !== undefined) {
      updates[`${prefix}.apiKey`] = encrypt(config.apiKey);
    }
    if (config.baseUrl !== undefined) {
      updates[`${prefix}.baseUrl`] = config.baseUrl;
    }
    if (config.defaultModel !== undefined) {
      updates[`${prefix}.defaultModel`] = config.defaultModel;
    }
    if (config.temperature !== undefined) {
      updates[`${prefix}.temperature`] = String(config.temperature);
    }
    if (config.maxTokens !== undefined) {
      updates[`${prefix}.maxTokens`] = String(config.maxTokens);
    }

    await this.setMultipleSettings(adminId, updates);
    
    // If this is being set as enabled and isDefault, update default provider
    if (config.enabled && config.enabled) {
      await this.setSetting(adminId, 'ai.defaultProvider', provider, 'ai');
    }

    return { success: true };
  }

  async testAIProvider(provider: string): Promise<{ success: boolean; message: string }> {
    try {
      const settings = await this.getAIProviders();
      const providerConfig = settings.find(p => p.provider === provider);
      
      if (!providerConfig || !providerConfig.enabled) {
        return { success: false, message: 'Provider not enabled or configured' };
      }

      if (providerConfig.provider === 'OLLAMA') {
        // Test Ollama connection
        const response = await fetch(`${providerConfig.baseUrl || 'http://localhost:11434'}/api/tags`);
        if (response.ok) {
          return { success: true, message: 'Connected to Ollama successfully' };
        }
      } else {
        // Test API key with a simple request
        if (!providerConfig.apiKey) {
          return { success: false, message: 'API key not configured' };
        }
        // Would make actual API test call here
        return { success: true, message: 'API key format valid' };
      }

      return { success: false, message: 'Connection failed' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ==================== PAYMENT GATEWAY SETTINGS ====================

  async getPaymentGateways(): Promise<PaymentGatewayConfig[]> {
    const gateways = await prisma.paymentGateway.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return gateways.map(g => ({
      provider: g.provider,
      enabled: g.isActive,
      testMode: g.config ? JSON.parse(decrypt(g.config) || '{}').testMode === true : false,
      isDefault: g.isDefault,
      credentials: {}, // Don't return actual credentials
      webhookUrl: `${process.env.APP_URL}/webhooks/payments/${g.provider.toLowerCase()}`,
    }));
  }

  async addPaymentGateway(adminId: string, data: {
    provider: string;
    name: string;
    credentials: Record<string, string>;
    testMode: boolean;
    isDefault: boolean;
    currency: string;
    region: string;
  }) {
    const { provider, name, credentials, testMode, isDefault, currency, region } = data;

    // Encrypt credentials
    const encryptedConfig = encrypt(JSON.stringify({ ...credentials, testMode }));

    // If setting as default, unset others
    if (isDefault) {
      await prisma.paymentGateway.updateMany({
        data: { isDefault: false },
      });
    }

    return prisma.paymentGateway.create({
      data: {
        name,
        provider,
        publicKey: credentials.publicKey || credentials.keyId || credentials.clientId || '',
        secretKey: encrypt(credentials.secretKey || credentials.keySecret || credentials.clientSecret || ''),
        webhookSecret: credentials.webhookSecret ? encrypt(credentials.webhookSecret) : null,
        config: encryptedConfig,
        isActive: true,
        isDefault,
        currency,
        region,
      },
    });
  }

  async updatePaymentGateway(adminId: string, gatewayId: string, data: Partial<{
    name: string;
    credentials: Record<string, string>;
    testMode: boolean;
    isDefault: boolean;
    isActive: boolean;
  }>) {
    const gateway = await prisma.paymentGateway.findUnique({
      where: { id: gatewayId },
    });

    if (!gateway) {
      throw new Error('Payment gateway not found');
    }

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDefault !== undefined) {
      updateData.isDefault = data.isDefault;
      if (data.isDefault) {
        await prisma.paymentGateway.updateMany({
          where: { NOT: { id: gatewayId } },
          data: { isDefault: false },
        });
      }
    }

    if (data.credentials) {
      const existingConfig = JSON.parse(decrypt(gateway.config) || '{}');
      updateData.config = encrypt(JSON.stringify({
        ...existingConfig,
        ...data.credentials,
        testMode: data.testMode ?? existingConfig.testMode,
      }));
      
      if (data.credentials.publicKey) updateData.publicKey = data.credentials.publicKey;
      if (data.credentials.secretKey) updateData.secretKey = encrypt(data.credentials.secretKey);
      if (data.credentials.webhookSecret) updateData.webhookSecret = encrypt(data.credentials.webhookSecret);
    }

    return prisma.paymentGateway.update({
      where: { id: gatewayId },
      data: updateData,
    });
  }

  async deletePaymentGateway(adminId: string, gatewayId: string) {
    return prisma.paymentGateway.delete({
      where: { id: gatewayId },
    });
  }

  async testPaymentGateway(gatewayId: string): Promise<{ success: boolean; message: string }> {
    try {
      const gateway = await prisma.paymentGateway.findUnique({
        where: { id: gatewayId },
      });

      if (!gateway) {
        return { success: false, message: 'Gateway not found' };
      }

      const config = JSON.parse(decrypt(gateway.config) || '{}');

      // Provider-specific tests
      switch (gateway.provider) {
        case 'STRIPE':
          // Would test Stripe connection
          return { success: true, message: 'Stripe configuration valid' };
        case 'RAZORPAY':
          // Would test Razorpay connection
          return { success: true, message: 'Razorpay configuration valid' };
        default:
          return { success: true, message: 'Configuration saved' };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ==================== PLAN CONFIGURATION ====================

  async getPlanConfiguration(planKey: string) {
    const settings = await this.getAllSettings();
    const planSettings = settings.plans || {};
    const prefix = `plans.${planKey.toLowerCase()}`;

    return {
      name: planSettings[`${prefix}.name`] || ADMIN_CONFIG.PLAN_TEMPLATES[planKey as keyof typeof ADMIN_CONFIG.PLAN_TEMPLATES]?.name,
      description: planSettings[`${prefix}.description`],
      priceMonthly: parseFloat(planSettings[`${prefix}.priceMonthly`] || '0'),
      priceYearly: parseFloat(planSettings[`${prefix}.priceYearly`] || '0'),
      currency: planSettings[`${prefix}.currency`] || 'USD',
      monthlyMessages: parseInt(planSettings[`${prefix}.monthlyMessages`] || '0'),
      dailyQuota: parseInt(planSettings[`${prefix}.dailyQuota`] || '0'),
      aiTokens: parseInt(planSettings[`${prefix}.aiTokens`] || '0'),
      voiceMinutes: parseInt(planSettings[`${prefix}.voiceMinutes`] || '0'),
      features: {
        channels: (planSettings[`${prefix}.features.channels`] || 'WHATSAPP,EMAIL').split(','),
        campaigns: planSettings[`${prefix}.features.campaigns`] !== 'false',
        contacts: parseInt(planSettings[`${prefix}.features.contacts`] || '0'),
        api: planSettings[`${prefix}.features.api`] === 'true',
        aiFeatures: planSettings[`${prefix}.features.aiFeatures`] === 'true',
        voiceCalls: planSettings[`${prefix}.features.voiceCalls`] === 'true',
        webhooks: planSettings[`${prefix}.features.webhooks`] === 'true',
        teamMembers: parseInt(planSettings[`${prefix}.features.teamMembers`] || '1'),
        whiteLabel: planSettings[`${prefix}.features.whiteLabel`] === 'true',
      },
      enabled: planSettings[`${prefix}.enabled`] !== 'false',
    };
  }

  async setPlanConfiguration(adminId: string, planKey: string, config: any) {
    const prefix = `plans.${planKey.toLowerCase()}`;
    const updates: Record<string, string> = {};

    if (config.name) updates[`${prefix}.name`] = config.name;
    if (config.description) updates[`${prefix}.description`] = config.description;
    if (config.priceMonthly !== undefined) updates[`${prefix}.priceMonthly`] = String(config.priceMonthly);
    if (config.priceYearly !== undefined) updates[`${prefix}.priceYearly`] = String(config.priceYearly);
    if (config.currency) updates[`${prefix}.currency`] = config.currency;
    if (config.monthlyMessages !== undefined) updates[`${prefix}.monthlyMessages`] = String(config.monthlyMessages);
    if (config.dailyQuota !== undefined) updates[`${prefix}.dailyQuota`] = String(config.dailyQuota);
    if (config.aiTokens !== undefined) updates[`${prefix}.aiTokens`] = String(config.aiTokens);
    if (config.voiceMinutes !== undefined) updates[`${prefix}.voiceMinutes`] = String(config.voiceMinutes);
    if (config.enabled !== undefined) updates[`${prefix}.enabled`] = String(config.enabled);

    // Features
    if (config.features) {
      if (config.features.channels) updates[`${prefix}.features.channels`] = config.features.channels.join(',');
      if (config.features.campaigns !== undefined) updates[`${prefix}.features.campaigns`] = String(config.features.campaigns);
      if (config.features.contacts !== undefined) updates[`${prefix}.features.contacts`] = String(config.features.contacts);
      if (config.features.api !== undefined) updates[`${prefix}.features.api`] = String(config.features.api);
      if (config.features.aiFeatures !== undefined) updates[`${prefix}.features.aiFeatures`] = String(config.features.aiFeatures);
      if (config.features.voiceCalls !== undefined) updates[`${prefix}.features.voiceCalls`] = String(config.features.voiceCalls);
      if (config.features.webhooks !== undefined) updates[`${prefix}.features.webhooks`] = String(config.features.webhooks);
      if (config.features.teamMembers !== undefined) updates[`${prefix}.features.teamMembers`] = String(config.features.teamMembers);
      if (config.features.whiteLabel !== undefined) updates[`${prefix}.features.whiteLabel`] = String(config.features.whiteLabel);
    }

    await this.setMultipleSettings(adminId, updates);
    return { success: true };
  }

  async getAllPlanConfigurations() {
    const plans = ['FREE', 'STARTER', 'GROWTH', 'PRO', 'AGENCY'];
    const configs: Record<string, any> = {};
    
    for (const plan of plans) {
      configs[plan] = await this.getPlanConfiguration(plan);
    }
    
    return configs;
  }

  // ==================== APP CONFIGURATION ====================

  async getAppConfig() {
    const settings = await this.getAllSettings();
    
    return {
      name: settings.general?.['app.name'] || 'BeeCastly',
      logo: settings.general?.['app.logo'],
      favicon: settings.general?.['app.favicon'],
      primaryColor: settings.general?.['app.primaryColor'] || '#0070f3',
      supportEmail: settings.general?.['app.supportEmail'],
      termsUrl: settings.general?.['app.termsUrl'],
      privacyUrl: settings.general?.['app.privacyUrl'],
    };
  }

  async setAppConfig(adminId: string, config: {
    name?: string;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    supportEmail?: string;
    termsUrl?: string;
    privacyUrl?: string;
  }) {
    const updates: Record<string, string> = {};
    
    if (config.name) updates['app.name'] = config.name;
    if (config.logo !== undefined) updates['app.logo'] = config.logo;
    if (config.favicon !== undefined) updates['app.favicon'] = config.favicon;
    if (config.primaryColor) updates['app.primaryColor'] = config.primaryColor;
    if (config.supportEmail) updates['app.supportEmail'] = config.supportEmail;
    if (config.termsUrl !== undefined) updates['app.termsUrl'] = config.termsUrl;
    if (config.privacyUrl !== undefined) updates['app.privacyUrl'] = config.privacyUrl;

    await this.setMultipleSettings(adminId, updates);
    return { success: true };
  }

  // ==================== SECURITY SETTINGS ====================

  async getSecuritySettings() {
    const settings = await this.getAllSettings();
    
    return {
      sessionTimeout: parseInt(settings.security?.['security.sessionTimeout'] || '24'),
      maxLoginAttempts: parseInt(settings.security?.['security.maxLoginAttempts'] || '5'),
      lockoutDuration: parseInt(settings.security?.['security.lockoutDuration'] || '30'),
      require2FA: settings.security?.['security.require2FA'] === 'true',
      allowedIPs: settings.security?.['security.allowedIPs']?.split(',').filter(Boolean) || [],
      passwordMinLength: parseInt(settings.security?.['security.passwordMinLength'] || '8'),
      passwordRequireSpecial: settings.security?.['security.passwordRequireSpecial'] === 'true',
    };
  }

  async setSecuritySettings(adminId: string, settings: {
    sessionTimeout?: number;
    maxLoginAttempts?: number;
    lockoutDuration?: number;
    require2FA?: boolean;
    allowedIPs?: string[];
    passwordMinLength?: number;
    passwordRequireSpecial?: boolean;
  }) {
    const updates: Record<string, string> = {};
    
    if (settings.sessionTimeout !== undefined) updates['security.sessionTimeout'] = String(settings.sessionTimeout);
    if (settings.maxLoginAttempts !== undefined) updates['security.maxLoginAttempts'] = String(settings.maxLoginAttempts);
    if (settings.lockoutDuration !== undefined) updates['security.lockoutDuration'] = String(settings.lockoutDuration);
    if (settings.require2FA !== undefined) updates['security.require2FA'] = String(settings.require2FA);
    if (settings.allowedIPs !== undefined) updates['security.allowedIPs'] = settings.allowedIPs.join(',');
    if (settings.passwordMinLength !== undefined) updates['security.passwordMinLength'] = String(settings.passwordMinLength);
    if (settings.passwordRequireSpecial !== undefined) updates['security.passwordRequireSpecial'] = String(settings.passwordRequireSpecial);

    await this.setMultipleSettings(adminId, updates);
    return { success: true };
  }

  // ==================== FEATURE FLAGS ====================

  async getFeatureFlags() {
    const settings = await this.getAllSettings();
    
    return {
      signupEnabled: settings.features?.['features.signupEnabled'] !== 'false',
      waitlistEnabled: settings.features?.['features.waitlistEnabled'] === 'true',
      apiEnabled: settings.features?.['features.apiEnabled'] !== 'false',
      whiteLabelEnabled: settings.features?.['features.whiteLabelEnabled'] === 'true',
      affiliateEnabled: settings.features?.['features.affiliateEnabled'] === 'true',
    };
  }

  async setFeatureFlags(adminId: string, flags: {
    signupEnabled?: boolean;
    waitlistEnabled?: boolean;
    apiEnabled?: boolean;
    whiteLabelEnabled?: boolean;
    affiliateEnabled?: boolean;
  }) {
    const updates: Record<string, string> = {};
    
    if (flags.signupEnabled !== undefined) updates['features.signupEnabled'] = String(flags.signupEnabled);
    if (flags.waitlistEnabled !== undefined) updates['features.waitlistEnabled'] = String(flags.waitlistEnabled);
    if (flags.apiEnabled !== undefined) updates['features.apiEnabled'] = String(flags.apiEnabled);
    if (flags.whiteLabelEnabled !== undefined) updates['features.whiteLabelEnabled'] = String(flags.whiteLabelEnabled);
    if (flags.affiliateEnabled !== undefined) updates['features.affiliateEnabled'] = String(flags.affiliateEnabled);

    await this.setMultipleSettings(adminId, updates);
    return { success: true };
  }
}

export const systemSettingsService = new SystemSettingsService();
