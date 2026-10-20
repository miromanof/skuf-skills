import { describe, expect, it, vi } from 'vitest';
import { cleanHiddenInput, cloudflareSecretCommand, createCloudflareSecretPayload, verifyProductionLogin } from '../../../scripts/cloudflare-admin-setup.mjs';

describe('Cloudflare administrator setup', () => {
  it('creates deployable Cloudflare secrets', async () => {
    const payload = await createCloudflareSecretPayload({ login: 'admin@example.com', password: 'correct horse battery' }, new Uint8Array(16).fill(7));

    expect(payload).toEqual({
      ADMIN_PASSWORD: 'correct horse battery',
      CURSOR_SECRET: expect.any(String),
    });
  });

  it('launches Wrangler through cmd.exe on Windows', () => {
    expect(cloudflareSecretCommand('win32', 'C:\\Windows\\System32\\cmd.exe')).toEqual({
      executable: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npx.cmd', 'wrangler', 'secret', 'bulk', '--config', 'apps/worker/wrangler.jsonc'],
    });
  });

  it('verifies the uploaded credentials against the production admin endpoint', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200 });
    await expect(verifyProductionLogin('admin@example.com', 'correct horse battery', request)).resolves.toBe(200);
  });

  it('removes Windows Terminal bracketed-paste markers from hidden passwords', () => {
    expect(cleanHiddenInput('\u001b[200~Correct-Horse-42!\u001b[201~')).toBe('Correct-Horse-42!');
  });

  it('rejects short passwords and line-break injection', async () => {
    await expect(createCloudflareSecretPayload({ login: 'admin@example.com', password: 'short' })).rejects.toThrow(/12/u);
    await expect(createCloudflareSecretPayload({ login: 'admin@example.com\nEVIL=yes', password: 'correct horse battery' })).rejects.toThrow(/Некоррект/u);
  });
});

