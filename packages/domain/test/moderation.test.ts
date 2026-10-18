import { describe, expect, it } from 'vitest';
import type { ContentItem } from '../src/content.js';
import { transitionContent } from '../src/moderation.js';

const createdAt = new Date('2026-10-18T00:00:00.000Z');
const now = new Date('2026-10-18T01:00:00.000Z');
const item = (status: ContentItem['status']): ContentItem => ({
  id: 'content-1',
  type: 'term',
  status,
  title: 'вайб',
  explanation: 'Атмосфера.',
  example: 'Хороший вайб.',
  context: 'Неформально.',
  tags: [],
  createdAt,
  updatedAt: createdAt,
});

describe('transitionContent', () => {
  it.each([
    ['pending', { type: 'publish' }, 'published'],
    ['pending', { type: 'reject', reason: 'Недостаточно контекста' }, 'rejected'],
    ['published', { type: 'unpublish', reason: 'Нужна проверка' }, 'unpublished'],
    ['published', { type: 'delete' }, 'deleted'],
    ['unpublished', { type: 'publish' }, 'published'],
    ['unpublished', { type: 'delete' }, 'deleted'],
  ] as const)('allows %s -> %s', (from, command, to) => {
    expect(transitionContent(item(from), command, now).status).toBe(to);
  });

  it.each([
    ['pending', { type: 'unpublish', reason: 'Нет' }],
    ['published', { type: 'reject', reason: 'Нет' }],
    ['rejected', { type: 'publish' }],
    ['deleted', { type: 'publish' }],
  ] as const)('rejects invalid transition from %s', (from, command) => {
    expect(() => transitionContent(item(from), command, now)).toThrow(/переход/i);
  });

  it.each([{ type: 'reject' }, { type: 'unpublish' }] as const)('requires a reason for $type', (command) => {
    expect(() => transitionContent(item(command.type === 'reject' ? 'pending' : 'published'), command, now)).toThrow(/причин/i);
  });

  it('sets moderation dates and does not mutate the source', () => {
    const source = item('pending');
    const result = transitionContent(source, { type: 'publish' }, now);

    expect(result).toMatchObject({ status: 'published', updatedAt: now, moderatedAt: now, publishedAt: now });
    expect(source).toEqual(item('pending'));
  });
});
