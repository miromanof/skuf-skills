import Fastify, { type FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import cookie from '@fastify/cookie';
import type { ContentRepository } from './ports/content-repository.js';
import { registerSubmissionRoutes } from './modules/submissions/routes.js';
import { SubmissionService } from './modules/submissions/service.js';
import { AuthService, type SessionStore } from './modules/auth/service.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import type { FileStorage } from './ports/file-storage.js';
import { ModerationService } from './modules/moderation/service.js';
import { registerModerationRoutes } from './modules/moderation/routes.js';
import { PublicContentService } from './modules/public-content/service.js';
import { registerPublicContentRoutes } from './modules/public-content/routes.js';

export type AppDependencies = {
  contentRepository?: ContentRepository;
  fileStorage?: FileStorage;
  now?: () => Date;
  adminAuth?: { login: string; passwordHash: string; sessions: SessionStore; secureCookies: boolean };
  publicCursorSecret?: string;
};

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
  void app.register(cookie);

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
      reply.header('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      reply.header('access-control-allow-headers', 'content-type, idempotency-key, x-csrf-token');
      reply.header('access-control-allow-credentials', 'true');
    }
    if (request.method === 'OPTIONS') return reply.code(204).send();
  });

  app.get('/health', async () => ({ status: 'ok' as const }));
  if (dependencies.contentRepository) {
    void registerSubmissionRoutes(app, new SubmissionService(dependencies.contentRepository, dependencies.now ?? (() => new Date())));
    registerPublicContentRoutes(app, new PublicContentService(dependencies.contentRepository, dependencies.publicCursorSecret ?? randomBytes(32).toString('base64url')));
  }
  if (dependencies.adminAuth) {
    const config = dependencies.adminAuth;
    const auth = new AuthService(config.login, config.passwordHash, config.sessions, dependencies.now);
    registerAuthRoutes(app, auth, {
      secureCookies: config.secureCookies,
      ...(dependencies.now ? { now: dependencies.now } : {}),
    });
    if (dependencies.contentRepository) {
      registerModerationRoutes(app, new ModerationService(dependencies.contentRepository, dependencies.fileStorage, dependencies.now), auth);
    }
  }

  return app;
}
