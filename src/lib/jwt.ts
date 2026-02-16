import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redisConnection } from './queue';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export type JwtClaims = {
  sub: string; // userId
  tenantId: string;
  plan: string;
  role: string;
  permissions?: string[];
  jti: string;
};

export function signAccessToken(payload: Omit<JwtClaims, 'jti'> & { jti?: string }) {
  const base: JwtClaims = {
    jti: payload.jti || crypto.randomUUID(),
    ...payload,
  };

  return jwt.sign(base, config.security.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(payload: Omit<JwtClaims, 'jti'>) {
  const base: JwtClaims = {
    jti: crypto.randomUUID(),
    ...payload,
  };

  const token = jwt.sign(base, config.security.jwtRefreshSecret, {
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_TTL,
  });

  return { token, claims: base };
}

export async function verifyAccessToken(token: string): Promise<JwtClaims | null> {
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as JwtClaims;
    return decoded;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<JwtClaims | null> {
  try {
    const decoded = jwt.verify(token, config.security.jwtRefreshSecret) as JwtClaims;

    // Check revocation in Redis
    const isRevoked = await redisConnection.get(getRevocationKey(decoded.jti));
    if (isRevoked) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function getRevocationKey(jti: string) {
  return `jwt:refresh:revoked:${jti}`;
}

export async function revokeRefreshToken(jti: string, expiresInSeconds: number) {
  if (!jti) return;
  await redisConnection.set(getRevocationKey(jti), '1', 'EX', expiresInSeconds);
}

