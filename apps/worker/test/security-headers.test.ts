import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerApp } from '../src/app.js';
import { createTestEnvironment } from './support.js';

describe('Worker security headers', () => {
  let cleanup: () => Promise<void>;
  let env: Awaited<ReturnType<typeof createTestEnvironment>>['env'];

  beforeEach(async () => {
    const test = await createTestEnvironment();
    env = test.env;
    cleanup = () => test.miniflare.dispose();
  });
  afterEach(async () => cleanup());

  it.each([
    ['/health', {}],
    ['/api/content?type=term', { headers: { origin: 'https://skufskills.ru' } }],
    ['/api/admin/session', { headers: { origin: 'https://skufskills.ru' } }],
  ])('protects %s responses', async (path, init) => {
    const response = await createWorkerApp().request(path, init, env);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
  });

  it('keeps CORS on preflight and disables caching for administrator routes', async () => {
    const response = await createWorkerApp().request('/api/admin/session', {
      method: 'OPTIONS',
      headers: { origin: 'https://skufskills.ru', 'access-control-request-method': 'GET' },
    }, env);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://skufskills.ru');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

