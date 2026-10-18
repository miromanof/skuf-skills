export type StoredImage = { storageKey: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; size: number; width: number; height: number };

export interface FileStorage {
  saveValidatedImage(buffer: Buffer, originalName: string): Promise<StoredImage>;
  delete(storageKey: string): Promise<void>;
}
