import { z } from 'zod';
import crypto from 'crypto';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  APP_URL: z.string().url(),
  API_PORT: z.string().min(1).default('3001'),

  ENCRYPTION_KEY: z.string().min(32),

  // JWT (access + refresh)
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Observability
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success && process.env.NODE_ENV === 'production') {
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const env = parsed.success ? parsed.data : (process.env as any);

function ensureJwtSecret(key: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  let value = process.env[key];

  if (!value && process.env.NODE_ENV !== 'production') {
    // Auto-generate for development/test to simplify setup
    value = crypto.randomBytes(32).toString('hex');
    process.env[key] = value;
    // eslint-disable-next-line no-console
    console.warn(`[config] Auto-generated ${key} for ${process.env.NODE_ENV} environment.`);
  }

  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value as string;
}

export const config = {
  app: {
    url: env.APP_URL as string,
    port: parseInt(env.API_PORT as string, 10),
    env: (env.NODE_ENV as string) || 'development',
  },
  db: {
    url: env.DATABASE_URL as string,
  },
  redis: {
    url: env.REDIS_URL as string,
  },
  security: {
    encryptionKey: env.ENCRYPTION_KEY as string,
    jwtSecret: ensureJwtSecret('JWT_SECRET'),
    jwtRefreshSecret: ensureJwtSecret('JWT_REFRESH_SECRET'),
  },
};

