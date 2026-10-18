import { describe, expect, it } from 'vitest';
import { renderAdminEnvironment } from '../../../scripts/admin-setup.mjs';

describe('administrator setup', () => {
  it('stores only the password hash and preserves unrelated local settings', () => {
    const result = renderAdminEnvironment('PORT=3001\nCUSTOM=value\nADMIN_LOGIN=old@example.test\nADMIN_PASSWORD_HASH=old\n', {
      login: 'editor@example.test', passwordHash: '$argon2id$secure-hash', cursorSecret: 'random-cursor-secret',
    });

    expect(result).toContain('PORT=3001');
    expect(result).toContain('CUSTOM=value');
    expect(result).toContain('ADMIN_LOGIN=editor@example.test');
    expect(result).toContain('ADMIN_PASSWORD_HASH=$argon2id$secure-hash');
    expect(result).toContain('PUBLIC_CURSOR_SECRET=random-cursor-secret');
    expect(result).not.toContain('old@example.test');
    expect(result.match(/ADMIN_LOGIN=/g)).toHaveLength(1);
  });

  it('rejects line breaks that could inject extra environment variables', () => {
    expect(() => renderAdminEnvironment('', { login: 'admin@example.test\nEVIL=1', passwordHash: 'hash', cursorSecret: 'secret' })).toThrow('Некорректное значение');
  });
});
