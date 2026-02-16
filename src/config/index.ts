import { z } from 'zod';

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
    jwtSecret: (env.JWT_SECRET as string) || '',
    jwtRefreshSecret: (env.JWT_REFRESH_SECRET as string) || '',
  },
};

