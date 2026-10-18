import type { ContentItem } from './content.js';

export type ModerationCommand =
  | { type: 'publish' }
  | { type: 'reject'; reason?: string }
  | { type: 'unpublish'; reason?: string }
  | { type: 'delete' };

const allowed: Record<ContentItem['status'], ModerationCommand['type'][]> = {
  pending: ['publish', 'reject'],
  published: ['unpublish', 'delete'],
  rejected: [],
  unpublished: ['publish', 'delete'],
  deleted: [],
};

export function transitionContent(item: ContentItem, command: ModerationCommand, now: Date): ContentItem {
  if (!allowed[item.status].includes(command.type)) {
    throw new Error(`Недопустимый переход из статуса ${item.status}`);
  }

  if ((command.type === 'reject' || command.type === 'unpublish') && !command.reason?.trim()) {
    throw new Error('Для этого действия необходима причина');
  }

  const result: ContentItem = { ...item, updatedAt: now, moderatedAt: now };

  if (command.type === 'publish') {
    return { ...result, status: 'published', publishedAt: now };
  }
  if (command.type === 'reject') {
    return { ...result, status: 'rejected', rejectionReason: command.reason!.trim() };
  }
  if (command.type === 'unpublish') {
    return { ...result, status: 'unpublished', unpublishedReason: command.reason!.trim() };
  }
  return { ...result, status: 'deleted' };
}
