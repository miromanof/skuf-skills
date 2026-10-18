import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App.js';

const jsonResponse = (body: unknown, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('administrator flow', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    window.location.hash = '';
  });

  it('shows a generic login error and never stores the password', async () => {
    window.location.hash = '#/admin/login';
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ error: 'Неверный логин или пароль' }, 401)));
    render(<App />);

    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'very secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль');
    expect(JSON.stringify(sessionStorage)).not.toContain('very secret');
    expect(JSON.stringify(localStorage)).not.toContain('very secret');
  });

  it('logs in and opens the pending moderation queue', async () => {
    window.location.hash = '#/admin/login';
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse({ authenticated: true, csrfToken: 'csrf-token' }))
      .mockImplementationOnce(() => jsonResponse({ items: [{ id: 'item-1', type: 'term', title: 'Новый вайб', status: 'pending', explanation: 'Описание', example: 'Пример', context: 'Контекст', tags: [], version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z' }] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'valid password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('heading', { name: 'Очередь модерации' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Новый вайб/i })).toHaveAttribute('href', '#/admin/content/item-1');
    expect(sessionStorage.getItem('skuf-admin-csrf')).toBe('csrf-token');
  });

  it('filters the queue and publishes an opened card', async () => {
    window.location.hash = '#/admin';
    sessionStorage.setItem('skuf-admin-csrf', 'csrf-token');
    const item = { id: 'item-1', type: 'term', title: 'Вайб', status: 'pending', explanation: 'Описание', example: 'Пример', context: 'Контекст', tags: [], version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z' };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse({ items: [item] }))
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse(item))
      .mockImplementationOnce(() => jsonResponse({ ...item, status: 'published' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByText('Вайб')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Опубликованные' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('status=published'), expect.anything()));

    window.location.hash = '#/admin/content/item-1';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Редактирование карточки' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/publish'), expect.objectContaining({ method: 'POST' })));
    const publishInit = fetchMock.mock.lastCall?.[1] as RequestInit;
    expect(new Headers(publishInit.headers).get('x-csrf-token')).toBe('csrf-token');
    expect(await screen.findByRole('status')).toHaveTextContent('Карточка опубликована');
  });

  it('preserves an editor draft in session storage when the session expires', async () => {
    window.location.hash = '#/admin/content/item-1';
    sessionStorage.setItem('skuf-admin-csrf', 'csrf-token');
    const item = { id: 'item-1', type: 'term', title: 'Вайб', status: 'pending', explanation: 'Описание', example: 'Пример', context: 'Контекст', tags: [], version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => jsonResponse(item)).mockImplementationOnce(() => jsonResponse({ error: 'Требуется вход администратора' }, 401)));
    render(<App />);

    const explanation = await screen.findByLabelText('Объяснение');
    fireEvent.change(explanation, { target: { value: 'Несохранённое уточнение' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() => expect(window.location.hash).toBe('#/admin/login'));
    expect(sessionStorage.getItem('skuf-admin-draft:item-1')).toContain('Несохранённое уточнение');
  });

  it('previews and saves an editable external video for a meme', async () => {
    window.location.hash = '#/admin/content/meme-1';
    sessionStorage.setItem('skuf-admin-csrf', 'csrf-token');
    const item = {
      id: 'meme-1', type: 'meme', title: 'Рикролл', status: 'pending', explanation: 'Неожиданная подмена ссылки.',
      example: '«Опять рикролл»', origin: 'Интернет-розыгрыш.', tags: ['розыгрыш'],
      media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' },
      version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z',
    };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(item))
      .mockImplementationOnce(() => jsonResponse({ ...item, origin: 'Обновлённая история.', media: { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByLabelText('Происхождение')).toHaveValue('Интернет-розыгрыш.');
    expect(screen.getByLabelText('Ссылка на видео')).toHaveValue(item.media.url);
    expect(screen.getByTitle('Превью видео мема')).toHaveAttribute('src', expect.stringContaining('rutube.ru/play/embed/'));

    fireEvent.change(screen.getByLabelText('Происхождение'), { target: { value: 'Обновлённая история.' } });
    fireEvent.change(screen.getByLabelText('Ссылка на видео'), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const saveInit = fetchMock.mock.lastCall?.[1] as RequestInit;
    expect(JSON.parse(String(saveInit.body))).toMatchObject({
      draft: { type: 'meme', origin: 'Обновлённая история.', media: { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' } },
    });
  });

  it('shows correction changes field-by-field with old and proposed values side by side', async () => {
    window.location.hash = '#/admin/content/correction-1';
    sessionStorage.setItem('skuf-admin-csrf', 'csrf-token');
    const item = {
      id: 'correction-1', type: 'term', title: 'Новый вайб', status: 'pending', explanation: 'Новое объяснение', example: 'Пример', context: 'Контекст', tags: [],
      correction: { targetSlug: 'вайб', changeNote: 'Уточнил название и смысл.', original: { title: 'Вайб', explanation: 'Старое объяснение', example: 'Пример', context: 'Контекст', tags: [] } },
      version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(item)));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Что предлагают изменить' })).toBeInTheDocument();
    expect(screen.getByText('Уточнил название и смысл.')).toBeInTheDocument();
    const titleRow = screen.getByTestId('comparison-title');
    expect(titleRow).toHaveTextContent('БылоВайб');
    expect(titleRow).toHaveTextContent('СталоНовый вайб');
    expect(screen.queryByTestId('comparison-example')).not.toBeInTheDocument();
  });

  it('accepts or rejects each proposed field into the editable draft', async () => {
    window.location.hash = '#/admin/content/correction-1';
    sessionStorage.setItem('skuf-admin-csrf', 'csrf-token');
    const item = {
      id: 'correction-1', type: 'term', title: 'Новый вайб', status: 'pending', explanation: 'Новое объяснение', example: 'Пример', context: 'Контекст', tags: [],
      correction: { targetSlug: 'вайб', changeNote: 'Уточнил название и смысл.', original: { title: 'Вайб', explanation: 'Старое объяснение', example: 'Пример', context: 'Контекст', tags: [] } },
      version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(item)));
    render(<App />);

    const title = await screen.findByLabelText('Название');
    expect(title).toHaveValue('Новый вайб');

    fireEvent.click(screen.getByRole('button', { name: 'Отклонить изменение «Название»' }));
    expect(title).toHaveValue('Вайб');
    expect(screen.getByTestId('comparison-title')).toHaveTextContent('СталоНовый вайб');

    fireEvent.click(screen.getByRole('button', { name: 'Принять изменение «Название»' }));
    expect(title).toHaveValue('Новый вайб');
    expect(screen.getByRole('button', { name: 'Принять изменение «Название»' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('compares and rejects a proposed meme video link', async () => {
    window.location.hash = '#/admin/content/meme-correction-1';
    sessionStorage.setItem('skuf-admin-csrf', 'csrf-token');
    const oldUrl = 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/';
    const newUrl = 'https://youtu.be/dQw4w9WgXcQ';
    const item = {
      id: 'meme-correction-1', type: 'meme', title: 'Рикролл', status: 'pending', explanation: 'Объяснение', example: 'Пример', origin: 'История', tags: [],
      media: { kind: 'video', url: newUrl },
      correction: {
        targetSlug: 'рикролл', changeNote: 'Заменил видеоссылку.',
        original: { title: 'Рикролл', explanation: 'Объяснение', example: 'Пример', origin: 'История', tags: [], media: { kind: 'video', url: oldUrl } },
      },
      version: '2026-10-18T00:00:00.000Z', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(item)));
    render(<App />);

    const mediaRow = await screen.findByTestId('comparison-media');
    expect(mediaRow).toHaveTextContent(`Было${oldUrl}`);
    expect(mediaRow).toHaveTextContent(`Стало${newUrl}`);
    expect(screen.getByLabelText('Ссылка на видео')).toHaveValue(newUrl);

    fireEvent.click(screen.getByRole('button', { name: 'Отклонить изменение «Ссылка на видео»' }));
    expect(screen.getByLabelText('Ссылка на видео')).toHaveValue(oldUrl);
  });
});
