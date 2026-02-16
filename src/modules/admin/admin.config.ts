// Admin Configuration Constants

export const ADMIN_CONFIG = {
  // AI Providers available in the system
  AI_PROVIDERS: {
    OPENAI: {
      name: 'OpenAI',
      description: 'Cloud-based AI with GPT-4, GPT-4o, GPT-3.5',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4o-mini',
      requiresKey: true,
      keyPlaceholder: 'sk-...',
      keyPattern: '^sk-[a-zA-Z0-9]{48,}$',
      docsUrl: 'https://platform.openai.com/api-keys',
    },
    ANTHROPIC: {
      name: 'Anthropic Claude',
      description: 'Claude AI with excellent reasoning',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
      defaultModel: 'claude-3-5-sonnet-20241022',
      requiresKey: true,
      keyPlaceholder: 'sk-ant-...',
      keyPattern: '^sk-ant-[a-zA-Z0-9_-]+$',
      docsUrl: 'https://console.anthropic.com/settings/keys',
    },
    OLLAMA: {
      name: 'Ollama (Self-Hosted)',
      description: 'Run AI models locally for privacy',
      models: ['llama3.2', 'llama3.1:70b', 'mistral', 'codellama', 'phi4', 'qwen2.5'],
      defaultModel: 'llama3.2',
      requiresKey: false,
      requiresUrl: true,
      defaultUrl: 'http://localhost:11434',
      docsUrl: 'https://ollama.com/download',
    },
    GOOGLE: {
      name: 'Google Gemini',
      description: 'Google\'s multimodal AI models',
      models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
      defaultModel: 'gemini-1.5-flash',
      requiresKey: true,
      keyPlaceholder: 'AIza...',
      docsUrl: 'https://aistudio.google.com/app/apikey',
    },
    DEEPSEEK: {
      name: 'DeepSeek',
      description: 'Cost-effective AI models',
      models: ['deepseek-chat', 'deepseek-coder'],
      defaultModel: 'deepseek-chat',
      requiresKey: true,
      keyPlaceholder: 'sk-...',
      docsUrl: 'https://platform.deepseek.com/api_keys',
    },
    CUSTOM: {
      name: 'Custom/OpenRouter',
      description: 'Use any OpenAI-compatible API',
      models: ['custom'],
      defaultModel: 'custom',
      requiresKey: true,
      requiresUrl: true,
      keyPlaceholder: 'sk-...',
      defaultUrl: 'https://api.openrouter.ai/v1',
      docsUrl: 'https://openrouter.ai/docs',
    },
  },

  // Payment Gateway Providers
  PAYMENT_PROVIDERS: {
    STRIPE: {
      name: 'Stripe',
      description: 'Global payment processing',
      currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD', 'CHF'],
      defaultCurrency: 'USD',
      requires: ['publicKey', 'secretKey', 'webhookSecret'],
      testMode: true,
      docsUrl: 'https://dashboard.stripe.com/apikeys',
    },
    RAZORPAY: {
      name: 'Razorpay',
      description: 'India-focused payments',
      currencies: ['INR'],
      defaultCurrency: 'INR',
      requires: ['keyId', 'keySecret', 'webhookSecret'],
      testMode: true,
      docsUrl: 'https://dashboard.razorpay.com/app/keys',
    },
    PAYPAL: {
      name: 'PayPal',
      description: 'Global PayPal integration',
      currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY'],
      defaultCurrency: 'USD',
      requires: ['clientId', 'clientSecret', 'webhookId'],
      testMode: true,
      docsUrl: 'https://developer.paypal.com/dashboard/',
    },
    CASHFREE: {
      name: 'Cashfree',
      description: 'India payments + payouts',
      currencies: ['INR'],
      defaultCurrency: 'INR',
      requires: ['appId', 'secretKey'],
      testMode: true,
      docsUrl: 'https://merchant.cashfree.com/merchants/login',
    },
    PHONEPE: {
      name: 'PhonePe Gateway',
      description: 'India UPI payments',
      currencies: ['INR'],
      defaultCurrency: 'INR',
      requires: ['merchantId', 'saltKey', 'saltIndex'],
      testMode: true,
      docsUrl: 'https://developer.phonepe.com/',
    },
  },

  // Plan Configuration Templates
  PLAN_TEMPLATES: {
    FREE: {
      name: 'Free',
      description: 'For individuals getting started',
      monthlyMessages: 100,
      dailyQuota: 100,
      aiTokens: 1000,
      voiceMinutes: 0,
      features: {
        channels: ['WHATSAPP', 'EMAIL'],
        campaigns: true,
        contacts: 500,
        api: false,
        aiFeatures: false,
        voiceCalls: false,
        webhooks: false,
        teamMembers: 1,
        whiteLabel: false,
      },
    },
    STARTER: {
      name: 'Starter',
      description: 'For small businesses',
      monthlyMessages: 5000,
      dailyQuota: 500,
      aiTokens: 10000,
      voiceMinutes: 60,
      features: {
        channels: ['WHATSAPP', 'EMAIL', 'SMS', 'TELEGRAM'],
        campaigns: true,
        contacts: 5000,
        api: true,
        aiFeatures: true,
        voiceCalls: true,
        webhooks: true,
        teamMembers: 3,
        whiteLabel: false,
      },
    },
    GROWTH: {
      name: 'Growth',
      description: 'For growing teams',
      monthlyMessages: 50000,
      dailyQuota: 2000,
      aiTokens: 100000,
      voiceMinutes: 500,
      features: {
        channels: ['WHATSAPP', 'EMAIL', 'SMS', 'TELEGRAM', 'VOICE'],
        campaigns: true,
        contacts: 50000,
        api: true,
        aiFeatures: true,
        voiceCalls: true,
        webhooks: true,
        teamMembers: 10,
        whiteLabel: false,
      },
    },
    PRO: {
      name: 'Pro',
      description: 'For power users',
      monthlyMessages: 200000,
      dailyQuota: 10000,
      aiTokens: 500000,
      voiceMinutes: 2000,
      features: {
        channels: ['WHATSAPP', 'EMAIL', 'SMS', 'TELEGRAM', 'VOICE'],
        campaigns: true,
        contacts: 200000,
        api: true,
        aiFeatures: true,
        voiceCalls: true,
        webhooks: true,
        teamMembers: 25,
        whiteLabel: false,
      },
    },
    AGENCY: {
      name: 'Agency',
      description: 'For marketing agencies',
      monthlyMessages: 1000000,
      dailyQuota: 50000,
      aiTokens: 2000000,
      voiceMinutes: 10000,
      features: {
        channels: ['WHATSAPP', 'EMAIL', 'SMS', 'TELEGRAM', 'VOICE'],
        campaigns: true,
        contacts: 1000000,
        api: true,
        aiFeatures: true,
        voiceCalls: true,
        webhooks: true,
        teamMembers: 100,
        whiteLabel: true,
      },
    },
  },

  // System Setting Categories
  SETTING_CATEGORIES: {
    GENERAL: 'general',
    SECURITY: 'security',
    BILLING: 'billing',
    EMAIL: 'email',
    SMS: 'sms',
    AI: 'ai',
    INTEGRATIONS: 'integrations',
    FEATURES: 'features',
  },

  // Default System Settings
  DEFAULT_SETTINGS: {
    // General
    'app.name': 'BeeCastly',
    'app.logo': '',
    'app.favicon': '',
    'app.primaryColor': '#0070f3',
    'app.supportEmail': 'support@becastly.com',
    'app.termsUrl': '',
    'app.privacyUrl': '',
    
    // Security
    'security.sessionTimeout': '24', // hours
    'security.maxLoginAttempts': '5',
    'security.lockoutDuration': '30', // minutes
    'security.require2FA': 'false',
    'security.allowedIPs': '',
    'security.passwordMinLength': '8',
    'security.passwordRequireSpecial': 'true',
    
    // Billing
    'billing.currency': 'USD',
    'billing.taxRate': '0',
    'billing.taxName': '',
    'billing.invoicePrefix': 'INV-',
    'billing.trialDays': '14',
    'billing.gracePeriodDays': '3',
    
    // Email
    'email.fromName': 'BeeCastly',
    'email.fromAddress': 'noreply@becastly.com',
    'email.provider': 'smtp', // smtp, sendgrid, ses
    
    // SMS
    'sms.defaultProvider': 'twilio',
    'sms.defaultSenderId': 'BECAST',
    
    // AI
    'ai.defaultProvider': 'OPENAI',
    'ai.defaultModel': 'gpt-4o-mini',
    'ai.temperature': '0.7',
    'ai.maxTokens': '500',
    'ai.monthlyTokenLimit': '100000',
    'ai.enableAllUsers': 'true',
    
    // Features
    'features.signupEnabled': 'true',
    'features.waitlistEnabled': 'false',
    'features.apiEnabled': 'true',
    'features.whiteLabelEnabled': 'true',
    'features.affiliateEnabled': 'false',
    
    // Abuse Protection
    'abuse.maxMessagesPerHour': '100',
    'abuse.maxMessagesPerDay': '1000',
    'abuse.spamScoreThreshold': '0.8',
    'abuse.autoSuspendThreshold': '5',
  },

  // Admin Roles
  ADMIN_ROLES: {
    SUPER_ADMIN: {
      name: 'Super Admin',
      description: 'Full platform access',
      permissions: ['*'],
    },
    ADMIN: {
      name: 'Admin',
      description: 'Manage users and settings',
      permissions: [
        'users.read', 'users.write', 'users.delete',
        'settings.read', 'settings.write',
        'analytics.read',
        'billing.read',
        'support.read', 'support.write',
      ],
    },
    SUPPORT: {
      name: 'Support',
      description: 'Customer support access',
      permissions: [
        'users.read',
        'analytics.read',
        'support.read', 'support.write',
      ],
    },
    ANALYST: {
      name: 'Analyst',
      description: 'View-only analytics access',
      permissions: [
        'analytics.read',
        'users.read',
      ],
    },
  },
};

// Helper to get plan config
export function getPlanConfig(planKey: string) {
  return ADMIN_CONFIG.PLAN_TEMPLATES[planKey as keyof typeof ADMIN_CONFIG.PLAN_TEMPLATES];
}

// Helper to get AI provider config
export function getAIProviderConfig(providerKey: string) {
  return ADMIN_CONFIG.AI_PROVIDERS[providerKey as keyof typeof ADMIN_CONFIG.AI_PROVIDERS];
}

// Helper to get payment provider config
export function getPaymentProviderConfig(providerKey: string) {
  return ADMIN_CONFIG.PAYMENT_PROVIDERS[providerKey as keyof typeof ADMIN_CONFIG.PAYMENT_PROVIDERS];
}
