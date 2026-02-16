import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    cookies: { [cookieName: string]: string | undefined };
    file?: () => Promise<{
      toBuffer: () => Promise<Buffer>;
      filename: string;
      mimetype: string;
    }>;
    user?: {
      id: string;
      tenantId: string;
      plan: string;
      role: string;
    };
    apiUser?: {
      userId: string;
      tenantId: string;
      plan: string;
      permissions: string[];
    };
  }
}
