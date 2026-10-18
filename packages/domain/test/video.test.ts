import { describe, expect, it } from 'vitest';
import { parseVideoUrl } from '../src/video.js';

describe('parseVideoUrl', () => {
  it.each([
    ['https://rutube.ru/video/0123456789abcdef0123456789abcdef/', 'rutube', 'https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'youtube', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
  ])('parses %s', (url, provider, embedUrl) => {
    expect(parseVideoUrl(url)).toEqual({ provider, videoId: expect.any(String), embedUrl });
  });

  it.each([
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://example.com/video/abc',
    'not a url',
  ])('rejects unsafe URL %s', (url) => expect(() => parseVideoUrl(url)).toThrow());
});
