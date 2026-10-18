import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.js';

describe('published discovery', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('adds newly published API terms to the dictionary', async () => {
    window.location.hash = '#/dictionary';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{
      slug: 'novoe-slovo-12345678', type: 'term', title: 'Новое слово', explanation: 'Проверенное объяснение',
      example: '«Так теперь говорят»', context: 'В переписке', tags: ['новое'], bucket: 'Н', publishedAt: '2026-10-18T00:00:00.000Z',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } })));

    render(<App />);

    const heading = await screen.findByRole('heading', { name: 'Новое слово' });
    expect(within(heading.closest('article') as HTMLElement).getByRole('link', { name: /Открыть карточку/i })).toHaveAttribute('href', '#/dictionary/novoe-slovo-12345678');
  });

  it('keeps the starter dictionary visible when the public API is unavailable', async () => {
    window.location.hash = '#/dictionary';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось обновить словарь');
    expect(screen.getByRole('heading', { name: 'Аура' })).toBeInTheDocument();
  });

  it('opens a newly published card by its public slug', async () => {
    window.location.hash = '#/dictionary/novoe-slovo-12345678';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      slug: 'novoe-slovo-12345678', type: 'term', title: 'Новое слово', explanation: 'Проверенное объяснение',
      example: '«Так теперь говорят»', context: 'В переписке', tags: ['новое'], bucket: 'Н', publishedAt: '2026-10-18T00:00:00.000Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Новое слово' })).toBeInTheDocument();
    expect(screen.getByText('Проверенное объяснение')).toBeInTheDocument();
  });
});
