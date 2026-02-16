import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { getPlanConfig } from '../modules/admin/admin.config';

export async function planLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = (request as any).user;
  const apiUser = (request as any).apiUser;

  const userId = user?.id || apiUser?.userId;
  const tenantId = user?.tenantId || apiUser?.tenantId;

  if (!userId || !tenantId) {
    return;
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
    },
  });

  if (!userRecord) {
    return;
  }

  const planConfig = getPlanConfig(userRecord.plan);
  if (!planConfig) {
    return;
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const messagesToday = await prisma.message.count({
    where: {
      tenantId,
      sentAt: {
        gte: startOfDay,
      },
    },
  });

  if (messagesToday >= planConfig.dailyQuota) {
    return reply.code(402).send({
      success: false,
      error: 'Plan limit exceeded for daily messages',
      code: 'PLAN_LIMIT_EXCEEDED',
      limit: planConfig.dailyQuota,
      used: messagesToday,
      plan: userRecord.plan,
    });
  }
}

