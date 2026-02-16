import { FastifyInstance } from 'fastify';
import { registerUser, loginUser, refreshTokens, revokeCurrentRefreshToken, registerSchema, loginSchema } from './auth.service';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);
      const result = await registerUser(data);

      // Set refresh token as HTTP-only cookie
      reply.setCookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: fastify.server.address() !== null,
        sameSite: 'lax',
        path: '/',
      });

      return reply.code(201).send({
        success: true,
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);
      const result = await loginUser(data);

      reply.setCookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: fastify.server.address() !== null,
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        success: true,
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (error: any) {
      return reply.code(401).send({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token;
    await revokeCurrentRefreshToken(refreshToken);

    reply.clearCookie('refresh_token', {
      path: '/',
    });

    return reply.send({
      success: true,
    });
  });

  // Refresh tokens
  fastify.post('/refresh', async (request, reply) => {
    try {
      const refreshToken = request.cookies?.refresh_token;
      const tokens = await refreshTokens(refreshToken);

      reply.setCookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: fastify.server.address() !== null,
        sameSite: 'lax',
        path: '/',
      });

      return reply.send({
        success: true,
        accessToken: tokens.accessToken,
      });
    } catch (error: any) {
      return reply.code(401).send({
        success: false,
        error: error.message || 'Token refresh failed',
      });
    }
  });

  // Get current user
  fastify.get('/me', async (request, reply) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
      });
    }

    return reply.send({
      success: true,
      user,
    });
  });
}
