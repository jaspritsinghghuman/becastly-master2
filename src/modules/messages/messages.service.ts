import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { Channel } from '@prisma/client';

// WhatsApp (Meta Cloud API)
export async function sendWhatsAppMessage(
  phone: string,
  content: string,
  config: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const { phoneNumberId, accessToken } = config;
    
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { body: content },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      externalId: response.data.messages?.[0]?.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

// Email (SMTP/Gmail)
export async function sendEmail(
  to: string,
  subject: string,
  content: string,
  config: any,
  unsubscribeUrl?: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const { host, port, user, pass, secure } = config;
    
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: secure === true || port === '465',
      auth: { user, pass },
    });

    // Replace unsubscribe variable
    let htmlContent = content
      .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl || '#')
      .replace(/\{unsubscribe_url\}/g, unsubscribeUrl || '#');

    // Add unsubscribe header
    const info = await transporter.sendMail({
      from: `"${config.fromName || 'Becastly'}" <${user}>`,
      to,
      subject,
      html: htmlContent,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl || '#'}>`,
      },
    });

    return {
      success: true,
      externalId: info.messageId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Telegram Bot
export async function sendTelegramMessage(
  chatId: string,
  content: string,
  config: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const { botToken } = config;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: content,
        parse_mode: 'HTML',
      }
    );

    if (!response.data.ok) {
      throw new Error(response.data.description);
    }

    return {
      success: true,
      externalId: String(response.data.result.message_id),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.description || error.message,
    };
  }
}

// SMS (Twilio)
export async function sendSMS(
  to: string,
  content: string,
  config: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const { accountSid, authToken, phoneNumber } = config;
    
    const client = twilio(accountSid, authToken);
    
    const message = await client.messages.create({
      body: content + '\n\nReply STOP to opt-out',
      from: phoneNumber,
      to,
    });

    return {
      success: true,
      externalId: message.sid,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Send message based on channel
export async function sendMessage(
  messageId: string,
  channel: Channel,
  content: string,
  contact: any,
  integrationConfig: string,
  campaign?: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  // Decrypt config
  const config = JSON.parse(decrypt(integrationConfig));

  let result: { success: boolean; externalId?: string; error?: string };

  switch (channel) {
    case 'WHATSAPP':
      result = await sendWhatsAppMessage(contact.phone!, content, config);
      break;
    
    case 'EMAIL':
      const unsubscribeUrl = `${process.env.APP_URL}/unsubscribe?contact=${contact.id}`;
      result = await sendEmail(
        contact.email!,
        campaign?.subject || 'Message from Becastly',
        content,
        config,
        unsubscribeUrl
      );
      break;
    
    case 'TELEGRAM':
      result = await sendTelegramMessage(contact.telegramId!, content, config);
      break;
    
    case 'SMS':
      result = await sendSMS(contact.phone!, content, config);
      break;
    
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }

  // Update message status
  await prisma.message.update({
    where: { id: messageId },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      externalId: result.externalId,
      errorMessage: result.error,
      sentAt: result.success ? new Date() : undefined,
      failedAt: result.success ? undefined : new Date(),
    },
  });

  return result;
}

// Process single message
export async function processMessage(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      contact: true,
      campaign: true,
    },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (message.status !== 'PENDING' && message.status !== 'QUEUED') {
    throw new Error(`Message is not in a sendable state: ${message.status}`);
  }

  // Update status to QUEUED
  await prisma.message.update({
    where: { id: messageId },
    data: { status: 'QUEUED' },
  });

  // Get integration (tenant-scoped)
  const integration = await prisma.integration.findFirst({
    where: {
      tenantId: message.tenantId,
      userId: message.campaign.userId,
      channel: message.channel,
      isActive: true,
    },
  });

  if (!integration) {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        errorMessage: 'No active integration found',
        failedAt: new Date(),
      },
    });
    return { success: false, error: 'No active integration found' };
  }

  // Process template variables
  let content = message.content;
  const contact = message.contact;
  
  content = content
    .replace(/\{name\}/g, contact.name || '')
    .replace(/\{email\}/g, contact.email || '')
    .replace(/\{phone\}/g, contact.phone || '');

  // Send the message
  return sendMessage(
    messageId,
    message.channel,
    content,
    contact,
    integration.config,
    message.campaign
  );
}

// Send single message directly (for API)
export async function sendSingleMessage(
  userId: string,
  data: {
    channel: Channel;
    to: string;
    content: string;
    subject?: string;
  }
) {
  const { channel, to, content, subject } = data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Get integration
  const integration = await prisma.integration.findFirst({
    where: {
      tenantId: user.tenantId,
      userId,
      channel,
      isActive: true,
    },
  });

  if (!integration) {
    throw new Error(`No active ${channel.toLowerCase()} integration found`);
  }

  // Decrypt config
  const config = JSON.parse(decrypt(integration.config));

  let result: { success: boolean; externalId?: string; error?: string };

  switch (channel) {
    case 'WHATSAPP':
      result = await sendWhatsAppMessage(to, content, config);
      break;
    
    case 'EMAIL':
      result = await sendEmail(to, subject || 'Message', content, config);
      break;
    
    case 'TELEGRAM':
      result = await sendTelegramMessage(to, content, config);
      break;
    
    case 'SMS':
      result = await sendSMS(to, content, config);
      break;
    
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }

  return result;
}
