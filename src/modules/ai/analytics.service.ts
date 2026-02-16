import { prisma } from '../../lib/prisma';
import { Channel } from '@prisma/client';

export interface DashboardStats {
  // Overview
  totalContacts: number;
  activeContacts: number;
  newContactsToday: number;
  newContactsThisWeek: number;
  newContactsThisMonth: number;

  // Messaging
  totalMessagesSent: number;
  messagesSentToday: number;
  deliveryRate: number;
  replyRate: number;

  // AI
  aiConversations: number;
  aiHandledMessages: number;
  aiSatisfaction: number;

  // Revenue
  totalRevenue: number;
  revenueThisMonth: number;
  pendingPayments: number;
  averageOrderValue: number;

  // Campaigns
  activeCampaigns: number;
  totalCampaigns: number;
  campaignSuccessRate: number;

  // Voice
  totalCalls: number;
  callsCompleted: number;
  avgCallDuration: number;
  callSuccessRate: number;

  // Lead Quality
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  leadConversionRate: number;
}

export interface TimeSeriesData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
}

class AnalyticsService {
  // ==================== DASHBOARD STATS ====================

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const [
      contactStats,
      messageStats,
      conversationStats,
      revenueStats,
      campaignStats,
      callStats,
      leadStats,
    ] = await Promise.all([
      this.getContactStats(userId, today, weekAgo, monthAgo),
      this.getMessageStats(userId),
      this.getConversationStats(userId),
      this.getRevenueStats(userId, monthAgo),
      this.getCampaignStats(userId),
      this.getCallStats(userId),
      this.getLeadStats(userId),
    ]);

    return {
      ...contactStats,
      ...messageStats,
      ...conversationStats,
      ...revenueStats,
      ...campaignStats,
      ...callStats,
      ...leadStats,
    };
  }

  private async getContactStats(userId: string, today: Date, weekAgo: Date, monthAgo: Date) {
    const [
      totalContacts,
      activeContacts,
      newToday,
      newThisWeek,
      newThisMonth,
    ] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.contact.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.contact.count({ where: { userId, createdAt: { gte: today } } }),
      prisma.contact.count({ where: { userId, createdAt: { gte: weekAgo } } }),
      prisma.contact.count({ where: { userId, createdAt: { gte: monthAgo } } }),
    ]);

    return {
      totalContacts,
      activeContacts,
      newContactsToday: newToday,
      newContactsThisWeek: newThisWeek,
      newContactsThisMonth: newThisMonth,
    };
  }

  private async getMessageStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalMessages,
      messagesToday,
      deliveredMessages,
      repliedMessages,
    ] = await Promise.all([
      prisma.message.count({
        where: {
          campaign: { userId },
        },
      }),
      prisma.message.count({
        where: {
          campaign: { userId },
          createdAt: { gte: today },
        },
      }),
      prisma.message.count({
        where: {
          campaign: { userId },
          status: 'DELIVERED',
        },
      }),
      prisma.message.count({
        where: {
          campaign: { userId },
          replyReceived: true,
        },
      }),
    ]);

    return {
      totalMessagesSent: totalMessages,
      messagesSentToday: messagesToday,
      deliveryRate: totalMessages > 0 ? Math.round((deliveredMessages / totalMessages) * 100) : 0,
      replyRate: deliveredMessages > 0 ? Math.round((repliedMessages / deliveredMessages) * 100) : 0,
    };
  }

  private async getConversationStats(userId: string) {
    const [
      totalConversations,
      aiHandled,
    ] = await Promise.all([
      prisma.conversation.count({ where: { userId } }),
      prisma.conversation.count({ where: { userId, aiEnabled: true } }),
    ]);

    const aiMessages = await prisma.chatMessage.count({
      where: {
        conversation: { userId },
        aiGenerated: true,
      },
    });

    return {
      aiConversations: totalConversations,
      aiHandledMessages: aiMessages,
      aiSatisfaction: 85, // Placeholder - would calculate from feedback
    };
  }

  private async getRevenueStats(userId: string, since: Date) {
    const [
      totalRevenue,
      revenueThisMonth,
      pendingPayments,
      avgOrderValue,
    ] = await Promise.all([
      prisma.paymentIntent.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
        },
        _sum: { paidAmount: true },
      }),
      prisma.paymentIntent.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          paidAt: { gte: since },
        },
        _sum: { paidAmount: true },
      }),
      prisma.paymentIntent.count({
        where: {
          userId,
          status: { in: ['PENDING', 'AWAITING_PAYMENT'] },
        },
      }),
      prisma.paymentIntent.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
        },
        _avg: { paidAmount: true },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.paidAmount || 0,
      revenueThisMonth: revenueThisMonth._sum.paidAmount || 0,
      pendingPayments,
      averageOrderValue: avgOrderValue._avg.paidAmount || 0,
    };
  }

  private async getCampaignStats(userId: string) {
    const [
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
    ] = await Promise.all([
      prisma.campaign.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId, status: 'RUNNING' } }),
      prisma.campaign.count({ where: { userId, status: 'COMPLETED' } }),
    ]);

    return {
      totalCampaigns,
      activeCampaigns,
      campaignSuccessRate: totalCampaigns > 0 ? Math.round((completedCampaigns / totalCampaigns) * 100) : 0,
    };
  }

  private async getCallStats(userId: string) {
    const [
      totalCalls,
      completedCalls,
      avgDuration,
    ] = await Promise.all([
      prisma.voiceCall.count({ where: { userId } }),
      prisma.voiceCall.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.voiceCall.aggregate({
        where: { userId, status: 'COMPLETED' },
        _avg: { duration: true },
      }),
    ]);

    return {
      totalCalls,
      callsCompleted: completedCalls,
      avgCallDuration: Math.round(avgDuration._avg.duration || 0),
      callSuccessRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
    };
  }

  private async getLeadStats(userId: string) {
    const [
      hotLeads,
      warmLeads,
      coldLeads,
    ] = await Promise.all([
      prisma.leadScore.count({ where: { userId, tier: 'HOT' } }),
      prisma.leadScore.count({ where: { userId, tier: 'WARM' } }),
      prisma.leadScore.count({ where: { userId, tier: 'COLD' } }),
    ]);

    const totalLeads = hotLeads + warmLeads + coldLeads;

    return {
      hotLeads,
      warmLeads,
      coldLeads,
      leadConversionRate: totalLeads > 0 ? Math.round((hotLeads / totalLeads) * 100) : 0,
    };
  }

  // ==================== TIME SERIES DATA ====================

  async getMessagesOverTime(
    userId: string,
    period: '7d' | '30d' | '90d' = '30d'
  ): Promise<TimeSeriesData> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const data = await this.getDailyStats(userId, days, 'message_sent');

    return {
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'Messages Sent',
          data: data.map(d => d.count),
        },
      ],
    };
  }

  async getRevenueOverTime(
    userId: string,
    period: '7d' | '30d' | '90d' = '30d'
  ): Promise<TimeSeriesData> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const data = await this.getDailyRevenue(userId, days);

    return {
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'Revenue',
          data: data.map(d => d.amount),
        },
      ],
    };
  }

  async getLeadAcquisitionOverTime(
    userId: string,
    period: '7d' | '30d' | '90d' = '30d'
  ): Promise<TimeSeriesData> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const data = await this.getDailyStats(userId, days, 'lead_captured');

    return {
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'New Leads',
          data: data.map(d => d.count),
        },
      ],
    };
  }

  private async getDailyStats(userId: string, days: number, eventType: string) {
    const results = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.analyticsEvent.count({
        where: {
          userId,
          eventType,
          createdAt: {
            gte: date,
            lt: nextDate,
          },
        },
      });

      results.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      });
    }

    return results;
  }

  private async getDailyRevenue(userId: string, days: number) {
    const results = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const revenue = await prisma.paymentIntent.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          paidAt: {
            gte: date,
            lt: nextDate,
          },
        },
        _sum: { paidAmount: true },
      });

      results.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: revenue._sum.paidAmount || 0,
      });
    }

    return results;
  }

  // ==================== CHANNEL ANALYTICS ====================

  async getChannelPerformance(userId: string) {
    const channels = [Channel.WHATSAPP, Channel.EMAIL, Channel.SMS, Channel.TELEGRAM];
    
    const results = await Promise.all(
      channels.map(async (channel) => {
        const [total, delivered, replied] = await Promise.all([
          prisma.message.count({
            where: {
              campaign: { userId },
              channel,
            },
          }),
          prisma.message.count({
            where: {
              campaign: { userId },
              channel,
              status: 'DELIVERED',
            },
          }),
          prisma.message.count({
            where: {
              campaign: { userId },
              channel,
              replyReceived: true,
            },
          }),
        ]);

        return {
          channel,
          total,
          delivered,
          deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
          replyRate: delivered > 0 ? Math.round((replied / delivered) * 100) : 0,
        };
      })
    );

    return results;
  }

  // ==================== CONVERSION FUNNEL ====================

  async getConversionFunnel(userId: string) {
    const [
      totalContacts,
      engagedContacts,
      qualifiedLeads,
      customers,
    ] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.contact.count({
        where: {
          userId,
          lastContactAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.leadScore.count({
        where: {
          userId,
          tier: { in: ['WARM', 'HOT'] },
        },
      }),
      prisma.paymentIntent.count({
        where: {
          userId,
          status: 'COMPLETED',
        },
      }),
    ]);

    return [
      { stage: 'Total Contacts', count: totalContacts, percentage: 100 },
      { stage: 'Engaged (30d)', count: engagedContacts, percentage: totalContacts > 0 ? Math.round((engagedContacts / totalContacts) * 100) : 0 },
      { stage: 'Qualified Leads', count: qualifiedLeads, percentage: totalContacts > 0 ? Math.round((qualifiedLeads / totalContacts) * 100) : 0 },
      { stage: 'Customers', count: customers, percentage: totalContacts > 0 ? Math.round((customers / totalContacts) * 100) : 0 },
    ];
  }

  // ==================== EVENT TRACKING ====================

  async trackEvent(
    userId: string,
    eventType: string,
    data?: {
      contactId?: string;
      campaignId?: string;
      channel?: Channel;
      revenue?: number;
      cost?: number;
      metadata?: Record<string, any>;
    }
  ) {
    return prisma.analyticsEvent.create({
      data: {
        userId,
        eventType,
        contactId: data?.contactId,
        campaignId: data?.campaignId,
        channel: data?.channel,
        revenue: data?.revenue,
        cost: data?.cost,
        eventData: data?.metadata ? JSON.stringify(data.metadata) : '{}',
      },
    });
  }

  // ==================== ROI CALCULATION ====================

  async getROICalculation(userId: string, period: 'month' | 'quarter' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
    }

    const [
      revenue,
      costs,
      newCustomers,
    ] = await Promise.all([
      prisma.paymentIntent.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          paidAt: { gte: startDate },
        },
        _sum: { paidAmount: true },
      }),
      prisma.analyticsEvent.aggregate({
        where: {
          userId,
          createdAt: { gte: startDate },
        },
        _sum: { cost: true },
      }),
      prisma.analyticsEvent.count({
        where: {
          userId,
          eventType: 'payment_received',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    const totalRevenue = revenue._sum.paidAmount || 0;
    const totalCosts = costs._sum.cost || 0;
    const profit = totalRevenue - totalCosts;
    const roi = totalCosts > 0 ? ((profit / totalCosts) * 100) : 0;
    const cac = newCustomers > 0 ? (totalCosts / newCustomers) : 0;

    return {
      period,
      revenue: totalRevenue,
      costs: totalCosts,
      profit,
      roi: Math.round(roi),
      newCustomers,
      cac: Math.round(cac * 100) / 100,
    };
  }
}

export const analyticsService = new AnalyticsService();
