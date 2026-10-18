import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, resolveApiUrl } from './origin.js';

describe('API origin resolver', () => {
  it('uses the local API when no explicit origin is configured', () => {
    expect(resolveApiBaseUrl(undefined, '127.0.0.1')).toBe('http://127.0.0.1:3001');
    expect(resolveApiBaseUrl('', 'localhost')).toBe('http://127.0.0.1:3001');
  });

  it('uses and trims the configured production HTTPS origin', () => {
    expect(resolveApiBaseUrl('  https://api.skufskills.ru///  ', 'skufskills.ru')).toBe('https://api.skufskills.ru');
    expect(resolveApiUrl('/api/content', 'https://api.skufskills.ru/', 'skufskills.ru')).toBe('https://api.skufskills.ru/api/content');
  });

  it('rejects unsafe or malformed production configuration', () => {
    expect(() => resolveApiBaseUrl(undefined, 'skufskills.ru')).toThrow(/VITE_API_BASE_URL/u);
    expect(() => resolveApiBaseUrl('http://api.skufskills.ru', 'skufskills.ru')).toThrow(/HTTPS/u);
    expect(() => resolveApiBaseUrl('not a URL', 'skufskills.ru')).toThrow(/VITE_API_BASE_URL/u);
    expect(() => resolveApiBaseUrl('https://api.skufskills.ru/path', 'skufskills.ru')).toThrow(/origin/u);
  });

  it('requires API paths to start with a slash', () => {
    expect(() => resolveApiUrl('api/content', 'https://api.skufskills.ru', 'skufskills.ru')).toThrow(/slash/u);
  });
});
