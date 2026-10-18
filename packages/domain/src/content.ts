export type ContentStatus = 'pending' | 'published' | 'rejected' | 'unpublished' | 'deleted';

export type VideoMediaInput = { kind: 'video'; url: string };
export type ImageMediaInput = { kind: 'image'; uploadToken: string };
export type MediaInput = VideoMediaInput | ImageMediaInput;

type SharedDraft = {
  title: string;
  explanation: string;
  example: string;
  tags: string[];
  author?: string;
  correction?: {
    targetSlug: string;
    changeNote: string;
    original?: {
      title: string;
      explanation: string;
      example: string;
      tags: string[];
      context?: string;
      origin?: string;
      media?: MediaInput;
    };
  };
};

export type TermDraft = SharedDraft & { type: 'term'; context: string; origin?: string };
export type MemeDraft = SharedDraft & { type: 'meme'; origin: string; media: MediaInput };
export type ContentDraft = TermDraft | MemeDraft;

export type ContentItem = ContentDraft & {
  id: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  moderatedAt?: Date;
  publishedAt?: Date;
  rejectionReason?: string;
  unpublishedReason?: string;
};
