import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { parseExternalVideoUrl, type ExternalVideo } from './shared/media/video.js';
import { ThemeSwitch } from './shared/theme/ThemeSwitch.js';
import { AdminLoginPage } from './features/admin/AdminLoginPage.js';
import { AdminQueuePage } from './features/admin/AdminQueuePage.js';
import { AdminEditorPage } from './features/admin/AdminEditorPage.js';
import { publicRequest, type PublicContent } from './shared/api/client.js';
import { apiUrl } from './shared/api/origin.js';
import { createIdempotencyKey } from './shared/idempotency-key.js';
import { QuizPage } from './features/quiz/QuizPage.js';
import { dictionaryCards, memeCards, type Card } from './content/builtin-cards.js';

type Route = 'home' | 'dictionary' | 'memology' | 'quiz' | 'submit' | 'admin-login' | 'admin';
type Tone = 'Позитивный' | 'Негативный' | 'Нейтральный' | 'Ироничный';

const alphabet = ['Все', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'А', 'Б', 'В', 'Г', 'Д', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'Ф', 'Х', 'Ч', 'Ш', 'Э', 'Ю', 'Я', '#'];
const cardPalette = ['violet', 'lime', 'pink', 'cyan', 'orange', 'yellow'];
const negativeTerms = new Set(['Кринж', 'Тильт', 'NPC / Энписи', 'Sus / Сас', 'Mid / Мид', 'L / Эл']);
const positiveTerms = new Set(['База', 'Вайб', 'Имба', 'Ризз', 'Рофл', 'Флексить', 'Чиназес', 'Slay / Слей', 'GOAT / Гоут', 'Ate / Эйт', 'Bestie / Бести', 'Glow-up / Глоу-ап', 'W / Дабл-ю']);
const neutralTerms = new Set(['Лор', 'Шипперить', 'AFK / АФК', 'OFC / Офк', 'IRL / ИРЛ', 'POV / ПОВ', 'FYP / ФУП']);

function cardTone(card: Card): Tone {
  if (negativeTerms.has(card.title)) return 'Негативный';
  if (positiveTerms.has(card.title)) return 'Позитивный';
  if (neutralTerms.has(card.title)) return 'Нейтральный';
  return 'Ироничный';
}

function cardContext(card: Card): string {
  if (card.context) return card.context;
  if (card.type === 'English') return 'Встречается в переписке, игровых чатах, комментариях и коротких видео. В русской речи используют как оригинальное написание, так и фонетическую запись кириллицей.';
  if (card.type === 'Мемология') return 'Используется как реакция в комментариях, переписке и под видео. Смысл обычно считывается по ситуации и подаче.';
  return 'Употребляется в неформальной речи, переписке, комментариях и соцсетях. Интонация и отношения между собеседниками могут менять оттенок значения.';
}

function cardSlug(card: Card): string {
  if (card.slug) return card.slug;
  return card.aliases?.find((alias) => /^[a-z0-9]/i.test(alias))?.replace(/\s+/g, '-') ?? card.title.toLocaleLowerCase('ru-RU').replace(/\s+/g, '-');
}

function publicCard(item: PublicContent, index = 0): Card {
  const accents = ['violet', 'orange', 'lime'];
  return {
    type: item.type === 'meme' ? 'Мемология' : 'Словарь', title: item.title, text: item.explanation,
    example: item.example, accent: accents[index % accents.length] ?? 'violet', slug: item.slug,
    aliases: item.tags, ...(item.origin ? { etymology: item.origin } : {}), ...(item.context ? { context: item.context } : {}),
    ...(item.media?.kind === 'video' ? { media: item.media } : {}),
  };
}

function videoDetails(card: Card): ExternalVideo | null {
  if (card.media?.kind !== 'video') return null;
  try { return parseExternalVideoUrl(card.media.url); } catch { return null; }
}

function MediaPreview({ card, compact = false }: { card: Card; compact?: boolean }) {
  if (card.media?.kind === 'image') {
    return (
      <div className={`meme-media term-card__preview${compact ? ' meme-media--compact' : ''}`}>
        <img src={card.media.url} alt={card.media.alt} loading="lazy" referrerPolicy="no-referrer" />
        {!compact && card.source && <a href={card.source.url} target="_blank" rel="noopener noreferrer">{card.source.label} ↗</a>}
      </div>
    );
  }
  const video = videoDetails(card);
  const sourceUrl = card.media?.url;
  if (!video) return compact ? <div className="meme-media meme-media--missing">Превью недоступно</div> : null;
  const platform = video.provider === 'rutube' ? 'RuTube' : 'YouTube';
  return (
    <div className={`meme-media term-card__preview${compact ? ' meme-media--compact' : ''}`}>
      <iframe src={video.embedUrl} title={`${compact ? 'Превью' : 'Видео'} мема «${card.title}»`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      {!compact && sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Открыть оригинал на {platform} ↗</a>}
    </div>
  );
}

function usePublicCards(type: 'term' | 'meme') {
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | undefined;
    setError(false);
    const load = () => {
      void publicRequest<{ items: PublicContent[] }>(`/api/content?type=${type}&limit=50`, controller.signal)
        .then((result) => {
          setCards(result.items.map(publicCard));
          setError(false);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return;
          setError(true);
          retryTimer = window.setTimeout(load, 3_000);
        });
    };
    load();
    return () => {
      controller.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [type]);
  return { cards, error };
}

function currentRoute(): Route {
  if (window.location.hash.startsWith('#/admin/login')) return 'admin-login';
  if (window.location.hash.startsWith('#/admin')) return 'admin';
  if (window.location.hash.startsWith('#/dictionary')) return 'dictionary';
  if (window.location.hash.startsWith('#/memology')) return 'memology';
  if (window.location.hash.startsWith('#/quiz')) return 'quiz';
  if (window.location.hash.startsWith('#/submit')) return 'submit';
  return 'home';
}

function Header({ route }: { route: Route }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="Skuf Skills — на главную"><span>SKUF</span><span>СКИЛС</span></a>
      <nav aria-label="Основная навигация">
        <a className={route === 'dictionary' ? 'nav-active' : ''} href="#/dictionary">Словарь</a>
        <a className={route === 'memology' ? 'nav-active' : ''} href="#/memology">Мемология</a>
        <a className={route === 'quiz' ? 'nav-active' : ''} href="#/quiz">Тест</a>
        <a className="nav-accent" href="#/submit">Добавить карточку</a>
      </nav>
      <ThemeSwitch />
    </header>
  );
}

function TermCard({ card, russianFirst = false, returnLetter, accent }: { card: Card; russianFirst?: boolean; returnLetter?: string; accent?: string }) {
  const titleParts = card.title.split(' / ');
  const displayTitle = russianFirst && titleParts.length === 2 ? `${titleParts[1]} / ${titleParts[0]}` : card.title;
  const titleClassName = displayTitle.length > 20 ? 'term-card__title--very-long' : displayTitle.length > 14 ? 'term-card__title--long' : undefined;
  const showMeta = card.type !== 'Словарь' || card.year !== undefined;
  return (
    <article className={`term-card term-card--${accent ?? card.accent}${card.media ? ' term-card--media' : ''}`}>
      {showMeta && <div className="term-card__meta"><span>{card.type}</span>{card.year && <span className="term-card__year">{card.year}</span>}</div>}
      {card.media && <MediaPreview card={card} compact />}
      <h3 className={titleClassName}>{displayTitle}</h3>
      <p>{card.text}</p>
      <blockquote>{card.example}</blockquote>
      <a className="term-card__open" href={`#/${card.type === 'Мемология' ? 'memology' : 'dictionary'}/${encodeURIComponent(cardSlug(card))}${returnLetter && returnLetter !== 'Все' ? `?from=${encodeURIComponent(returnLetter)}` : ''}`}>Открыть карточку <span>↗</span></a>
    </article>
  );
}

function TermDetail({ card }: { card: Card }) {
  const from = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('from');
  const basePath = card.type === 'Мемология' ? '#/memology' : '#/dictionary';
  const backHref = from ? `${basePath}?letter=${encodeURIComponent(from)}` : basePath;
  return (
    <article className="term-detail">
      <a className="term-detail__back" href={backHref}>← Назад в {card.type === 'Мемология' ? 'мемологию' : 'словарь'}</a>
      <p className="eyebrow"><span /> {card.type}</p>
      <h1>{card.title}</h1>
      {card.year && <p className="term-detail__year">{card.year}</p>}
      {card.aliases && <p className="term-detail__aliases">Также пишут и ищут: {card.aliases.join(' · ')}</p>}
      {card.media && <MediaPreview card={card} />}
      <div className="term-detail__grid">
        <section><h2>Объяснение</h2><p>{card.text}</p></section>
        <section><h2>Применение в речи</h2><blockquote>{card.example}</blockquote></section>
        <section><h2>Контекст</h2><p>{cardContext(card)}</p></section>
        <section><h2>Эмоциональный окрас</h2><strong className={`tone tone--${cardTone(card).toLocaleLowerCase('ru-RU')}`}>{cardTone(card)}</strong><p>Окрас может меняться в зависимости от интонации и отношений между собеседниками.</p></section>
        <section className="term-detail__origin"><h2>Происхождение</h2><p>{card.etymology ?? 'Слово закрепилось в русскоязычной интернет-среде и постепенно перешло из переписки в устную речь.'}</p></section>
      </div>
      {card.source && card.media?.kind !== 'image' && <a className="term-detail__source" href={card.source.url} target="_blank" rel="noopener noreferrer">{card.source.label} ↗</a>}
      <section className="correction-callout">
        <div><p className="eyebrow"><span /> Вместе точнее</p><h2>Нашли неточность?</h2><p>Предложите исправление. Текущая карточка останется на месте, пока редакция не проверит новую версию.</p></div>
        <a className="button button--dark" href={`#/submit?edit=${encodeURIComponent(cardSlug(card))}`}>Предложить изменения</a>
      </section>
    </article>
  );
}

function PublicTermDetail({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card>();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setMissing(false);
    void publicRequest<PublicContent>(`/api/content/${encodeURIComponent(slug)}`, controller.signal)
      .then((item) => setCard(publicCard(item)))
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setMissing(true); });
    return () => controller.abort();
  }, [slug]);
  if (card) return <TermDetail card={card} />;
  if (missing) return <section className="empty-state"><span>404</span><h1>Карточка не найдена</h1><p>Возможно, материал снят с публикации или ссылка устарела.</p><a className="button button--dark" href="#/dictionary">Вернуться в словарь</a></section>;
  return <section className="empty-state" aria-live="polite"><h1>Загружаем карточку…</h1></section>;
}

function HomePage() {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('query') ?? '').trim();
    window.location.hash = query ? `#/dictionary?q=${encodeURIComponent(query)}` : '#/dictionary';
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__content">
          <p className="eyebrow"><span /> Словарь поколений</p>
          <h1 id="hero-title">Хочешь быть сигмой?<br /><em>Для начала узнай, кто это</em></h1>
          <p className="hero__lead">Skuf Skills помогает понимать друг друга: простыми словами объясняем молодёжный язык, мемы и контекст.</p>
          <form className="search" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="site-search">Найти слово или мем</label>
            <input id="site-search" name="query" type="search" placeholder="имба" />
            <button type="submit">Найти</button>
          </form>
          <div className="hero__actions">
            <a className="button button--dark" href="#/dictionary">Открыть словарь</a>
            <a className="text-link" href="#/submit">Знаешь новое слово? Добавь →</a>
          </div>
        </div>
        <aside className="note-card" aria-label="Как пользоваться Skuf Skills">
          <div className="note-card__bar"><span /><span /><span /><b>read_me.txt</b></div>
          <div className="note-card__body"><span className="note-card__icon" aria-hidden="true">✦</span><p><strong>Здесь не осуждают.</strong><br />Здесь переводят с молодёжного на человеческий.</p></div>
        </aside>
      </section>
      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          <span className="ticker__sequence">БАЗА • ВАЙБ • ИМБА • РОФЛ • СИГМА • КРИНЖ • АУРА • </span>
          <span className="ticker__sequence">БАЗА • ВАЙБ • ИМБА • РОФЛ • СИГМА • КРИНЖ • АУРА • </span>
        </div>
      </div>
      <section className="home-choices" aria-label="Разделы проекта">
        <a href="#/dictionary"><h2>Словарь</h2><p>От «ауры» до «я в моменте» — с примерами и контекстом.</p><span>Смотреть все слова ↗</span></a>
        <a href="#/memology"><h2>Мемология</h2><p>Откуда взялся мем, что означает и когда его уместно использовать.</p><span>Разобраться в мемах ↗</span></a>
      </section>
      <section className="quiz-home-cta">
        <span className="quiz-home-cta__score" aria-hidden="true">10/10</span>
        <div><p className="eyebrow"><span /> 10 вопросов · 3 уровня</p><h2>Насколько ты<br />не скуф?</h2><p>Выбери сложность, проверь знание интернет-языка и получи карточку результата для соцсетей.</p></div>
        <a className="button button--light" href="#/quiz">Пройти тест</a>
      </section>
      <Suggest />
    </>
  );
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text: string }) {
  return <section className="page-intro"><p className="eyebrow"><span /> {eyebrow}</p><h1>{title}</h1><p>{text}</p></section>;
}

function DictionaryPage() {
  const remote = usePublicCards('term');
  const allCards = [...dictionaryCards, ...remote.cards.filter((card) => !dictionaryCards.some((starter) => cardSlug(starter) === cardSlug(card)))];
  const readFilters = () => {
    const query = window.location.hash.split('?')[1] ?? '';
    const params = new URLSearchParams(query);
    const letter = params.get('letter') ?? 'Все';
    return { letter: alphabet.includes(letter) ? letter : 'Все', search: params.get('q') ?? '' };
  };
  const initialFilters = readFilters();
  const [selectedLetter, setSelectedLetter] = useState(initialFilters.letter);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  useEffect(() => {
    const syncFilters = () => {
      const filters = readFilters();
      setSelectedLetter(filters.letter);
      setSearchQuery(filters.search);
    };
    window.addEventListener('hashchange', syncFilters);
    return () => window.removeEventListener('hashchange', syncFilters);
  }, []);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU');
  const matchesLetter = (card: Card, letter: string) => card.title.split(' / ').some((value) => value.trim().toLocaleUpperCase('ru-RU').startsWith(letter));
  const letterCards = selectedLetter === 'Все' ? allCards : allCards.filter((card) => matchesLetter(card, selectedLetter));
  const filteredCards = normalizedQuery ? allCards.filter((card) => [card.title, card.text, card.example, card.context ?? '', card.etymology ?? '', ...(card.aliases ?? [])].join(' ').toLocaleLowerCase('ru-RU').includes(normalizedQuery)) : letterCards;
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextHash = searchQuery.trim() ? `#/dictionary?q=${encodeURIComponent(searchQuery.trim())}` : '#/dictionary';
    window.history.replaceState(window.history.state, '', nextHash);
  };
  const selectLetter = (letter: string) => {
    setSearchQuery('');
    setSelectedLetter(letter);
    const nextHash = letter === 'Все' ? '#/dictionary' : `#/dictionary?letter=${encodeURIComponent(letter)}`;
    window.history.replaceState(window.history.state, '', nextHash);
  };

  return (
    <>
      <PageIntro eyebrow="Слова, которыми говорят сейчас" title={<><span>Словарь</span><span>От А до Я</span></>} text="Выбери букву или найди термин. Каждое объяснение прошло редакционную проверку." />
      <form className="dictionary-search" role="search" onSubmit={submitSearch}><label htmlFor="dictionary-search">Поиск по словарю</label><div><input id="dictionary-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Slay, слей или слэй" /><button type="submit">Найти</button></div><small>Ищем по названию, написанию, объяснению, примеру и контексту.</small></form>
      {remote.error && <p className="form-status form-status--error" role="alert">Не удалось обновить словарь. Показываем встроенную подборку.</p>}
      <section className="alphabet alphabet--page" aria-label="Алфавит"><div className="alphabet__letters">{alphabet.map((letter) => <button type="button" aria-pressed={selectedLetter === letter} onClick={() => selectLetter(letter)} key={letter}>{letter}</button>)}</div></section>
      <section className="catalog catalog--page" aria-label="Словарные статьи">
        {filteredCards.length > 0 ? <div className="card-grid card-grid--dictionary">{filteredCards.map((card, index) => <TermCard card={card} accent={cardPalette[index % cardPalette.length] ?? 'violet'} russianFirst={/^[А-ЯЁ]$/u.test(selectedLetter)} returnLetter={selectedLetter} key={card.title} />)}</div> : <div className="empty-state"><span>¯\\_(ツ)_/¯</span><h2>{normalizedQuery ? 'Ничего не нашли' : 'На эту букву пока ничего нет'}</h2><p>{normalizedQuery ? 'Попробуй другое написание или более короткий запрос.' : 'Знаешь подходящее слово? Отправь его редакции — регистрация не нужна.'}</p>{!normalizedQuery && <a className="button button--dark" href="#/submit">Добавить термин</a>}</div>}
      </section>
    </>
  );
}

function MemologyPage() {
  const remote = usePublicCards('meme');
  const cards = [...memeCards, ...remote.cards.filter((card) => !memeCards.some((starter) => cardSlug(starter) === cardSlug(card)))];
  return (
    <>
      <PageIntro eyebrow="Архив интернет-культуры" title="Мемология" text="Объясняем происхождение, смысл и контекст мемов — без необходимости притворяться, что всё и так понятно." />
      {remote.error && <p className="form-status form-status--error" role="alert">Не удалось обновить мемологию. Показываем встроенную подборку.</p>}
      <section className="catalog catalog--page" aria-label="Карточки мемов"><div className="card-grid card-grid--dictionary">{cards.map((card, index) => <TermCard card={card} accent={cardPalette[index % cardPalette.length] ?? 'violet'} key={cardSlug(card)} />)}</div></section>
    </>
  );
}

function SubmitPage() {
  const editSlug = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('edit');
  const starterCard = editSlug ? [...dictionaryCards, ...memeCards].find((item) => cardSlug(item) === editSlug) : undefined;
  const [remoteEditCard, setRemoteEditCard] = useState<Card>();
  const [editMissing, setEditMissing] = useState(false);
  const card = starterCard ?? remoteEditCard;
  const editingMeme = card?.type === 'Мемология';
  const [submissionState, setSubmissionState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [newType, setNewType] = useState<'term' | 'meme' | null>(null);
  const [videoUrl, setVideoUrl] = useState(() => starterCard?.media?.kind === 'video' ? starterCard.media.url : '');
  const [idempotencyKey] = useState(createIdempotencyKey);

  useEffect(() => {
    if (!editSlug || starterCard) return;
    const controller = new AbortController();
    setEditMissing(false);
    void publicRequest<PublicContent>(`/api/content/${encodeURIComponent(editSlug)}`, controller.signal)
      .then((item) => {
        const remoteCard = publicCard(item);
        setRemoteEditCard(remoteCard);
        if (remoteCard.media?.kind === 'video') setVideoUrl(remoteCard.media.url);
      })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setEditMissing(true); });
    return () => controller.abort();
  }, [editSlug, starterCard]);

  useEffect(() => {
    if (card?.media?.kind === 'video') setVideoUrl(card.media.url);
  }, [card]);

  const submitNew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newType) return;
    setSubmissionState('sending');
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? '').trim();
    const tags = value('tags').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
    const origin = value('origin');
    const author = value('author');
    const shared = { type: newType, title: value('title'), explanation: value('explanation'), example: value('example'), tags, ...(author ? { author } : {}) };
    const payload = newType === 'term'
      ? { ...shared, type: 'term', context: value('context'), ...(origin ? { origin } : {}) }
      : { ...shared, type: 'meme', origin, media: { kind: 'video', url: value('videoUrl') } };
    try {
      const response = await fetch(apiUrl('/api/submissions'), {
        method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('submission failed');
      setSubmissionState('sent');
    } catch {
      setSubmissionState('error');
    }
  };

  let previewUrl: string | null = null;
  if ((newType === 'meme' || editingMeme) && videoUrl) {
    try { previewUrl = parseExternalVideoUrl(videoUrl).embedUrl; } catch { previewUrl = null; }
  }

  if (editSlug && !card) return editMissing
    ? <section className="empty-state"><span>404</span><h1>Карточка не найдена</h1><p>Возможно, материал снят с публикации.</p><a className="button button--dark" href="#/memology">Вернуться в мемологию</a></section>
    : <section className="empty-state" aria-live="polite"><h1>Загружаем карточку…</h1></section>;

  if (!card) return (
    <section className="correction-page new-card-page">
      <h1>Добавить карточку</h1>
      <p className="correction-page__lead">Сначала выберите тип материала. Карточка появится на сайте только после проверки редакцией.</p>
      <section className="new-card-picker" aria-labelledby="new-card-picker-title">
        <h2 id="new-card-picker-title">Что добавляем?</h2>
        <div><button type="button" aria-pressed={newType === 'term'} onClick={() => { setNewType('term'); setSubmissionState('idle'); }}>Термин</button><button type="button" aria-pressed={newType === 'meme'} onClick={() => { setNewType('meme'); setSubmissionState('idle'); }}>Мем</button></div>
      </section>
      {newType && <form className="correction-form new-card-form" onSubmit={submitNew}>
        <label>Название<input name="title" required maxLength={80} /></label>
        <label className="correction-form__wide">{newType === 'term' ? 'Простое объяснение' : 'Объяснение смысла'}<textarea name="explanation" required maxLength={1500} rows={5} /></label>
        <label>{newType === 'term' ? 'Пример употребления' : 'Пример ситуации'}<textarea name="example" required maxLength={500} rows={4} /></label>
        {newType === 'term' ? <label>Контекст<textarea name="context" required maxLength={800} rows={4} /></label> : <label>Происхождение<textarea name="origin" required maxLength={1000} rows={4} /></label>}
        {newType === 'term' && <label className="correction-form__wide">Происхождение — необязательно<textarea name="origin" maxLength={1000} rows={3} /></label>}
        {newType === 'meme' && <label className="correction-form__wide">Ссылка на RuTube или YouTube<input name="videoUrl" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required placeholder="https://rutube.ru/video/…" /></label>}
        {newType === 'meme' && videoUrl && (previewUrl ? <div className="new-card-preview"><iframe src={previewUrl} title="Превью видео мема" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="form-status form-status--error" role="alert">Поддерживаются только корректные HTTPS-ссылки RuTube и YouTube.</p>)}
        <label className="correction-form__wide">Теги через запятую<input name="tags" maxLength={240} placeholder="например: реакция, видео, ирония" /></label>
        <label>Автор карточки — необязательно<input name="author" maxLength={60} /></label>
        <div className="correction-form__actions"><button className="button button--dark" type="submit" disabled={submissionState === 'sending' || (newType === 'meme' && !previewUrl)}>{submissionState === 'sending' ? 'Отправляем…' : 'Отправить на модерацию'}</button><small>Не указывайте персональные данные.</small></div>
        {submissionState === 'sent' && <p className="form-status form-status--success" role="status">Карточка отправлена. Редакция проверит её перед публикацией.</p>}
        {submissionState === 'error' && <p className="form-status form-status--error" role="alert">Не получилось отправить. Данные остались в форме — попробуйте ещё раз.</p>}
      </form>}
    </section>
  );

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionState('sending');
    const values = new FormData(event.currentTarget);
    const author = String(values.get('author') ?? '').trim();
    const origin = String(values.get('origin') ?? '').trim();
    const shared = {
      title: String(values.get('title') ?? ''),
      explanation: String(values.get('explanation') ?? ''),
      example: String(values.get('example') ?? ''),
      tags: card.aliases?.slice(0, 8) ?? [],
      ...(author ? { author } : {}),
      correction: {
        targetSlug: cardSlug(card), changeNote: String(values.get('changeNote') ?? ''),
        original: {
          title: card.title, explanation: card.text, example: card.example,
          tags: card.aliases?.slice(0, 8) ?? [], ...(card.etymology ? { origin: card.etymology } : {}),
          ...(card.media ? { media: card.media } : {}),
        },
      },
    };
    const payload = editingMeme
      ? { ...shared, type: 'meme', origin, media: { kind: 'video', url: String(values.get('videoUrl') ?? '').trim() } }
      : { ...shared, type: 'term', context: String(values.get('context') ?? ''), ...(origin ? { origin } : {}), correction: { ...shared.correction, original: { ...shared.correction.original, context: cardContext(card) } } };
    try {
      const response = await fetch(apiUrl('/api/submissions'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': createIdempotencyKey() },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('submission failed');
      setSubmissionState('sent');
    } catch {
      setSubmissionState('error');
    }
  };

  return (
    <section className="correction-page">
      <a className="term-detail__back" href={`#/${card.type === 'Мемология' ? 'memology' : 'dictionary'}/${encodeURIComponent(cardSlug(card))}`}>← Назад к карточке</a>
      <p className="eyebrow"><span /> Без регистрации · после модерации</p>
      <h1>Предложить изменения</h1>
      <p className="correction-page__lead">Исправьте только то, что считаете неточным. Исходная версия не изменится до решения редактора.</p>
      <form className="correction-form" onSubmit={submitCorrection}>
        <label>{editingMeme ? 'Название мема' : 'Термин'}<input name="title" defaultValue={card.title} required maxLength={80} /></label>
        <label className="correction-form__wide">{editingMeme ? 'Объяснение смысла' : 'Объяснение'}<textarea name="explanation" defaultValue={card.text} required maxLength={1500} rows={5} /></label>
        <label>{editingMeme ? 'Пример ситуации' : 'Пример употребления'}<textarea name="example" defaultValue={card.example} required maxLength={500} rows={4} /></label>
        {!editingMeme && <label>Контекст<textarea name="context" defaultValue={cardContext(card)} required maxLength={800} rows={4} /></label>}
        <label className="correction-form__wide">Происхождение<textarea name="origin" defaultValue={card.etymology ?? 'Слово закрепилось в русскоязычной интернет-среде и постепенно перешло из переписки в устную речь.'} maxLength={1000} rows={4} /></label>
        {editingMeme && <label className="correction-form__wide">Ссылка на RuTube или YouTube<input name="videoUrl" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required /></label>}
        {editingMeme && videoUrl && (previewUrl ? <div className="new-card-preview"><iframe src={previewUrl} title="Превью видео мема" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <p className="form-status form-status--error" role="alert">Поддерживаются только корректные HTTPS-ссылки RuTube и YouTube.</p>)}
        <label className="correction-form__wide">Что вы изменили?<textarea name="changeNote" required maxLength={500} rows={3} placeholder="Например: уточнил происхождение и добавил более понятный пример" /></label>
        <label>Автор правки — необязательно<input name="author" maxLength={60} /></label>
        <div className="correction-form__actions"><button className="button button--dark" type="submit" disabled={submissionState === 'sending' || (editingMeme && !previewUrl)}>{submissionState === 'sending' ? 'Отправляем…' : 'Отправить на модерацию'}</button><small>Персональные данные указывать не нужно.</small></div>
        {submissionState === 'sent' && <p className="form-status form-status--success" role="status">Предложение отправлено. Редакция проверит изменения перед публикацией.</p>}
        {submissionState === 'error' && <p className="form-status form-status--error" role="alert">Не получилось отправить. Данные сохранены в форме — попробуйте ещё раз.</p>}
      </form>
    </section>
  );
}

function Suggest() {
  return <section className="suggest"><div><p className="suggest__label">На модерацию</p><h2>Интернет сказал новое?</h2><p>Отправь слово или мем. Регистрация не нужна — публикация появится после проверки редакцией.</p></div><a className="button button--light" href="#/submit">Добавить карточку</a></section>;
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 500);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  if (!visible) return null;

  const scrollToTop = () => {
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return <button className="back-to-top" type="button" aria-label="Наверх" title="Наверх" onClick={scrollToTop}><span aria-hidden="true">↑</span></button>;
}

export function App() {
  const [locationHash, setLocationHash] = useState(window.location.hash);
  const route = currentRoute();
  const detailMatch = locationHash.match(/^#\/(?:dictionary|memology)\/([^?]+)/);
  const rawDetailSlug = detailMatch?.[1];
  const detailSlug = rawDetailSlug ? decodeURIComponent(rawDetailSlug) : null;
  const detailCard = detailSlug ? [...dictionaryCards, ...memeCards].find((card) => cardSlug(card) === detailSlug) : undefined;
  const adminDetailMatch = locationHash.match(/^#\/admin\/content\/([^?]+)/);
  const adminContentId = adminDetailMatch?.[1] ? decodeURIComponent(adminDetailMatch[1]) : null;

  useEffect(() => {
    const updateRoute = () => {
      setLocationHash(window.location.hash);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  return (
    <div className="site-shell">
      <Header route={route} />
      <main>{detailCard ? <TermDetail card={detailCard} /> : detailSlug ? <PublicTermDetail slug={detailSlug} /> : route === 'admin-login' ? <AdminLoginPage /> : adminContentId ? <AdminEditorPage id={adminContentId} /> : route === 'admin' ? <AdminQueuePage /> : route === 'dictionary' ? <DictionaryPage /> : route === 'memology' ? <MemologyPage /> : route === 'quiz' ? <QuizPage /> : route === 'submit' ? <SubmitPage /> : <HomePage />}</main>
      <BackToTop />
      <footer><a className="brand brand--footer" href="#/"><span>SKUF</span><span>СКИЛС</span></a><p>Скуф сегодня, сигма завтра</p><small>© 2026 · Сделано командой <a href="https://babrbook.com" target="_blank" rel="noopener noreferrer">Бабрбук</a></small></footer>
    </div>
  );
}

