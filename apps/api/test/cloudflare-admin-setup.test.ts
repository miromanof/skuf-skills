import { describe, expect, it } from 'vitest';
import { createCloudflareSecretPayload } from '../../../scripts/cloudflare-admin-setup.mjs';

describe('Cloudflare administrator setup', () => {
  it('derives deployable secrets without retaining the plaintext password', async () => {
    const payload = await createCloudflareSecretPayload({ login: 'admin@example.com', password: 'correct horse battery' }, new Uint8Array(16).fill(7));

    expect(payload).toEqual({
      ADMIN_LOGIN: 'admin@example.com',
      ADMIN_PASSWORD_SALT: expect.any(String),
      ADMIN_PASSWORD_DERIVED_KEY: expect.any(String),
      CURSOR_SECRET: expect.any(String),
    });
    expect(JSON.stringify(payload)).not.toContain('correct horse battery');
  });

  it('rejects short passwords and line-break injection', async () => {
    await expect(createCloudflareSecretPayload({ login: 'admin@example.com', password: 'short' })).rejects.toThrow(/12/u);
    await expect(createCloudflareSecretPayload({ login: 'admin@example.com\nEVIL=yes', password: 'correct horse battery' })).rejects.toThrow(/Некоррект/u);
  });
});
