import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileStorage } from '../ports/file-storage.js';
import { validateImage } from '../modules/uploads/image-validation.js';

export class LocalFileStorage implements FileStorage {
  constructor(private readonly root: string) {}

  async saveValidatedImage(buffer: Buffer, _originalName: string) {
    const image = await validateImage(buffer);
    await mkdir(this.root, { recursive: true });
    const extension = image.format === 'jpeg' ? 'jpg' : image.format;
    const storageKey = `${randomUUID()}.${extension}`;
    const temporary = join(this.root, `${storageKey}.tmp`);
    await writeFile(temporary, buffer, { flag: 'wx' });
    await rename(temporary, join(this.root, storageKey));
    return { storageKey, mimeType: image.mimeType, size: image.size, width: image.width, height: image.height };
  }

  async delete(storageKey: string) {
    if (!/^[a-f0-9-]+\.(?:jpg|png|webp)$/.test(storageKey)) throw new Error('Некорректный ключ файла');
    await rm(join(this.root, storageKey), { force: true });
  }
}
