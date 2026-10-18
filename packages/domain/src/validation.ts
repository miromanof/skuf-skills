import { z } from 'zod';
import type { ContentDraft } from './content.js';
import { parseVideoUrl } from './video.js';

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
const limitedText = (min: number, max: number) =>
  z.preprocess(
    normalize,
    z.string().refine((value) => {
      const length = Array.from(value).length;
      return length >= min && length <= max;
    }, `Длина должна быть от ${min} до ${max} символов`),
  );

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const normalized = normalize(value);
    return normalized === '' ? undefined : normalized;
  }, limitedText(1, max).optional());

const tags = z
  .array(limitedText(1, 32))
  .max(8)
  .transform((values) => [...new Set(values)]);

const videoMedia = z.object({ kind: z.literal('video'), url: limitedText(1, 2048) }).superRefine((media, context) => {
  try { parseVideoUrl(media.url); } catch { context.addIssue({ code: 'custom', message: 'Поддерживаются только ссылки RuTube и YouTube' }); }
});

const media = z.discriminatedUnion('kind', [
  videoMedia,
  z.object({ kind: z.literal('image'), uploadToken: limitedText(1, 200) }),
]);

const shared = {
  title: limitedText(1, 100),
  explanation: limitedText(1, 1500),
  example: limitedText(1, 500),
  tags,
  author: optionalText(60),
  correction: z.object({
    targetSlug: limitedText(1, 120),
    changeNote: limitedText(1, 500),
    original: z.object({
      title: limitedText(1, 100),
      explanation: limitedText(1, 1500),
      example: limitedText(1, 500),
      tags,
      context: optionalText(800),
      origin: optionalText(1000),
      media: media.optional(),
    }).optional(),
  }).optional(),
};

const schema = z.discriminatedUnion('type', [
  z.object({
    ...shared,
    type: z.literal('term'),
    title: limitedText(1, 80),
    context: limitedText(1, 800),
    origin: optionalText(1000),
  }),
  z.object({
    ...shared,
    type: z.literal('meme'),
    origin: limitedText(1, 1000),
    media,
  }),
]);

export function parseContentDraft(input: unknown): ContentDraft {
  return schema.parse(input) as ContentDraft;
}
