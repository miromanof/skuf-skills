import { parseContentDraft, transitionContent, type ContentDraft, type ContentItem, type ContentStatus, type ModerationCommand } from '@skuf-skills/domain';
import type { ContentRepository } from '../../ports/content-repository.js';
import type { FileStorage } from '../../ports/file-storage.js';

export class NotFoundError extends Error {}
export class VersionConflictError extends Error {
  constructor(public readonly current: ContentItem) { super('Карточка уже изменена в другой вкладке'); }
}
export class InvalidModerationError extends Error {}
export class StateConflictError extends Error {}

export function adminContentDto(item: ContentItem) {
  return { ...item, version: item.updatedAt.toISOString() };
}

function expectedVersion(value: string): Date {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new InvalidModerationError('Некорректная версия карточки');
  return parsed;
}

export class ModerationService {
  public constructor(
    private readonly repository: ContentRepository,
    private readonly files?: FileStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(status?: ContentStatus): Promise<ContentItem[]> {
    return this.repository.listForAdmin(status ? { status } : {});
  }

  async get(id: string): Promise<ContentItem> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundError('Карточка не найдена');
    return item;
  }

  private async current(id: string, version: string): Promise<{ item: ContentItem; expected: Date }> {
    const item = await this.get(id);
    const expected = expectedVersion(version);
    if (item.updatedAt.getTime() !== expected.getTime()) throw new VersionConflictError(item);
    return { item, expected };
  }

  private async persist(item: ContentItem, expected: Date): Promise<ContentItem> {
    const saved = await this.repository.update(item, expected);
    if (saved) return saved;
    throw new VersionConflictError(await this.get(item.id));
  }

  async edit(id: string, version: string, input: unknown): Promise<ContentItem> {
    const { item, expected } = await this.current(id, version);
    const draft = parseContentDraft(input);
    if (draft.type !== item.type) throw new InvalidModerationError('Тип карточки нельзя изменить');
    return this.persist({ ...item, ...draft, updatedAt: this.now() }, expected);
  }

  async transition(id: string, version: string, command: ModerationCommand): Promise<ContentItem> {
    const { item, expected } = await this.current(id, version);
    let next: ContentItem;
    try {
      next = transitionContent(item, command, this.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Недопустимое действие';
      if (message.startsWith('Недопустимый переход')) throw new StateConflictError(message);
      throw new InvalidModerationError(message);
    }
    return this.persist(next, expected);
  }

  async delete(id: string, version: string): Promise<void> {
    const { item, expected } = await this.current(id, version);
    let deleted: ContentItem;
    try {
      deleted = transitionContent(item, { type: 'delete' }, this.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Недопустимое действие';
      if (message.startsWith('Недопустимый переход')) throw new StateConflictError(message);
      throw new InvalidModerationError(message);
    }
    const tombstone: ContentItem = item.type === 'term'
      ? { id: item.id, type: 'term', title: 'Удалено', explanation: '', example: '', context: '', tags: [], status: 'deleted', createdAt: item.createdAt, updatedAt: deleted.updatedAt, moderatedAt: deleted.moderatedAt ?? deleted.updatedAt }
      : { id: item.id, type: 'meme', title: 'Удалено', explanation: '', example: '', origin: '', media: { kind: 'video', url: 'https://rutube.ru/' }, tags: [], status: 'deleted', createdAt: item.createdAt, updatedAt: deleted.updatedAt, moderatedAt: deleted.moderatedAt ?? deleted.updatedAt };
    await this.persist(tombstone, expected);
    if (item.type === 'meme' && item.media.kind === 'image' && this.files) await this.files.delete(item.media.uploadToken);
  }
}
