import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const MAX_BYTES = 5 * 1024 * 1024;
const allowed = new Map([
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
] as const);

export async function validateImage(buffer: Buffer) {
  if (buffer.length > MAX_BYTES) throw new Error('Изображение не должно превышать 5 МиБ');
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !allowed.has(detected.ext as 'jpg' | 'png' | 'webp')) throw new Error('Разрешены только JPEG, PNG и WebP');
  const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 4096 * 4096 }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 1 || height < 1 || width > 4096 || height > 4096) throw new Error('Размеры изображения не должны превышать 4096×4096');
  const format = detected.ext === 'jpg' ? 'jpeg' : detected.ext;
  return { format, mimeType: allowed.get(detected.ext as 'jpg' | 'png' | 'webp')!, size: buffer.length, width, height };
}
