import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey } from './idempotency-key.js';

describe('createIdempotencyKey', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses randomUUID when the browser provides it', () => {
    const value = '11111111-2222-4333-8444-555555555555';
    vi.stubGlobal('crypto', { randomUUID: () => value });
    expect(createIdempotencyKey()).toBe(value);
  });

  it('creates an RFC 4122-shaped key on older iPhones without randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.fill(0xab); return bytes; } });
    expect(createIdempotencyKey()).toBe('abababab-abab-4bab-abab-abababababab');
  });
});

