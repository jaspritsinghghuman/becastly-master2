import { hash, verify } from '@node-rs/argon2';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { signAccessToken, signRefreshToken, verifyRefreshToken, revokeRefreshToken } from '../../lib/jwt';
import jwt from 'jsonwebtoken';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export async function registerUser(data: RegisterInput) {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await hash(data.password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  // Create tenant organization and user
  const { user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.organization.create({
      data: {
        name: data.name || data.email,
        slug: data.email.split('@')[0],
      },
    });

    const createdUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: data.email,
        passwordHash,
        name: data.name,
      },
    });

    return { user: createdUser };
  });

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    plan: user.plan,
    role: 'USER',
  });
  const { token: refreshToken, claims } = signRefreshToken({
    sub: user.id,
    tenantId: user.tenantId,
    plan: user.plan,
    role: 'USER',
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      tenantId: user.tenantId,
    },
    tokens: {
      accessToken,
      refreshToken,
      refreshJti: claims.jti,
    },
  };
}

export async function loginUser(data: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const validPassword = await verify(user.passwordHash, data.password);

  if (!validPassword) {
    throw new Error('Invalid credentials');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    plan: user.plan,
    role: 'USER',
  });
  const { token: refreshToken, claims } = signRefreshToken({
    sub: user.id,
    tenantId: user.tenantId,
    plan: user.plan,
    role: 'USER',
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      tenantId: user.tenantId,
    },
    tokens: {
      accessToken,
      refreshToken,
      refreshJti: claims.jti,
    },
  };
}

export async function refreshTokens(oldRefreshToken: string | undefined) {
  if (!oldRefreshToken) {
    throw new Error('Missing refresh token');
  }

  const decoded = await verifyRefreshToken(oldRefreshToken);
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  // Revoke old refresh token
  const decodedRaw = jwt.decode(oldRefreshToken, { complete: true }) as any;
  const expSeconds = decodedRaw?.payload?.exp as number | undefined;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = expSeconds && expSeconds > nowSeconds ? expSeconds - nowSeconds : 0;

  await revokeRefreshToken(decoded.jti, ttl || 0);

  // Issue new pair
  const accessToken = signAccessToken({
    sub: decoded.sub,
    tenantId: decoded.tenantId,
    plan: decoded.plan,
    role: decoded.role,
  });
  const { token: refreshToken, claims } = signRefreshToken({
    sub: decoded.sub,
    tenantId: decoded.tenantId,
    plan: decoded.plan,
    role: decoded.role,
  });

  return {
    accessToken,
    refreshToken,
    refreshJti: claims.jti,
  };
}

export async function revokeCurrentRefreshToken(refreshToken: string | undefined) {
  if (!refreshToken) return;
  const decodedRaw = jwt.decode(refreshToken, { complete: true }) as any;
  const expSeconds = decodedRaw?.payload?.exp as number | undefined;
  const jti = decodedRaw?.payload?.jti as string | undefined;
  if (!jti || !expSeconds) return;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttl = expSeconds > nowSeconds ? expSeconds - nowSeconds : 0;
  await revokeRefreshToken(jti, ttl || 0);
}

