import type { MiddlewareHandler } from 'hono';

const permissionsPolicy = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
].join(', ');

export function securityHeaders(): MiddlewareHandler {
  return async (context, next) => {
    await next();
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('X-Frame-Options', 'DENY');
    context.header('Permissions-Policy', permissionsPolicy);
    if (context.req.path.startsWith('/api/admin/')) context.header('Cache-Control', 'no-store');
  };
}

