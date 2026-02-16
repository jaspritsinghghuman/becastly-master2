import { prisma } from '../../lib/prisma';
import { hashApiKey, generateApiKey } from '../../lib/crypto';
import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).default(['send:whatsapp', 'send:email', 'send:telegram', 'send:sms']),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export async function getApiKeys(userId: string) {
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      permissions: true,
      createdAt: true,
      // Don't return keyHash for security
    },
  });

  return apiKeys;
}

export async function createApiKey(userId: string, data: CreateApiKeyInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }
  // Generate a new API key
  const key = generateApiKey();
  const keyHash = hashApiKey(key);

  await prisma.apiKey.create({
    data: {
      tenantId: user.tenantId,
      userId,
      name: data.name,
      keyHash,
      permissions: data.permissions,
    },
  });

  // Return the plain key (only time it will be shown)
  return {
    key,
    name: data.name,
    permissions: data.permissions,
  };
}

export async function revokeApiKey(userId: string, apiKeyId: string) {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, userId },
  });

  if (!apiKey) {
    throw new Error('API key not found');
  }

  await prisma.apiKey.delete({
    where: { id: apiKeyId },
  });

  return { success: true };
}
