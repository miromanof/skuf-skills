import { createHmac, timingSafeEqual } from 'node:crypto';
import { alphabetBucket, type ContentItem } from '@skuf-skills/domain';
import type { ContentRepository } from '../../ports/content-repository.js';

const transliteration: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya',
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
}

function slugBase(title: string): string {
  const transliterated = [...title.toLocaleLowerCase('ru-RU')].map((letter) => transliteration[letter] ?? letter).join('');
  return transliterated.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'card';
}

export function publicSlug(item: ContentItem): string {
  return `${slugBase(item.title)}-${item.id.slice(0, 8).toLocaleLowerCase()}`;
}

function publicDto(item: ContentItem) {
  return {
    slug: publicSlug(item), type: item.type, title: item.title, explanation: item.explanation, example: item.example,
    tags: item.tags, bucket: alphabetBucket(item.title),
    ...(item.author ? { author: item.author } : {}),
    ...(item.type === 'term' ? { context: item.context, ...(item.origin ? { origin: item.origin } : {}) } : { origin: item.origin, media: item.media }),
    publishedAt: item.publishedAt?.toISOString() ?? item.updatedAt.toISOString(),
  };
}

export type PublicListInput = { type?: 'term' | 'meme'; query?: string; tag?: string; bucket?: string; cursor?: string; limit?: number };

export class InvalidCursorError extends Error {}

export class PublicContentService {
  constructor(private readonly repository: ContentRepository, private readonly cursorSecret: string) {}

  private sign(payload: string) { return createHmac('sha256', this.cursorSecret).update(payload).digest('base64url'); }

  private cursor(offset: number): string {
    const payload = Buffer.from(JSON.stringify({ offset })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  private readCursor(cursor?: string): number {
    if (!cursor) return 0;
    const [payload, signature, extra] = cursor.split('.');
    if (!payload || !signature || extra) throw new InvalidCursorError();
    const expected = this.sign(payload);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new InvalidCursorError();
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { offset?: unknown };
      if (!Number.isSafeInteger(parsed.offset) || Number(parsed.offset) < 0) throw new InvalidCursorError();
      return Number(parsed.offset);
    } catch (error) {
      if (error instanceof InvalidCursorError) throw error;
      throw new InvalidCursorError();
    }
  }

  async list(input: PublicListInput) {
    const offset = this.readCursor(input.cursor);
    const limit = Math.min(50, Math.max(1, input.limit ?? 24));
    const query = normalize(input.query ?? '');
    const tag = normalize(input.tag ?? '');
    const bucket = input.bucket?.toLocaleUpperCase('ru-RU');
    const items = (await this.repository.listPublished()).filter((item) => {
      if (item.status !== 'published' || (input.type && item.type !== input.type)) return false;
      if (bucket && alphabetBucket(item.title) !== bucket) return false;
      if (tag && !item.tags.some((value) => normalize(value) === tag)) return false;
      if (query && ![item.title, item.explanation, ...item.tags].some((value) => normalize(value).includes(query))) return false;
      return true;
    }).sort((left, right) => left.title.localeCompare(right.title, 'ru') || left.id.localeCompare(right.id));
    const page = items.slice(offset, offset + limit);
    return { items: page.map(publicDto), ...(offset + limit < items.length ? { nextCursor: this.cursor(offset + limit) } : {}) };
  }

  async detail(slug: string) {
    const item = (await this.repository.listPublished()).find((candidate) => candidate.status === 'published' && publicSlug(candidate) === slug);
    return item ? publicDto(item) : null;
  }
}
