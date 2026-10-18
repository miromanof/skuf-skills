import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('introduces Skuf Skills as a bridge between generations', () => {
    window.location.hash = '#/';
    const { container } = render(<App />);

    expect(screen.getByRole('link', { name: 'Skuf Skills — на главную' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Хочешь быть сигмой? Для начала узнай, кто это' })).toBeInTheDocument();
    expect(screen.queryByText('Все карточки проверяет редакция перед публикацией.')).not.toBeInTheDocument();
    expect(screen.queryByText(/01 \/ Слова/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/02 \/ Мемы/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Проект от школьников для взрослых/i)).not.toBeInTheDocument();
    expect(screen.getByText('Словарь поколений')).toBeInTheDocument();
    expect(screen.queryByText(/который пишут школьники/i)).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Найти слово или мем' })).toHaveAttribute('placeholder', 'имба');
    expect(screen.getByRole('button', { name: /^Найти$/ })).toBeInTheDocument();
    expect(container.querySelector('.suggest .button')).toHaveTextContent(/^Добавить карточку$/);
    expect(screen.getByText('Скуф сегодня, сигма завтра')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Бабрбук' })).toHaveAttribute('href', 'https://babrbook.com');
    expect(screen.queryByRole('heading', { name: 'Что сейчас говорят' })).not.toBeInTheDocument();
  });

  it('repeats the full ticker sequence for a seamless loop', () => {
    window.location.hash = '#/';
    const { container } = render(<App />);

    const sequences = container.querySelectorAll('.ticker__sequence');
    expect(sequences).toHaveLength(2);
    expect(sequences[0]?.textContent).toBe('БАЗА • ВАЙБ • ИМБА • РОФЛ • СИГМА • КРИНЖ • АУРА • ');
    expect(sequences[1]?.textContent).toBe(sequences[0]?.textContent);
  });

  it('links the quiz from the header and home call to action', () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByRole('link', { name: 'Тест' })).toHaveAttribute('href', '#/quiz');
    expect(screen.getByRole('link', { name: 'Пройти тест' })).toHaveAttribute('href', '#/quiz');

    window.location.hash = '#/quiz';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('heading', { name: /насколько ты не скуф/i })).toBeInTheDocument();
  });

  it('gives the quiz and submission calls to action distinct visual identities', () => {
    window.location.hash = '#/';
    const { container } = render(<App />);

    expect(container.querySelector('.quiz-home-cta__score')).toHaveTextContent('10/10');
    expect(screen.getByText('На модерацию')).toBeInTheDocument();
    expect(container.querySelector('.suggest__label')).toHaveTextContent('На модерацию');
  });

  it('opens dictionary results from the home search', async () => {
    window.location.hash = '#/';
    render(<App />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти слово или мем' }), { target: { value: 'имба' } });
    fireEvent.click(screen.getByRole('button', { name: /^Найти$/ }));

    await waitFor(() => expect(window.location.hash).toBe('#/dictionary?q=%D0%B8%D0%BC%D0%B1%D0%B0'));
    expect(screen.getByRole('searchbox', { name: /поиск по словарю/i })).toHaveValue('имба');
    expect(screen.getByRole('heading', { name: 'Имба' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Аура' })).not.toBeInTheDocument();
  });

  it('shows dictionary content only on the dictionary route', () => {
    window.location.hash = '#/dictionary';
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: /Словарь От А до Я/i })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('.page-intro h1 > span')).map((node) => node.textContent)).toEqual(['Словарь', 'От А до Я']);
    expect(screen.getByRole('heading', { name: 'Вайб' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Дайте Оскар' })).not.toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('.term-card__meta')).some((node) => node.textContent === 'Словарь')).toBe(false);
  });

  it('filters dictionary cards by letter and shows an empty state', () => {
    window.location.hash = '#/dictionary';
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'В' }));
    expect(screen.getByRole('heading', { name: 'Вайб' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Аура' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'В' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Ж' }));
    expect(screen.getByText(/на эту букву пока ничего нет/i)).toBeInTheDocument();
  });

  it('keeps the current scroll position when a dictionary letter changes', async () => {
    window.location.hash = '#/dictionary';
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.documentElement.scrollTop = 720;
    document.body.scrollTop = 720;

    fireEvent.click(screen.getByRole('button', { name: 'И' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.hash).toBe('#/dictionary?letter=%D0%98');
    expect(document.documentElement.scrollTop).toBe(720);
    expect(document.body.scrollTop).toBe(720);
    expect(screen.getByRole('button', { name: 'И' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('finds one bilingual card by English and Russian spelling', () => {
    window.location.hash = '#/dictionary';
    render(<App />);

    const search = screen.getByRole('searchbox', { name: /поиск по словарю/i });
    fireEvent.change(search, { target: { value: 'slay' } });
    expect(screen.getByRole('heading', { name: /слей/i })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'слэй' } });
    expect(screen.getByRole('heading', { name: /слей/i })).toBeInTheDocument();
  });

  it('finds cards by their usage example and context', () => {
    window.location.hash = '#/dictionary';
    render(<App />);

    const search = screen.getByRole('searchbox', { name: /поиск по словарю/i });
    fireEvent.change(search, { target: { value: 'кофейни' } });
    expect(screen.getByRole('heading', { name: 'Вайб' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Имба' })).not.toBeInTheDocument();
  });

  it('shows a search-specific empty state', () => {
    window.location.hash = '#/dictionary?q=%D0%BD%D0%B5%D1%82%D1%82%D0%B0%D0%BA%D0%BE%D0%B3%D0%BE';
    render(<App />);

    expect(screen.getByRole('searchbox', { name: /поиск по словарю/i })).toHaveValue('неттакого');
    expect(screen.getByRole('heading', { name: /ничего не нашли/i })).toBeInTheDocument();
    expect(screen.queryByText(/на эту букву пока ничего нет/i)).not.toBeInTheDocument();
  });

  it('clears a dictionary search when a letter is selected', () => {
    window.location.hash = '#/dictionary';
    render(<App />);

    const search = screen.getByRole('searchbox', { name: /поиск по словарю/i });
    fireEvent.change(search, { target: { value: 'скуф' } });
    expect(screen.getByRole('heading', { name: 'Скуф' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'E' }));
    expect(search).toHaveValue('');
    expect(screen.queryByRole('heading', { name: 'Скуф' })).not.toBeInTheDocument();
  });

  it('uses canonical bilingual titles for alphabet sections, not search aliases', () => {
    window.location.hash = '#/dictionary';
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.queryByRole('heading', { name: 'No cap / Ноу кэп' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'N' }));
    expect(screen.getByRole('heading', { name: 'NPC / Энписи' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No cap / Ноу кэп' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Н' }));
    expect(screen.getByRole('heading', { name: 'Нормис' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ноу кэп / No cap' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /NPC/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Э' }));
    expect(screen.getByRole('heading', { name: 'Энписи / NPC' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Эл / L' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /FYP/i })).not.toBeInTheDocument();
  });

  it('cycles six distinct card colors instead of repeating colors by column', () => {
    window.location.hash = '#/dictionary';
    const { container } = render(<App />);

    const firstSixColors = Array.from(container.querySelectorAll('.card-grid--dictionary .term-card')).slice(0, 6).map((card) =>
      Array.from(card.classList).find((className) => className.startsWith('term-card--') && className !== 'term-card--media'),
    );
    expect(new Set(firstSixColors).size).toBe(6);
  });

  it('keeps supporting term metadata out of compact previews and in the opened card', () => {
    window.location.hash = '#/dictionary?letter=С';
    render(<App />);

    expect(screen.queryByText(/от английского slay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ищут также/i)).not.toBeInTheDocument();

    cleanup();
    window.location.hash = '#/dictionary/slay';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Происхождение' })).toBeInTheDocument();
    expect(screen.getByText(/от английского slay/i)).toBeInTheDocument();
  });

  it('indexes bilingual cards in both alphabets and follows the selected layout', () => {
    window.location.hash = '#/dictionary';
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'S' }));
    expect(screen.getByRole('heading', { name: 'Slay / Слей' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sus / Сас' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'С' }));
    expect(screen.getByRole('heading', { name: 'Слей / Slay' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сигма' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Скуф' })).toBeInTheDocument();
  });

  it('opens a complete term page without the redundant plus action', () => {
    window.location.hash = '#/dictionary/slay';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Slay / Слей' })).toBeInTheDocument();
    expect(screen.getByText('Применение в речи')).toBeInTheDocument();
    expect(screen.getByText('Контекст')).toBeInTheDocument();
    expect(screen.getByText('Эмоциональный окрас')).toBeInTheDocument();
    expect(screen.getByText('Позитивный')).toBeInTheDocument();
    expect(screen.getByText('Происхождение')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /сохранить/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /назад в словарь/i })).toHaveAttribute('href', '#/dictionary');
  });

  it('opens a prefilled correction form from a published term', () => {
    window.location.hash = '#/dictionary/slay';
    render(<App />);

    expect(screen.getByRole('link', { name: /предложить изменения/i })).toHaveAttribute('href', '#/submit?edit=slay');

    cleanup();
    window.location.hash = '#/submit?edit=slay';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Предложить изменения' })).toBeInTheDocument();
    expect(screen.getByLabelText('Термин')).toHaveValue('Slay / Слей');
    expect(screen.getByLabelText('Объяснение')).toHaveValue('Восхищение тем, как кто-то выглядит или что-то сделал: «блестяще», «разрыв».');
    expect(screen.getByLabelText('Пример употребления')).toHaveValue('«Этот образ — слей!»');
    expect(screen.getByLabelText('Что вы изменили?')).toBeRequired();
  });

  it('sends a correction as a linked moderation proposal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'pending', submissionId: 'proposal-1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    window.location.hash = '#/submit?edit=slay';
    render(<App />);

    fireEvent.change(screen.getByLabelText('Что вы изменили?'), { target: { value: 'Уточнил происхождение.' } });
    fireEvent.submit(screen.getByRole('button', { name: /отправить на модерацию/i }).closest('form')!);

    await waitFor(() => expect(screen.getByText(/предложение отправлено/i)).toBeInTheDocument());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      type: 'term',
      title: 'Slay / Слей',
      correction: { targetSlug: 'slay', changeNote: 'Уточнил происхождение.' },
    });
  });

  it('prefills and sends a video meme correction with its original snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'pending', submissionId: 'meme-proposal-1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    window.location.hash = '#/submit?edit=рикролл';
    render(<App />);

    expect(screen.getByLabelText('Название мема')).toHaveValue('Рикролл');
    expect(screen.getByLabelText('Объяснение смысла')).toHaveValue('Розыгрыш: ссылка обещает один материал, но неожиданно открывает клип Never Gonna Give You Up.');
    expect(screen.getByLabelText('Пример ситуации')).toHaveValue('«Мне прислали важную инструкцию, а там снова рикролл»');
    expect(screen.getByLabelText('Происхождение')).toHaveValue('Мем вырос из интернет-розыгрышей 2007 года и получил название от имени исполнителя Рика Эстли.');
    expect(screen.getByLabelText('Ссылка на RuTube или YouTube')).toHaveValue('https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/');
    expect(screen.getByTitle('Превью видео мема')).toHaveAttribute('src', 'https://rutube.ru/play/embed/213843b86f37d3f56a1b23dd6ea784a5');
    expect(screen.queryByLabelText('Контекст')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ссылка на RuTube или YouTube'), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.change(screen.getByLabelText('Что вы изменили?'), { target: { value: 'Заменил видеоссылку.' } });
    fireEvent.submit(screen.getByRole('button', { name: /отправить на модерацию/i }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Предложение отправлено'));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      type: 'meme',
      media: { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' },
      correction: {
        targetSlug: 'рикролл',
        original: { media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' } },
      },
    });
  });

  it('loads a published remote meme before opening its correction form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      slug: 'novyi-mem', type: 'meme', title: 'Новый мем', explanation: 'Смысл мема.', example: '«Пример»', origin: 'История мема.', tags: ['реакция'],
      media: { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' }, bucket: '#', publishedAt: '2026-10-18T00:00:00.000Z',
    }), { status: 200 })));
    window.location.hash = '#/submit?edit=novyi-mem';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Загружаем карточку…' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Название мема')).toHaveValue('Новый мем');
    expect(screen.getByLabelText('Ссылка на RuTube или YouTube')).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
  });

  it('lets a visitor choose and submit a new term without registration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'pending', submissionId: 'term-1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    window.location.hash = '#/submit';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Что добавляем?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Термин' }));
    expect(screen.getByLabelText('Контекст')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ссылка на RuTube или YouTube')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Слово года' } });
    fireEvent.change(screen.getByLabelText('Простое объяснение'), { target: { value: 'Понятное значение.' } });
    fireEvent.change(screen.getByLabelText('Пример употребления'), { target: { value: '«Это слово года»' } });
    fireEvent.change(screen.getByLabelText('Контекст'), { target: { value: 'В переписке.' } });
    fireEvent.change(screen.getByLabelText('Теги через запятую'), { target: { value: 'общение, тренд' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Отправить на модерацию' }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Карточка отправлена'));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).get('idempotency-key')).toHaveLength(36);
    expect(JSON.parse(String(request.body))).toEqual({
      type: 'term', title: 'Слово года', explanation: 'Понятное значение.', example: '«Это слово года»', context: 'В переписке.', tags: ['общение', 'тренд'],
    });
  });

  it('previews and submits a new video meme', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'pending', submissionId: 'meme-1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    window.location.hash = '#/submit';
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Мем' }));
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Рикролл' } });
    fireEvent.change(screen.getByLabelText('Объяснение смысла'), { target: { value: 'Неожиданная подмена ссылки.' } });
    fireEvent.change(screen.getByLabelText('Пример ситуации'), { target: { value: '«Опять рикролл»' } });
    fireEvent.change(screen.getByLabelText('Происхождение'), { target: { value: 'Интернет-розыгрыш.' } });
    fireEvent.change(screen.getByLabelText('Ссылка на RuTube или YouTube'), { target: { value: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' } });

    expect(screen.getByTitle('Превью видео мема')).toHaveAttribute('src', 'https://rutube.ru/play/embed/213843b86f37d3f56a1b23dd6ea784a5');
    fireEvent.submit(screen.getByRole('button', { name: 'Отправить на модерацию' }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Карточка отправлена'));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      type: 'meme', title: 'Рикролл', explanation: 'Неожиданная подмена ссылки.', example: '«Опять рикролл»', origin: 'Интернет-розыгрыш.', tags: [],
      media: { kind: 'video', url: 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/' },
    });
  });

  it('keeps the new-card heading concise', () => {
    window.location.hash = '#/submit';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Добавить карточку' })).toBeInTheDocument();
    expect(screen.queryByText('Без регистрации · после модерации')).not.toBeInTheDocument();
  });

  it('shows meme content only on the memology route', () => {
    window.location.hash = '#/memology';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Мемология' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Рикролл' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Вайб' })).not.toBeInTheDocument();
  });

  it('shows the approved 2024–2026 meme collection with external previews', () => {
    window.location.hash = '#/memology';
    const { container } = render(<App />);

    const years = Array.from(container.querySelectorAll('.term-card__year')).map((node) => node.textContent);
    expect(years.filter((year) => year === '2024')).toHaveLength(5);
    expect(years.filter((year) => year === '2025')).toHaveLength(5);
    expect(years.filter((year) => year === '2026')).toHaveLength(14);
    const datedCards = Array.from(container.querySelectorAll('.term-card')).filter((card) => card.querySelector('.term-card__year'));
    expect(datedCards.filter((card) => card.querySelector('.term-card__preview img, .term-card__preview iframe'))).toHaveLength(24);
  });

  it('gives very long meme headings enough room for three lines', () => {
    window.location.hash = '#/memology';
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Возьми телефон, детка' })).toHaveClass('term-card__title--very-long');
    expect(screen.getByRole('heading', { name: 'Обезьянка Панч' })).not.toHaveClass('term-card__title--very-long');
  });

  it('shows a meme year and its editorial source on the detail page', () => {
    window.location.hash = '#/memology/грустный-хомяк';
    render(<App />);

    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Т—Ж: лучшие мемы 2024 ↗' })).toHaveAttribute('href', 'https://t-j.ru/list/best-memes-2024/');
  });

  it('shows a lazy external preview and an original link for a video meme', () => {
    window.location.hash = '#/memology';
    render(<App />);

    const preview = screen.getByTitle('Превью мема «Рикролл»');
    expect(preview).toHaveAttribute('src', 'https://rutube.ru/play/embed/213843b86f37d3f56a1b23dd6ea784a5');
    expect(preview).toHaveAttribute('loading', 'lazy');

    cleanup();
    window.location.hash = '#/memology/рикролл';
    render(<App />);

    expect(screen.getByTitle('Видео мема «Рикролл»')).toHaveAttribute('src', 'https://rutube.ru/play/embed/213843b86f37d3f56a1b23dd6ea784a5');
    expect(screen.getByRole('link', { name: 'Открыть оригинал на RuTube ↗' })).toHaveAttribute('href', 'https://rutube.ru/video/213843b86f37d3f56a1b23dd6ea784a5/');
  });
});

