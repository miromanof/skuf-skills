import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

describe('static security policy', () => {
  it('limits document capabilities without blocking required integrations', () => {
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'self'");
    expect(html).toContain("form-action 'self'");
    expect(html).toContain('connect-src');
    expect(html).toContain('https://api.skufskills.ru');
    expect(html).toContain('https://rutube.ru');
    expect(html).toContain('https://www.youtube.com');
    expect(html).toContain('https://opis-cdn.tinkoffjournal.ru');
  });

  it('does not send referrers to external resources', () => {
    expect(html).toMatch(/<meta\s+name="referrer"\s+content="no-referrer"/);
  });
});

