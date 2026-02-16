import { prisma } from './prisma';

// API Key authentication helper (includes tenant and plan for multi-tenant context)
export async function validateApiKey(apiKey: string): Promise<{ userId: string; tenantId: string; plan: string; permissions: string[] } | null> {
  const { hashApiKey } = await import('./crypto');
  const keyHash = hashApiKey(apiKey);
  
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { keyHash },
    include: {
      user: true,
    },
  });
  
  if (!apiKeyRecord) {
    return null;
  }
  
  return {
    userId: apiKeyRecord.userId,
    tenantId: apiKeyRecord.user.tenantId,
    plan: apiKeyRecord.user.plan,
    permissions: apiKeyRecord.permissions,
  };
}
