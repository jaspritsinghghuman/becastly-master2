import { prisma } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/crypto';
import { z } from 'zod';
import { Channel } from '@prisma/client';

// Validation schemas for each channel
const whatsappConfigSchema = z.object({
  phoneNumberId: z.string(),
  accessToken: z.string(),
});

const emailConfigSchema = z.object({
  host: z.string(),
  port: z.string(),
  user: z.string().email(),
  pass: z.string(),
  secure: z.boolean().optional(),
  fromName: z.string().optional(),
});

const telegramConfigSchema = z.object({
  botToken: z.string(),
});

const smsConfigSchema = z.object({
  accountSid: z.string(),
  authToken: z.string(),
  phoneNumber: z.string(),
});

export const createIntegrationSchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'TELEGRAM', 'SMS']),
  provider: z.string(),
  config: z.record(z.any()),
  isActive: z.boolean().optional(),
});

export type IntegrationInput = z.infer<typeof createIntegrationSchema>;

export async function getIntegrations(userId: string) {
  const integrations = await prisma.integration.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return integrations.map(int => ({
    ...int,
    config: undefined, // Don't return encrypted config
    isConfigured: true,
  }));
}

export async function getIntegration(userId: string, integrationId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  return {
    ...integration,
    config: undefined,
  };
}

export async function createIntegration(userId: string, data: IntegrationInput) {
  // Validate config based on channel
  validateConfig(data.channel, data.config);

  // Check if integration already exists
  const existing = await prisma.integration.findFirst({
    where: {
      userId,
      channel: data.channel,
      provider: data.provider,
    },
  });

  if (existing) {
    throw new Error(`Integration for ${data.channel} with ${data.provider} already exists`);
  }

  // Encrypt config
  const encryptedConfig = encrypt(JSON.stringify(data.config));

  return prisma.integration.create({
    data: {
      userId,
      channel: data.channel,
      provider: data.provider,
      config: encryptedConfig,
      isActive: true,
    },
  });
}

export async function updateIntegration(
  userId: string,
  integrationId: string,
  data: Partial<IntegrationInput>
) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  const updateData: any = {};

  if (data.config) {
    validateConfig(integration.channel, data.config);
    updateData.config = encrypt(JSON.stringify(data.config));
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  return prisma.integration.update({
    where: { id: integrationId },
    data: updateData,
  });
}

export async function deleteIntegration(userId: string, integrationId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  await prisma.integration.delete({
    where: { id: integrationId },
  });

  return { success: true };
}

export async function toggleIntegration(userId: string, integrationId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  return prisma.integration.update({
    where: { id: integrationId },
    data: { isActive: !integration.isActive },
  });
}

export async function testIntegration(userId: string, integrationId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, userId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  // Decrypt config
  const config = JSON.parse(decrypt(integration.config));

  // Test based on channel
  switch (integration.channel) {
    case 'WHATSAPP':
      return testWhatsApp(config);
    case 'EMAIL':
      return testEmail(config);
    case 'TELEGRAM':
      return testTelegram(config);
    case 'SMS':
      return testSMS(config);
    default:
      throw new Error(`Unsupported channel: ${integration.channel}`);
  }
}

function validateConfig(channel: Channel, config: any) {
  try {
    switch (channel) {
      case 'WHATSAPP':
        whatsappConfigSchema.parse(config);
        break;
      case 'EMAIL':
        emailConfigSchema.parse(config);
        break;
      case 'TELEGRAM':
        telegramConfigSchema.parse(config);
        break;
      case 'SMS':
        smsConfigSchema.parse(config);
        break;
    }
  } catch (error: any) {
    throw new Error(`Invalid config for ${channel}: ${error.message}`);
  }
}

// Test functions
async function testWhatsApp(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const axios = (await import('axios')).default;
    
    await axios.get(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

async function testEmail(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const nodemailer = (await import('nodemailer')).default;
    
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port),
      secure: config.secure === true || config.port === '465',
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.verify();
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function testTelegram(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const axios = (await import('axios')).default;
    
    const response = await axios.get(
      `https://api.telegram.org/bot${config.botToken}/getMe`
    );

    if (response.data.ok) {
      return { success: true };
    }
    
    return {
      success: false,
      error: response.data.description,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.description || error.message,
    };
  }
}

async function testSMS(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    // Just validate credentials format
    if (!config.accountSid.startsWith('AC')) {
      return {
        success: false,
        error: 'Invalid Account SID format',
      };
    }
    
    // We could make a test API call here, but that might incur charges
    // So we'll just do basic validation
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
