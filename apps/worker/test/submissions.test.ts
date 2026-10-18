import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerApp } from '../src/app.js';
import { createTestEnvironment, termDraft } from './support.js';

describe('Worker anonymous submissions', () => {
  let cleanup: () => Promise<void>;
  let env: Awaited<ReturnType<typeof createTestEnvironment>>['env'];

  beforeEach(async () => {
    const test = await createTestEnvironment();
    env = test.env;
    cleanup = () => test.miniflare.dispose();
  });
  afterEach(async () => cleanup());

  function submit(key: string, body: unknown = termDraft, origin = 'https://skufskills.ru', ip = '203.0.113.10') {
    return createWorkerApp().request('/api/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key, origin, 'cf-connecting-ip': ip },
      body: JSON.stringify(body),
    }, env);
  }

  it('accepts production and preview origins but rejects unrelated origins', async () => {
    const allowed = await submit('allowed-key');
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://skufskills.ru');

    const preview = await submit('preview-key', termDraft, 'https://miromanof.github.io');
    expect(preview.status).toBe(201);
    expect(preview.headers.get('access-control-allow-origin')).toBe('https://miromanof.github.io');

    const denied = await submit('denied-key', termDraft, 'https://evil.example');
    expect(denied.status).toBe(403);
    expect(denied.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('returns the original submission for an identical durable retry', async () => {
    const first = await submit('retry-key');
    const second = await submit('retry-key');

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
  });

  it('rejects idempotency-key reuse for a different draft', async () => {
    await submit('conflict-key');
    const response = await submit('conflict-key', { ...termDraft, title: 'Другое название' });

    expect(response.status).toBe(409);
  });

  it('validates the draft, idempotency key and 64 KiB body limit', async () => {
    expect((await submit('short', termDraft)).status).toBe(400);
    expect((await submit('validation-key', { type: 'term' })).status).toBe(400);
    expect((await submit('large-body-key', { ...termDraft, explanation: 'x'.repeat(70_000) })).status).toBe(413);
  });

  it('persists rate limits across app instances', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await submit(`rate-key-${attempt}`)).status).toBe(201);
    }
    expect((await submit('rate-key-blocked')).status).toBe(429);
  });

  it('answers preflight only for configured origins', async () => {
    const allowed = await createWorkerApp().request('/api/submissions', { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:5173' } }, env);
    const denied = await createWorkerApp().request('/api/submissions', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }, env);

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toContain('POST');
    expect(denied.status).toBe(403);
  });
});
