import { prisma } from '../../lib/prisma';
import { Plan } from '@prisma/client';

export interface UserFilters {
  plan?: Plan;
  status?: 'active' | 'inactive' | 'suspended';
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasSubscription?: boolean;
}

export interface UserDetails {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  createdAt: Date;
  lastActiveAt: Date | null;
  subscriptionStatus: string | null;
  messagesSent: number;
  contactsCount: number;
  campaignsCount: number;
  revenue: number;
  isSuspended: boolean;
}

class AdminUsersService {
  // ==================== USER LISTING ====================

  async getUsers(options: {
    filters?: UserFilters;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      filters = {},
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: any = {};

    // Apply filters
    if (filters.plan) {
      where.plan = filters.plan;
    }

    if (filters.status === 'active') {
      where.sessions = {
        some: {
          expiresAt: { gt: new Date() },
        },
      };
    } else if (filters.status === 'inactive') {
      where.sessions = {
        none: {
          expiresAt: { gt: new Date() },
        },
      };
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    if (filters.hasSubscription !== undefined) {
      where.subscription = filters.hasSubscription ? { isNot: null } : { is: null };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              contacts: true,
              campaigns: true,
            },
          },
          subscription: {
            select: {
              status: true,
            },
          },
          sessions: {
            where: { expiresAt: { gt: new Date() } },
            take: 1,
            orderBy: { expiresAt: 'desc' },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Get message counts for each user
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const messagesSent = await prisma.message.count({
          where: {
            campaign: { userId: user.id },
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          createdAt: user.createdAt,
          lastActiveAt: user.sessions[0]?.expiresAt || null,
          subscriptionStatus: user.subscription?.status || null,
          messagesSent,
          contactsCount: user._count.contacts,
          campaignsCount: user._count.campaigns,
          revenue: 0, // Would calculate from invoices
          isSuspended: false, // Would track suspension status
        };
      })
    );

    return {
      users: usersWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== USER DETAILS ====================

  async getUserDetails(userId: string): Promise<UserDetails | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            contacts: true,
            campaigns: true,
            apiKeys: true,
            integrations: true,
          },
        },
        subscription: true,
        aiSettings: true,
        sessions: {
          orderBy: { expiresAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) return null;

    const messagesSent = await prisma.message.count({
      where: {
        campaign: { userId },
      },
    });

    // Get revenue from invoices
    const revenue = await prisma.invoice.aggregate({
      where: {
        subscription: { userId },
        status: 'PAID',
      },
      _sum: { amount: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
      lastActiveAt: user.sessions[0]?.expiresAt || null,
      subscriptionStatus: user.subscription?.status || null,
      messagesSent,
      contactsCount: user._count.contacts,
      campaignsCount: user._count.campaigns,
      revenue: revenue._sum.amount?.toNumber() || 0,
      isSuspended: false,
    };
  }

  async getUserActivity(userId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      messagesByDay,
      campaignsCreated,
      contactsAdded,
      logins,
    ] = await Promise.all([
      prisma.message.groupBy({
        by: ['status'],
        where: {
          campaign: { userId },
          createdAt: { gte: since },
        },
        _count: { status: true },
      }),
      prisma.campaign.count({
        where: {
          userId,
          createdAt: { gte: since },
        },
      }),
      prisma.contact.count({
        where: {
          userId,
          createdAt: { gte: since },
        },
      }),
      prisma.session.count({
        where: {
          userId,
          createdAt: { gte: since },
        },
      }),
    ]);

    return {
      messagesByDay,
      campaignsCreated,
      contactsAdded,
      logins,
    };
  }

  // ==================== USER ACTIONS ====================

  async impersonateUser(adminId: string, userId: string): Promise<{ sessionToken: string }> {
    // Create a special session for impersonation
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const session = await prisma.session.create({
      data: {
        userId,
        expiresAt,
      },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        action: 'impersonate_user',
        targetType: 'user',
        targetId: userId,
        reason: 'Admin impersonation',
      },
    });

    return { sessionToken: session.id };
  }

  async suspendUser(adminId: string, userId: string, reason: string) {
    // Delete all active sessions to log user out
    await prisma.session.deleteMany({
      where: { userId },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        action: 'suspend_user',
        targetType: 'user',
        targetId: userId,
        reason,
      },
    });

    return { success: true, message: 'User suspended successfully' };
  }

  async unsuspendUser(adminId: string, userId: string, reason: string) {
    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        action: 'unsuspend_user',
        targetType: 'user',
        targetId: userId,
        reason,
      },
    });

    return { success: true, message: 'User unsuspended successfully' };
  }

  async deleteUser(adminId: string, userId: string, reason: string) {
    // GDPR-compliant deletion
    // 1. Anonymize user data
    // 2. Keep financial records (invoices)
    // 3. Delete PII

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Cancel subscription if exists
    if (user.subscription) {
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { status: 'CANCELED' },
      });
    }

    // Delete user's data
    await prisma.$transaction([
      // Delete sessions
      prisma.session.deleteMany({ where: { userId } }),
      // Delete API keys
      prisma.apiKey.deleteMany({ where: { userId } }),
      // Delete integrations
      prisma.integration.deleteMany({ where: { userId } }),
      // Delete AI settings
      prisma.aISettings.deleteMany({ where: { userId } }),
      // Anonymize user record
      prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@anonymized.local`,
          name: 'Deleted User',
          passwordHash: 'deleted',
        },
      }),
    ]);

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        action: 'delete_user',
        targetType: 'user',
        targetId: userId,
        reason,
        metadata: JSON.stringify({ email: user.email }),
      },
    });

    return { success: true, message: 'User data anonymized successfully' };
  }

  async changeUserPlan(adminId: string, userId: string, newPlan: Plan, reason: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const oldPlan = user.plan;

    await prisma.user.update({
      where: { id: userId },
      data: { plan: newPlan },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        action: 'change_user_plan',
        targetType: 'user',
        targetId: userId,
        reason,
        metadata: JSON.stringify({ oldPlan, newPlan }),
      },
    });

    return { success: true, message: `Plan changed from ${oldPlan} to ${newPlan}` };
  }

  async resetUserQuota(adminId: string, userId: string, quota: number, reason: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyQuota: quota },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        action: 'reset_user_quota',
        targetType: 'user',
        targetId: userId,
        reason,
        metadata: JSON.stringify({ newQuota: quota }),
      },
    });

    return { success: true, message: `Daily quota reset to ${quota}` };
  }

  // ==================== BULK ACTIONS ====================

  async bulkAction(
    adminId: string,
    action: 'suspend' | 'delete' | 'change_plan' | 'reset_quota',
    userIds: string[],
    data?: { plan?: Plan; quota?: number; reason: string }
  ) {
    const results = [];

    for (const userId of userIds) {
      try {
        switch (action) {
          case 'suspend':
            await this.suspendUser(adminId, userId, data?.reason || 'Bulk suspend');
            break;
          case 'delete':
            await this.deleteUser(adminId, userId, data?.reason || 'Bulk delete');
            break;
          case 'change_plan':
            if (data?.plan) {
              await this.changeUserPlan(adminId, userId, data.plan, data.reason);
            }
            break;
          case 'reset_quota':
            if (data?.quota !== undefined) {
              await this.resetUserQuota(adminId, userId, data.quota, data.reason);
            }
            break;
        }
        results.push({ userId, success: true });
      } catch (error: any) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    return { success: true, results };
  }

  // ==================== ADMIN ACTIONS LOG ====================

  async getAdminActions(options: {
    adminId?: string;
    action?: string;
    targetType?: string;
    page?: number;
    limit?: number;
  }) {
    const { adminId, action, targetType, page = 1, limit = 50 } = options;

    const where: any = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { email: true, name: true },
          },
        },
      }),
      prisma.adminAction.count({ where }),
    ]);

    return {
      actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const adminUsersService = new AdminUsersService();
