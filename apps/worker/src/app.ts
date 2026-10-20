import { Hono } from 'hono';
import type { WorkerBindings } from './env.js';
import { explicitCors } from './http/cors.js';
import { registerPublicRoutes } from './content/public-routes.js';
import { registerSubmissionRoutes } from './content/submission-routes.js';
import { registerAuthRoutes, requireAdminOrigin } from './auth/routes.js';
import { registerModerationRoutes } from './moderation/routes.js';
import { securityHeaders } from './http/security-headers.js';

export function createWorkerApp() {
  const app = new Hono<{ Bindings: WorkerBindings }>();
  app.use('*', securityHeaders());
  app.get('/health', (context) => context.json({ status: 'ok' as const }));
  app.use('/api/*', explicitCors());
  app.use('/api/admin/*', requireAdminOrigin());
  registerPublicRoutes(app);
  registerSubmissionRoutes(app);
  registerAuthRoutes(app);
  registerModerationRoutes(app);
  return app;
}

