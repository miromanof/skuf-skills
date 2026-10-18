import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalFileStorage } from '../src/adapters/local-file-storage.js';
import { validateImage } from '../src/modules/uploads/image-validation.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function image(format: 'jpeg' | 'png' | 'webp', width = 2, height = 2) {
  return sharp({ create: { width, height, channels: 3, background: '#ff00aa' } })[format]().toBuffer();
}

describe('validateImage', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('accepts a real %s image', async (format) => {
    await expect(validateImage(await image(format))).resolves.toMatchObject({ format, width: 2, height: 2 });
  });

  it('rejects spoofed, oversized and over-dimensioned files', async () => {
    await expect(validateImage(Buffer.from('<svg><script>alert(1)</script></svg>'))).rejects.toThrow();
    await expect(validateImage(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow(/5 МиБ/);
    await expect(validateImage(await image('png', 4097, 1))).rejects.toThrow(/4096/);
  });
});

describe('LocalFileStorage', () => {
  it('stores a validated file under a server-generated name', async () => {
    const parent = join(process.cwd(), '.data', 'test-uploads');
    await mkdir(parent, { recursive: true });
    const root = await mkdtemp(join(parent, 'case-'));
    roots.push(root);
    const storage = new LocalFileStorage(root);
    const saved = await storage.saveValidatedImage(await image('png'), '../../avatar.png');

    expect(saved.storageKey).not.toContain('avatar');
    expect(saved.storageKey).not.toContain('..');
    await expect(readFile(join(root, saved.storageKey))).resolves.toBeInstanceOf(Buffer);
  });
});
