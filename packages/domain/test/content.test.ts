import { describe, expect, it } from 'vitest';
import { parseContentDraft } from '../src/validation.js';

const term = (overrides: Record<string, unknown> = {}) => ({
  type: 'term',
  title: '  вайб  ',
  explanation: '  Настроение\n\nили атмосфера.  ',
  example: 'Сегодня хороший вайб.',
  context: 'Неформальная речь.',
  tags: [' общение ', 'настроение'],
  ...overrides,
});

const meme = (overrides: Record<string, unknown> = {}) => ({
  type: 'meme',
  title: 'Это база',
  explanation: 'Согласие с меткой мыслью.',
  example: '— Нужно высыпаться. — Это база.',
  origin: 'Реакционный мем.',
  tags: ['реакция'],
  media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' },
  ...overrides,
});

describe('parseContentDraft', () => {
  it('normalizes edge whitespace but preserves meaningful line breaks', () => {
    expect(parseContentDraft(term())).toMatchObject({
      title: 'вайб',
      explanation: 'Настроение\n\nили атмосфера.',
      tags: ['общение', 'настроение'],
    });
  });

  it.each([
    ['empty title', term({ title: '   ' })],
    ['81-code-point title', term({ title: 'я'.repeat(81) })],
    ['1501-code-point explanation', term({ explanation: 'я'.repeat(1501) })],
    ['nine tags', term({ tags: Array.from({ length: 9 }, (_, index) => `тег${index}`) })],
  ])('rejects %s', (_name, input) => {
    expect(() => parseContentDraft(input)).toThrow();
  });

  it('accepts exact limits measured by Unicode code points', () => {
    const parsed = parseContentDraft(
      term({ title: '😀'.repeat(80), explanation: 'ю'.repeat(1500), tags: Array.from({ length: 8 }, (_, index) => `тег${index}`) }),
    );
    expect(Array.from(parsed.title)).toHaveLength(80);
  });

  it('accepts mixed Cyrillic and Latin text and optional authorship', () => {
    expect(parseContentDraft(term({ title: 'POV: вайб', author: 'Аня_2026' }))).toMatchObject({
      title: 'POV: вайб',
      author: 'Аня_2026',
    });
    expect(parseContentDraft(term())).not.toHaveProperty('author');
  });

  it('keeps a validated link between a correction and its published card', () => {
    expect(parseContentDraft(term({ correction: { targetSlug: 'slay', changeNote: 'Уточнил происхождение.' } }))).toMatchObject({
      correction: { targetSlug: 'slay', changeNote: 'Уточнил происхождение.' },
    });
    expect(() => parseContentDraft(term({ correction: { targetSlug: '', changeNote: 'Уточнил.' } }))).toThrow();
    expect(() => parseContentDraft(term({ correction: { targetSlug: 'slay', changeNote: 'я'.repeat(501) } }))).toThrow();
  });

  it('keeps the original snapshot needed for moderation comparison', () => {
    const correction = {
      targetSlug: 'slay', changeNote: 'Уточнил объяснение.',
      original: { title: 'Slay', explanation: 'Старое объяснение.', example: 'Старый пример.', context: 'Чаты.', tags: ['english'] },
    };
    expect(parseContentDraft(term({ correction }))).toMatchObject({ correction });
  });

  it('keeps the original video in a meme correction snapshot', () => {
    const correction = {
      targetSlug: 'рикролл', changeNote: 'Заменил видеоссылку.',
      original: {
        title: 'Рикролл', explanation: 'Старое объяснение.', example: 'Старый пример.', origin: 'История.', tags: [],
        media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' },
      },
    };
    expect(parseContentDraft(meme({ correction }))).toMatchObject({ correction });
  });

  it('keeps optional term origin text for etymology corrections', () => {
    expect(parseContentDraft(term({ origin: 'От английского слова vibe.' }))).toMatchObject({ origin: 'От английского слова vibe.' });
  });

  it('requires exactly one meme media value', () => {
    expect(parseContentDraft(meme())).toMatchObject({ type: 'meme', media: { kind: 'video' } });
    expect(() => parseContentDraft(meme({ media: undefined }))).toThrow();
    expect(() => parseContentDraft(meme({ media: [{ kind: 'video' }, { kind: 'image' }] }))).toThrow();
  });

  it('rejects meme videos outside the supported RuTube and YouTube hosts', () => {
    expect(() => parseContentDraft(meme({ media: { kind: 'video', url: 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ' } }))).toThrow();
    expect(() => parseContentDraft(meme({ media: { kind: 'video', url: 'http://youtube.com/watch?v=dQw4w9WgXcQ' } }))).toThrow();
  });
});
