import { prisma } from '../../lib/prisma';
import { Channel, SubscriptionStatus, InvoiceStatus, Plan } from '@prisma/client';

export interface AdminDashboardStats {
  // User Metrics
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  
  // Revenue Metrics
  mrr: number;
  arr: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  
  // Subscription Metrics
  totalSubscriptions: number;
  trialUsers: number;
  paidUsers: number;
  churnedUsers: number;
  churnRate: number;
  
  // Message Metrics
  totalMessagesSent: number;
  messagesSentToday: number;
  messagesByChannel: Record<Channel, number>;
  deliveryRate: number;
  
  // System Health
  queueJobsPending: number;
  queueJobsFailed: number;
  apiLatency: number;
  dbConnections: number;
}

export interface UserGrowthData {
  date: string;
  signups: number;
  active: number;
  churned: number;
}

export interface RevenueBreakdown {
  byPlan: Record<string, number>;
  byGateway: Record<string, number>;
  refunds: number;
  discounts: number;
}

export interface TopCustomer {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  mrr: number;
  totalPaid: number;
  messagesSent: number;
}

class AdminAnalyticsService {
  // ==================== MAIN DASHBOARD STATS ====================

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const [
      userStats,
      revenueStats,
      subscriptionStats,
      messageStats,
      systemHealth,
    ] = await Promise.all([
      this.getUserStats(today, weekAgo, monthAgo),
      this.getRevenueStats(today, weekAgo, monthAgo),
      this.getSubscriptionStats(),
      this.getMessageStats(today),
      this.getSystemHealth(),
    ]);

    return {
      ...userStats,
      ...revenueStats,
      ...subscriptionStats,
      ...messageStats,
      ...systemHealth,
    };
  }

  private async getUserStats(today: Date, weekAgo: Date, monthAgo: Date) {
    const [
      totalUsers,
      activeUsers,
      newToday,
      newThisWeek,
      newThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          sessions: {
            some: {
              expiresAt: { gt: new Date() },
            },
          },
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersToday: newToday,
      newUsersThisWeek: newThisWeek,
      newUsersThisMonth: newThisMonth,
    };
  }

  private async getRevenueStats(today: Date, weekAgo: Date, monthAgo: Date) {
    // Get paid invoices
    const [
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      totalMRR,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: today },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: weekAgo },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: monthAgo },
        },
        _sum: { amount: true },
      }),
      this.calculateMRR(),
    ]);

    return {
      mrr: totalMRR,
      arr: totalMRR * 12,
      revenueToday: revenueToday._sum.amount?.toNumber() || 0,
      revenueThisWeek: revenueThisWeek._sum.amount?.toNumber() || 0,
      revenueThisMonth: revenueThisMonth._sum.amount?.toNumber() || 0,
    };
  }

  private async calculateMRR(): Promise<number> {
    // Get all active subscriptions with their plan prices
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        invoices: {
          where: { status: InvoiceStatus.PAID },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Calculate MRR based on last invoice amount
    let mrr = 0;
    for (const sub of subscriptions) {
      const lastInvoice = sub.invoices[0];
      if (lastInvoice) {
        // Assume monthly for now - could be enhanced with billing cycle info
        mrr += lastInvoice.amount.toNumber();
      }
    }

    return mrr;
  }

  private async getSubscriptionStats() {
    const [
      totalSubscriptions,
      trialUsers,
      paidUsers,
      churnedLastMonth,
      totalLastMonth,
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.CANCELED,
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.subscription.count({
        where: {
          createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const churnRate = totalLastMonth > 0 ? (churnedLastMonth / totalLastMonth) * 100 : 0;

    return {
      totalSubscriptions,
      trialUsers,
      paidUsers,
      churnedUsers: churnedLastMonth,
      churnRate: Math.round(churnRate * 100) / 100,
    };
  }

  private async getMessageStats(today: Date) {
    const [
      totalMessages,
      messagesToday,
      deliveredMessages,
    ] = await Promise.all([
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: today } } }),
      prisma.message.count({ where: { status: 'DELIVERED' } }),
    ]);

    // Messages by channel
    const byChannel = await prisma.message.groupBy({
      by: ['channel'],
      _count: { channel: true },
    });

    const messagesByChannel = byChannel.reduce((acc: any, item) => {
      acc[item.channel] = item._count.channel;
      return acc;
    }, {});

    return {
      totalMessagesSent: totalMessages,
      messagesSentToday: messagesToday,
      messagesByChannel,
      deliveryRate: totalMessages > 0 ? Math.round((deliveredMessages / totalMessages) * 100) : 0,
    };
  }

  private async getSystemHealth() {
    // These would integrate with actual monitoring
    // For now, return placeholder values
    return {
      queueJobsPending: 0,
      queueJobsFailed: 0,
      apiLatency: 45, // ms
      dbConnections: 5,
    };
  }

  // ==================== USER ANALYTICS ====================

  async getUserGrowth(days: number = 30): Promise<UserGrowthData[]> {
    const results: UserGrowthData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [
        signups,
        active,
        churned,
      ] = await Promise.all([
        prisma.user.count({
          where: { createdAt: { gte: date, lt: nextDate } },
        }),
        prisma.session.count({
          where: {
            expiresAt: { gt: date },
            createdAt: { lt: nextDate },
          },
          distinct: ['userId'],
        }),
        prisma.subscription.count({
          where: {
            status: SubscriptionStatus.CANCELED,
            updatedAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      results.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        signups,
        active,
        churned,
      });
    }

    return results;
  }

  async getUserRetention(cohortDays: number = 30): Promise<any[]> {
    // Simplified retention analysis
    const cohorts = [];
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const cohortStart = new Date(now);
      cohortStart.setDate(cohortStart.getDate() - (i + 1) * cohortDays);
      
      const cohortEnd = new Date(cohortStart);
      cohortEnd.setDate(cohortEnd.getDate() + cohortDays);

      const cohortUsers = await prisma.user.findMany({
        where: {
          createdAt: { gte: cohortStart, lt: cohortEnd },
        },
        select: { id: true },
      });

      const cohortSize = cohortUsers.length;
      if (cohortSize === 0) continue;

      const userIds = cohortUsers.map(u => u.id);

      // Check who was active in the last 7 days
      const retained = await prisma.session.count({
        where: {
          userId: { in: userIds },
          expiresAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        distinct: ['userId'],
      });

      cohorts.push({
        cohort: `${cohortStart.toLocaleDateString()} - ${cohortEnd.toLocaleDateString()}`,
        size: cohortSize,
        retained,
        retentionRate: Math.round((retained / cohortSize) * 100),
      });
    }

    return cohorts;
  }

  // ==================== REVENUE ANALYTICS ====================

  async getRevenueBreakdown(): Promise<RevenueBreakdown> {
    const [
      byPlan,
      byGateway,
      refunds,
    ] = await Promise.all([
      this.getRevenueByPlan(),
      this.getRevenueByGateway(),
      this.getRefundAmount(),
    ]);

    return {
      byPlan,
      byGateway,
      refunds,
      discounts: 0, // Would track discounts separately
    };
  }

  private async getRevenueByPlan(): Promise<Record<string, number>> {
    const subscriptions = await prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: {
        user: true,
      },
    });

    const byPlan: Record<string, number> = {};
    for (const sub of subscriptions) {
      const plan = sub.user.plan;
      if (!byPlan[plan]) byPlan[plan] = 0;
      // Add MRR for this plan
      byPlan[plan] += 0; // Would get actual amount from plan config
    }

    return byPlan;
  }

  private async getRevenueByGateway(): Promise<Record<string, number>> {
    const invoices = await prisma.invoice.findMany({
      where: { status: InvoiceStatus.PAID },
      include: {
        subscription: {
          include: {
            user: true,
          },
        },
      },
    });

    // This would need payment gateway info on invoices
    // For now, return empty
    return {};
  }

  private async getRefundAmount(): Promise<number> {
    // Would track refunds
    return 0;
  }

  async getRevenueGrowth(days: number = 30): Promise<any[]> {
    const results = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const revenue = await prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: date, lt: nextDate },
        },
        _sum: { amount: true },
      });

      results.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenue._sum.amount?.toNumber() || 0,
      });
    }

    return results;
  }

  async getTopCustomers(limit: number = 10): Promise<TopCustomer[]> {
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
    });

    // Would calculate actual MRR and total paid per user
    return users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name || '',
      plan: u.plan,
      mrr: 0,
      totalPaid: 0,
      messagesSent: 0,
    }));
  }

  // ==================== MESSAGE ANALYTICS ====================

  async getMessageVolume(days: number = 30): Promise<any[]> {
    const results = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const byChannel = await prisma.message.groupBy({
        by: ['channel'],
        where: {
          createdAt: { gte: date, lt: nextDate },
        },
        _count: { channel: true },
      });

      const dayData: any = {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };

      for (const item of byChannel) {
        dayData[item.channel] = item._count.channel;
      }

      results.push(dayData);
    }

    return results;
  }

  async getMessageSuccessRates(): Promise<any> {
    const byChannel = await prisma.message.groupBy({
      by: ['channel', 'status'],
      _count: { status: true },
    });

    const rates: any = {};
    for (const item of byChannel) {
      if (!rates[item.channel]) {
        rates[item.channel] = { total: 0, success: 0, failed: 0 };
      }
      rates[item.channel].total += item._count.status;
      if (item.status === 'DELIVERED' || item.status === 'SENT') {
        rates[item.channel].success += item._count.status;
      } else if (item.status === 'FAILED') {
        rates[item.channel].failed += item._count.status;
      }
    }

    // Calculate percentages
    for (const channel of Object.keys(rates)) {
      const data = rates[channel];
      data.successRate = data.total > 0 ? Math.round((data.success / data.total) * 100) : 0;
      data.failureRate = data.total > 0 ? Math.round((data.failed / data.total) * 100) : 0;
    }

    return rates;
  }

  // ==================== SYSTEM ANALYTICS ====================

  async getSystemMetrics(): Promise<any> {
    // These would integrate with actual monitoring systems
    return {
      api: {
        requestsPerMinute: 120,
        avgResponseTime: 45,
        errorRate: 0.5,
      },
      database: {
        connections: 5,
        slowQueries: 0,
        cacheHitRate: 95,
      },
      queue: {
        pending: 0,
        processing: 0,
        failed: 0,
        processedToday: 1500,
      },
      storage: {
        used: '2.5 GB',
        total: '50 GB',
      },
    };
  }

  async getRecentErrors(limit: number = 10): Promise<any[]> {
    // Would integrate with error tracking (Sentry, etc.)
    return [];
  }

  // ==================== EXPORT DATA ====================

  async exportUserData(format: 'csv' | 'json' = 'csv') {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            contacts: true,
            campaigns: true,
          },
        },
      },
    });

    if (format === 'json') {
      return users;
    }

    // CSV format
    const headers = ['ID', 'Email', 'Name', 'Plan', 'Contacts', 'Campaigns', 'Created At'];
    const rows = users.map(u => [
      u.id,
      u.email,
      u.name || '',
      u.plan,
      u._count.contacts,
      u._count.campaigns,
      u.createdAt.toISOString(),
    ]);

    return { headers, rows };
  }

  async exportRevenueData(format: 'csv' | 'json' = 'csv') {
    const invoices = await prisma.invoice.findMany({
      include: {
        subscription: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return invoices;
    }

    // CSV format
    const headers = ['Invoice ID', 'Customer', 'Amount', 'Currency', 'Status', 'Created At', 'Paid At'];
    const rows = invoices.map(i => [
      i.id,
      i.subscription?.user?.email || 'Unknown',
      i.amount.toString(),
      i.currency,
      i.status,
      i.createdAt.toISOString(),
      i.paidAt?.toISOString() || '',
    ]);

    return { headers, rows };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
