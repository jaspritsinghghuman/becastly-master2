import { prisma } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/crypto';
import { SubscriptionStatus, InvoiceStatus, Plan } from '@prisma/client';
import Stripe from 'stripe';
import Razorpay from 'razorpay';

// Initialize Stripe if key exists
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
}

// Initialize Razorpay if credentials exist
let razorpay: Razorpay | null = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export interface CreateSubscriptionInput {
  userId: string;
  plan: Plan;
  billingCycle: 'monthly' | 'yearly';
  paymentMethod: 'stripe' | 'razorpay' | 'paypal';
  trialDays?: number;
}

export interface PlanPricing {
  plan: Plan;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
}

class BillingService {
  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async createSubscription(data: CreateSubscriptionInput) {
    const { userId, plan, billingCycle, paymentMethod, trialDays = 14 } = data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has a subscription
    if (user.subscription) {
      throw new Error('User already has a subscription. Use upgrade instead.');
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (trialDays || 0) * 24 * 60 * 60 * 1000);
    const periodEnd = billingCycle === 'yearly'
      ? new Date(trialEndsAt.getFullYear() + 1, trialEndsAt.getMonth(), trialEndsAt.getDate())
      : new Date(trialEndsAt.getFullYear(), trialEndsAt.getMonth() + 1, trialEndsAt.getDate());

    // Create subscription record
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        plan,
        status: trialDays ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        trialEndsAt: trialDays ? trialEndsAt : null,
        currentPeriodStart: trialEndsAt || now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    // Update user's plan
    await prisma.user.update({
      where: { id: userId },
      data: { plan },
    });

    return subscription;
  }

  async upgradeSubscription(userId: string, newPlan: Plan) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Update subscription
    await prisma.subscription.update({
      where: { userId },
      data: { plan: newPlan },
    });

    // Update user's plan
    await prisma.user.update({
      where: { id: userId },
      data: { plan: newPlan },
    });

    return { success: true, message: `Upgraded to ${newPlan}` };
  }

  async cancelSubscription(userId: string, atPeriodEnd: boolean = true) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: atPeriodEnd,
        status: atPeriodEnd ? subscription.status : SubscriptionStatus.CANCELED,
      },
    });

    return {
      success: true,
      message: atPeriodEnd
        ? 'Subscription will cancel at period end'
        : 'Subscription canceled immediately',
    };
  }

  async reactivateSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error('No subscription found');
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
      },
    });

    return { success: true, message: 'Subscription reactivated' };
  }

  // ==================== INVOICE MANAGEMENT ====================

  async getInvoices(userId: string, options?: { status?: InvoiceStatus; limit?: number }) {
    const { status, limit = 20 } = options || {};

    const where: any = {
      subscription: { userId },
    };
    if (status) where.status = status;

    return prisma.invoice.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(invoiceId: string) {
    return prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            user: {
              select: { email: true, name: true },
            },
          },
        },
      },
    });
  }

  async createInvoice(data: {
    subscriptionId: string;
    amount: number;
    currency: string;
    description?: string;
  }) {
    return prisma.invoice.create({
      data: {
        subscriptionId: data.subscriptionId,
        amount: data.amount,
        currency: data.currency,
        status: InvoiceStatus.PENDING,
      },
    });
  }

  async markInvoicePaid(invoiceId: string, providerId?: string) {
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        stripeInvoiceId: providerId,
        paidAt: new Date(),
      },
    });
  }

  async generateInvoicePDF(invoiceId: string): Promise<string> {
    // Would generate PDF and return URL
    // For now, return placeholder
    return `${process.env.APP_URL}/invoices/${invoiceId}.pdf`;
  }

  // ==================== USAGE TRACKING ====================

  async getUsage(userId: string, year?: number, month?: number) {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    const usage = await prisma.usageRecord.findUnique({
      where: {
        userId_month_year: {
          userId,
          month: targetMonth,
          year: targetYear,
        },
      },
    });

    if (!usage) {
      // Get user's plan limit
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      return {
        userId,
        month: targetMonth,
        year: targetYear,
        messagesSent: 0,
        messagesLimit: user?.dailyQuota || 100,
        overageCount: 0,
        overageCost: 0,
        aiTokensUsed: 0,
        aiCost: 0,
        voiceMinutes: 0,
        voiceCost: 0,
      };
    }

    return usage;
  }

  async trackMessageUsage(userId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await prisma.usageRecord.upsert({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
      create: {
        userId,
        month,
        year,
        messagesSent: 1,
        messagesLimit: 100, // Would get from plan
      },
      update: {
        messagesSent: { increment: 1 },
      },
    });
  }

  async trackAIUsage(userId: string, tokens: number, cost: number) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await prisma.usageRecord.upsert({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
      create: {
        userId,
        month,
        year,
        aiTokensUsed: tokens,
        aiCost: cost,
        messagesSent: 0,
        messagesLimit: 100,
      },
      update: {
        aiTokensUsed: { increment: tokens },
        aiCost: { increment: cost },
      },
    });
  }

  // ==================== PLAN PRICING ====================

  async getPlanPricing(): Promise<PlanPricing[]> {
    // Get from system settings or return defaults
    return [
      { plan: Plan.FREE, monthlyPrice: 0, yearlyPrice: 0, currency: 'USD' },
      { plan: Plan.STARTER, monthlyPrice: 19, yearlyPrice: 190, currency: 'USD' },
      { plan: Plan.GROWTH, monthlyPrice: 49, yearlyPrice: 490, currency: 'USD' },
      { plan: Plan.PRO, monthlyPrice: 99, yearlyPrice: 990, currency: 'USD' },
      { plan: Plan.AGENCY, monthlyPrice: 199, yearlyPrice: 1990, currency: 'USD' },
    ];
  }

  async setPlanPricing(pricing: PlanPricing[]) {
    // Would save to system settings
    return { success: true };
  }

  // ==================== CHECKOUT ====================

  async createCheckoutSession(userId: string, plan: Plan, billingCycle: 'monthly' | 'yearly') {
    // This would integrate with Stripe/Razorpay to create a checkout session
    // For now, return placeholder
    return {
      sessionId: `sess_${Date.now()}`,
      url: `${process.env.APP_URL}/checkout/${plan.toLowerCase()}?cycle=${billingCycle}`,
    };
  }

  async createCustomerPortalSession(userId: string) {
    // Stripe Customer Portal
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL}/dashboard/billing`,
    });

    return { url: session.url };
  }

  // ==================== WEBHOOK HANDLING ====================

  async handleStripeWebhook(payload: any, signature: string) {
    if (!stripe) {
      throw new Error('Stripe not configured');
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object);
        break;
    }

    return { received: true };
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    // Update invoice status
    if (invoice.subscription) {
      const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (subscription) {
        await prisma.invoice.create({
          data: {
            subscriptionId: subscription.id,
            amount: (invoice.amount_due || 0) / 100,
            currency: invoice.currency.toUpperCase(),
            status: InvoiceStatus.PAID,
            stripeInvoiceId: invoice.id,
            paidAt: new Date(),
          },
        });
      }
    }
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice) {
    // Handle failed payment
    if (invoice.subscription) {
      const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
      }
    }
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.CANCELED },
      });
    }
  }

  async handleRazorpayWebhook(payload: any, signature: string) {
    // Verify webhook signature
    // Process event
    return { received: true };
  }
}

export const billingService = new BillingService();
