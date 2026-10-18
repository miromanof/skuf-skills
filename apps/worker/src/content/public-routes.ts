import { alphabetBucket, type ContentItem } from '@skuf-skills/domain';
import type { Hono } from 'hono';
import type { WorkerBindings } from '../env.js';
import { decodeCursor, encodeCursor } from '../security/crypto.js';
import { D1ContentRepository } from './d1-content-repository.js';
import { normalizeTitle } from './serialization.js';

const transliteration: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya',
};

function slugBase(title: string): string {
  const transliterated = [...title.toLocaleLowerCase('ru-RU')].map((letter) => transliteration[letter] ?? letter).join('');
  return transliterated.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'card';
}

export function publicSlug(item: ContentItem): string {
  return `${slugBase(item.title)}-${item.id.slice(0, 8).toLocaleLowerCase()}`;
}

function dto(item: ContentItem) {
  return {
    slug: publicSlug(item), type: item.type, title: item.title, explanation: item.explanation, example: item.example,
    tags: item.tags, bucket: alphabetBucket(item.title),
    ...(item.author ? { author: item.author } : {}),
    ...(item.type === 'term' ? { context: item.context, ...(item.origin ? { origin: item.origin } : {}) } : { origin: item.origin, media: item.media }),
    publishedAt: item.publishedAt?.toISOString() ?? item.updatedAt.toISOString(),
  };
}

export function registerPublicRoutes(app: Hono<{ Bindings: WorkerBindings }>) {
  app.get('/api/content', async (context) => {
    try {
      const offset = await decodeCursor(context.req.query('cursor'), context.env.CURSOR_SECRET);
      const requestedLimit = Number.parseInt(context.req.query('limit') ?? '24', 10);
      const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 24;
      const query = normalizeTitle(context.req.query('query') ?? '');
      const tag = normalizeTitle(context.req.query('tag') ?? '');
      const bucket = context.req.query('bucket')?.toLocaleUpperCase('ru-RU');
      const type = context.req.query('type');
      const items = (await new D1ContentRepository(context.env.DB).listPublished()).filter((item) => {
        if ((type === 'term' || type === 'meme') && item.type !== type) return false;
        if (bucket && alphabetBucket(item.title) !== bucket) return false;
        if (tag && !item.tags.some((value) => normalizeTitle(value) === tag)) return false;
        if (query && ![item.title, item.explanation, ...item.tags].some((value) => normalizeTitle(value).includes(query))) return false;
        return true;
      });
      const page = items.slice(offset, offset + limit);
      return context.json({ items: page.map(dto), ...(offset + limit < items.length ? { nextCursor: await encodeCursor(offset + limit, context.env.CURSOR_SECRET) } : {}) });
    } catch (error) {
      if (error instanceof Error && error.message === 'invalid-cursor') return context.json({ error: 'Некорректный курсор' }, 400);
      throw error;
    }
  });

  app.get('/api/content/:slug', async (context) => {
    const item = (await new D1ContentRepository(context.env.DB).listPublished()).find((candidate) => publicSlug(candidate) === context.req.param('slug'));
    return item ? context.json(dto(item)) : context.json({ error: 'Карточка не найдена' }, 404);
  });
}
