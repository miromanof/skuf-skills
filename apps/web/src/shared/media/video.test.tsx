import { describe, expect, it } from 'vitest';
import { parseExternalVideoUrl } from './video.js';

describe('external video links', () => {
  it.each([
    ['https://rutube.ru/video/0123456789abcdef0123456789abcdef/', 'rutube', 'https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ])('builds a safe embed for %s', (url, provider, embedUrl) => {
    expect(parseExternalVideoUrl(url)).toEqual({ provider, embedUrl });
  });

  it.each([
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://example.com/video/abc',
  ])('rejects an unsafe video URL: %s', (url) => {
    expect(() => parseExternalVideoUrl(url)).toThrow('Неподдерживаемая ссылка на видео');
  });
});
