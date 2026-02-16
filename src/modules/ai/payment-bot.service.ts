import { prisma } from '../../lib/prisma';
import { aiService } from './ai.service';
import { PaymentStatus, PaymentProvider, Channel } from '@prisma/client';

export interface PaymentIntentData {
  contactId: string;
  amount: number;
  currency?: string;
  description?: string;
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
}

export interface PaymentLinkOptions {
  expiresIn?: number; // minutes
  redirectUrl?: string;
}

class PaymentBotService {
  // ==================== PAYMENT INTENT ====================

  async createPaymentIntent(
    userId: string,
    data: PaymentIntentData,
    options: PaymentLinkOptions = {}
  ) {
    const { contactId, amount, currency = 'USD', description, items } = data;

    // Validate contact
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Determine payment provider (could be user-configurable)
    const provider = await this.getPaymentProvider(userId);

    // Create checkout session with provider
    const checkout = await this.createCheckoutSession(provider, {
      amount,
      currency,
      description,
      items,
      customerEmail: contact.email,
      metadata: {
        userId,
        contactId,
      },
    });

    // Calculate expiry
    const expiresIn = options.expiresIn || 60; // Default 60 minutes
    const checkoutExpiry = new Date(Date.now() + expiresIn * 60 * 1000);

    // Create payment intent record
    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        userId,
        contactId,
        amount,
        currency,
        description,
        status: PaymentStatus.AWAITING_PAYMENT,
        provider,
        providerId: checkout.id,
        checkoutUrl: checkout.url,
        checkoutExpiry,
      },
    });

    return paymentIntent;
  }

  private async getPaymentProvider(userId: string): Promise<PaymentProvider> {
    // In a real implementation, this would check user's configured gateways
    // For now, default to Stripe
    return PaymentProvider.STRIPE;
  }

  private async createCheckoutSession(
    provider: PaymentProvider,
    data: any
  ): Promise<{ id: string; url: string }> {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return this.createStripeCheckout(data);
      case PaymentProvider.RAZORPAY:
        return this.createRazorpayCheckout(data);
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  private async createStripeCheckout(data: any): Promise<{ id: string; url: string }> {
    // This would use Stripe SDK
    // For now, return a mock response
    console.log('Creating Stripe checkout:', data);
    return {
      id: `pi_${Date.now()}`,
      url: `${process.env.APP_URL}/pay/stripe/session_xxx`,
    };
  }

  private async createRazorpayCheckout(data: any): Promise<{ id: string; url: string }> {
    // This would use Razorpay SDK
    console.log('Creating Razorpay checkout:', data);
    return {
      id: `order_${Date.now()}`,
      url: `${process.env.APP_URL}/pay/razorpay/order_xxx`,
    };
  }

  // ==================== CHATBOT INTEGRATION ====================

  async handlePaymentInquiry(userId: string, contactId: string, inquiry: string) {
    // Use AI to understand the payment inquiry
    const intent = await aiService.analyzeIntent(userId, inquiry);

    switch (intent.intent) {
      case 'purchase':
        return this.handlePurchaseIntent(userId, contactId, inquiry);
      
      case 'question':
        return this.handlePaymentQuestion(userId, contactId, inquiry);
      
      case 'complaint':
        return this.handlePaymentIssue(userId, contactId, inquiry);
      
      default:
        return this.generatePaymentResponse(userId, contactId, inquiry);
    }
  }

  private async handlePurchaseIntent(userId: string, contactId: string, inquiry: string) {
    // Extract product/service info from inquiry
    const extraction = await aiService.generateText(userId, 
      `Extract product/service and price from: "${inquiry}"\nRespond in JSON: {"product": "...", "price": 99.99, "currency": "USD"}`,
      { maxTokens: 100 }
    );

    let productInfo: any = {};
    try {
      productInfo = JSON.parse(extraction.content);
    } catch (e) {
      productInfo = { product: 'Product', price: 0, currency: 'USD' };
    }

    // Create payment intent
    const paymentIntent = await this.createPaymentIntent(userId, {
      contactId,
      amount: productInfo.price,
      currency: productInfo.currency,
      description: productInfo.product,
    });

    // Generate friendly response with payment link
    const response = await aiService.generateText(userId, 
      `Generate a friendly message offering to complete the purchase of ${productInfo.product} for ${productInfo.price} ${productInfo.currency}. Include a payment link placeholder: {payment_link}`,
      { maxTokens: 150 }
    );

    return {
      type: 'payment_link',
      content: response.content.replace('{payment_link}', paymentIntent.checkoutUrl),
      paymentIntentId: paymentIntent.id,
      checkoutUrl: paymentIntent.checkoutUrl,
    };
  }

  private async handlePaymentQuestion(userId: string, contactId: string, question: string) {
    const response = await aiService.generateText(userId, question, {
      systemPrompt: 'You are a helpful payment support assistant. Answer questions about payment methods, security, refunds, and billing clearly and concisely.',
      maxTokens: 200,
    });

    return {
      type: 'answer',
      content: response.content,
    };
  }

  private async handlePaymentIssue(userId: string, contactId: string, complaint: string) {
    // Create support ticket or escalate
    const response = await aiService.generateText(userId, 
      `Generate an empathetic response to this payment issue: "${complaint}". Offer to connect with support and provide a reference number.`,
      { maxTokens: 150 }
    );

    return {
      type: 'escalation',
      content: response.content,
      reference: `SUP-${Date.now()}`,
    };
  }

  private async generatePaymentResponse(userId: string, contactId: string, message: string) {
    const response = await aiService.generateText(userId, message, {
      systemPrompt: 'You are a sales assistant that can help customers with purchases and payments. Be helpful but not pushy.',
      maxTokens: 150,
    });

    return {
      type: 'general',
      content: response.content,
    };
  }

  // ==================== WEBHOOK HANDLING ====================

  async handleWebhook(provider: PaymentProvider, payload: any) {
    const event = this.parseWebhookEvent(provider, payload);

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment.completed':
        await this.handlePaymentSuccess(event.data);
        break;
      
      case 'payment_intent.payment_failed':
      case 'payment.failed':
        await this.handlePaymentFailure(event.data);
        break;
      
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data);
        break;
    }

    return { received: true };
  }

  private parseWebhookEvent(provider: PaymentProvider, payload: any) {
    // Parse webhook payload based on provider
    switch (provider) {
      case PaymentProvider.STRIPE:
        return {
          type: payload.type,
          data: payload.data?.object,
        };
      case PaymentProvider.RAZORPAY:
        return {
          type: payload.event,
          data: payload.payload?.payment?.entity,
        };
      default:
        return { type: 'unknown', data: payload };
    }
  }

  private async handlePaymentSuccess(data: any) {
    const providerId = data.id;
    
    const paymentIntent = await prisma.paymentIntent.findFirst({
      where: { providerId },
    });

    if (!paymentIntent) {
      console.error('Payment intent not found for provider ID:', providerId);
      return;
    }

    await prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        paidAmount: data.amount / 100, // Convert from cents
      },
    });

    // Create analytics event
    await prisma.analyticsEvent.create({
      data: {
        userId: paymentIntent.userId,
        eventType: 'payment_received',
        contactId: paymentIntent.contactId,
        revenue: paymentIntent.amount,
        eventData: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          provider: paymentIntent.provider,
        }),
      },
    });

    // Send confirmation message
    await this.sendPaymentConfirmation(paymentIntent);
  }

  private async handlePaymentFailure(data: any) {
    const providerId = data.id;
    
    await prisma.paymentIntent.updateMany({
      where: { providerId },
      data: {
        status: PaymentStatus.FAILED,
      },
    });
  }

  private async handleCheckoutComplete(data: any) {
    // Similar to payment success, but for checkout sessions
    console.log('Checkout completed:', data);
  }

  private async sendPaymentConfirmation(paymentIntent: any) {
    // Get contact
    const contact = await prisma.contact.findUnique({
      where: { id: paymentIntent.contactId },
    });

    if (!contact) return;

    // Generate thank you message
    const response = await aiService.generateText(
      paymentIntent.userId,
      `Generate a warm thank you message for a purchase of ${paymentIntent.amount} ${paymentIntent.currency}.`,
      { maxTokens: 150 }
    );

    // Send via appropriate channel (would integrate with message service)
    console.log(`[Payment Confirmation to ${contact.phone || contact.email}]: ${response.content}`);
  }

  // ==================== QUERIES ====================

  async getPaymentIntents(
    userId: string,
    options?: {
      status?: PaymentStatus;
      contactId?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const { status, contactId, limit = 20, offset = 0 } = options || {};

    const where: any = { userId };
    if (status) where.status = status;
    if (contactId) where.contactId = contactId;

    const [intents, total] = await Promise.all([
      prisma.paymentIntent.findMany({
        where,
        include: {
          contact: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.paymentIntent.count({ where }),
    ]);

    return {
      intents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getPaymentIntent(userId: string, intentId: string) {
    const intent = await prisma.paymentIntent.findFirst({
      where: { id: intentId, userId },
      include: { contact: true },
    });

    if (!intent) {
      throw new Error('Payment intent not found');
    }

    return intent;
  }

  // ==================== ANALYTICS ====================

  async getRevenueStats(userId: string, period: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    const [
      totalRevenue,
      completedPayments,
      failedPayments,
      pendingPayments,
    ] = await Promise.all([
      prisma.paymentIntent.aggregate({
        where: {
          userId,
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: startDate },
        },
        _sum: { paidAmount: true },
      }),
      prisma.paymentIntent.count({
        where: {
          userId,
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: startDate },
        },
      }),
      prisma.paymentIntent.count({
        where: {
          userId,
          status: PaymentStatus.FAILED,
          createdAt: { gte: startDate },
        },
      }),
      prisma.paymentIntent.count({
        where: {
          userId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.AWAITING_PAYMENT] },
        },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.paidAmount || 0,
      completed: completedPayments,
      failed: failedPayments,
      pending: pendingPayments,
      conversionRate: completedPayments + failedPayments > 0
        ? Math.round((completedPayments / (completedPayments + failedPayments)) * 100)
        : 0,
    };
  }
}

export const paymentBotService = new PaymentBotService();
