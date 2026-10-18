import { createHash } from 'node:crypto';
import { parseContentDraft } from '@skuf-skills/domain';
import type { ContentRepository } from '../../ports/content-repository.js';

export class IdempotencyConflictError extends Error {}

export class SubmissionService {
  constructor(private readonly repository: ContentRepository, private readonly now: () => Date) {}

  async submit(raw: unknown, idempotencyKey: string) {
    const draft = parseContentDraft(raw);
    const requestHash = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
    const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new IdempotencyConflictError();
      return { created: false, item: existing.item };
    }
    const item = await this.repository.createPending({ draft, idempotencyKey, requestHash, now: this.now() });
    return { created: true, item };
  }
}
