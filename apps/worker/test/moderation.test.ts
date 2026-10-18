import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorkerApp } from '../src/app.js';
import { derivePasswordKey } from '../src/auth/password.js';
import { D1ContentRepository } from '../src/content/d1-content-repository.js';
import { createTestEnvironment, termDraft } from './support.js';

function cookies(response: Response): string {
  return response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
}

describe('Worker moderation API', () => {
  let cleanup: () => Promise<void>;
  let env: Awaited<ReturnType<typeof createTestEnvironment>>['env'];
  let repository: D1ContentRepository;
  let cookie: string;
  let csrf: string;

  beforeEach(async () => {
    const test = await createTestEnvironment();
    env = test.env;
    env.ADMIN_PASSWORD_SALT = 'dGVzdC1zYWx0LXZhbHVl';
    env.ADMIN_PASSWORD_DERIVED_KEY = await derivePasswordKey('correct horse battery', env.ADMIN_PASSWORD_SALT);
    repository = new D1ContentRepository(test.database);
    cleanup = () => test.miniflare.dispose();
    const login = await createWorkerApp().request('/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://skufskills.ru' },
      body: JSON.stringify({ login: env.ADMIN_LOGIN, password: 'correct horse battery' }),
    }, env);
    cookie = cookies(login);
    csrf = (await login.json() as { csrfToken: string }).csrfToken;
  });
  afterEach(async () => cleanup());

  function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('origin', 'https://skufskills.ru');
    headers.set('cookie', cookie);
    if (init.body) headers.set('content-type', 'application/json');
    if (init.method && init.method !== 'GET') headers.set('x-csrf-token', csrf);
    return createWorkerApp().request(path, { ...init, headers }, env);
  }

  it('protects the queue and validates status filters', async () => {
    const item = await repository.createPending({ draft: termDraft, idempotencyKey: 'queue-item', requestHash: 'hash', now: new Date() });
    expect((await createWorkerApp().request('/api/admin/content?status=pending', { headers: { origin: 'https://skufskills.ru' } }, env)).status).toBe(401);
    const response = await request('/api/admin/content?status=pending');
    expect(response.status).toBe(200);
    expect((await response.json() as { items: Array<{ id: string }> }).items.map((value) => value.id)).toEqual([item.id]);
    expect((await request('/api/admin/content?status=unknown')).status).toBe(400);
  });

  it('edits a draft, requires CSRF and returns the current item for stale versions', async () => {
    const item = await repository.createPending({ draft: termDraft, idempotencyKey: 'edit-item', requestHash: 'hash', now: new Date('2026-10-18T00:00:00Z') });
    const body = JSON.stringify({ version: item.updatedAt.toISOString(), draft: { ...termDraft, title: 'Новый заголовок' } });
    const noCsrf = await createWorkerApp().request(`/api/admin/content/${item.id}`, {
      method: 'PATCH', headers: { origin: 'https://skufskills.ru', cookie, 'content-type': 'application/json' }, body,
    }, env);
    expect(noCsrf.status).toBe(403);

    const edited = await request(`/api/admin/content/${item.id}`, { method: 'PATCH', body });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ title: 'Новый заголовок', version: expect.any(String) });
    const conflict = await request(`/api/admin/content/${item.id}`, { method: 'PATCH', body });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ current: { title: 'Новый заголовок' } });
  });

  it('publishes, unpublishes, rejects and blocks invalid transitions', async () => {
    const first = await repository.createPending({ draft: termDraft, idempotencyKey: 'transition-a', requestHash: 'hash-a', now: new Date('2026-10-18T00:00:00Z') });
    const published = await request(`/api/admin/content/${first.id}/publish`, { method: 'POST', body: JSON.stringify({ version: first.updatedAt.toISOString() }) });
    expect(published.status).toBe(200);
    const publishedBody = await published.json() as { version: string };
    expect((await request(`/api/admin/content/${first.id}/unpublish`, { method: 'POST', body: JSON.stringify({ version: publishedBody.version, reason: 'Уточнение' }) })).status).toBe(200);

    const second = await repository.createPending({ draft: termDraft, idempotencyKey: 'transition-b', requestHash: 'hash-b', now: new Date() });
    expect((await request(`/api/admin/content/${second.id}/reject`, { method: 'POST', body: JSON.stringify({ version: second.updatedAt.toISOString(), reason: 'Нет контекста' }) })).status).toBe(200);
    expect((await request(`/api/admin/content/${second.id}/publish`, { method: 'POST', body: JSON.stringify({ version: second.updatedAt.toISOString() }) })).status).toBe(409);
  });

  it('replaces deleted content with an anonymized tombstone', async () => {
    const item = await repository.createPending({ draft: termDraft, idempotencyKey: 'delete-item', requestHash: 'hash', now: new Date() });
    const published = await request(`/api/admin/content/${item.id}/publish`, { method: 'POST', body: JSON.stringify({ version: item.updatedAt.toISOString() }) });
    const version = (await published.json() as { version: string }).version;
    expect((await request(`/api/admin/content/${item.id}`, { method: 'DELETE', body: JSON.stringify({ version }) })).status).toBe(204);
    await expect(repository.findById(item.id)).resolves.toMatchObject({ status: 'deleted', title: 'Удалено', explanation: 'Карточка удалена', tags: [] });
  });
});
