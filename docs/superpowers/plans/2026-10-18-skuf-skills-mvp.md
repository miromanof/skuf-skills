# Skuf Skills MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать локально запускаемое адаптивное веб-приложение Skuf Skills, в котором посетители без регистрации предлагают словарные и мем-карточки, один администратор модерирует их, а опубликованные материалы доступны через поиск и каталоги.

**Architecture:** npm-workspaces разделяют React-клиент, Fastify API и независимый TypeScript-домен. PostgreSQL и файловое хранилище подключаются через адаптеры; публичные и административные маршруты используют один API, но разные политики доступа. Каждая задача завершается рабочим проверяемым срезом и отдельным коммитом.

**Tech Stack:** Node.js 22+, npm 10+, TypeScript 5.7+, React 19, Vite 6, Fastify 5, PostgreSQL 16, Kysely, Zod, Argon2, Vitest, React Testing Library, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-18-skuf-skills-mvp-design.md`

## Global Constraints

- Интерфейс и редакционный контент — на русском; бренд: `Skuf Skills / Скуф скилс`.
- Пользовательские аккаунты, комментарии, рейтинги, импорт/экспорт и публичный хостинг не входят в MVP.
- Публичный API никогда не возвращает `pending`, `rejected`, `unpublished` или `deleted` материалы.
- Видеоссылки допускаются только по HTTPS с RuTube или YouTube; сервер не загружает пользовательские URL.
- Изображения: JPEG, PNG или WebP, не более 5 МиБ и 4096×4096 пикселей.
- Реальные секреты, загрузки и персональные данные не коммитятся.
- Поддерживаются ширина от 320 px, клавиатура и `prefers-reduced-motion`.
- Каждая производственная функция появляется только после теста, упавшего по ожидаемой причине.
- После локального целевого теста в каждой задаче запускается полный набор доступных на тот момент проверок до коммита.

## Review Focus

- Unicode и смешанная кириллица/латиница: поиск и алфавит не должны падать или терять карточку — покрывается в Tasks 2 и 8.
- Повторная отправка после сетевой неопределённости: один idempotency key создаёт ровно одну заявку — покрывается в Task 4.
- Поддельное изображение и path traversal в имени: файл отклоняется либо получает серверное имя вне пользовательского контроля — покрывается в Task 5.
- Истёкшая сессия во время модерации: API отвечает 401, а несохранённая редакторская форма остаётся в интерфейсе — покрывается в Tasks 6 и 12.
- Ошибка базы или файла между шагами операции: публичная частичная карточка не появляется, сиротский файл убирается — покрывается в Tasks 4, 5 и 7.

---

## File Map

- `package.json`, `tsconfig.base.json`, `vitest.workspace.ts` — корневые команды и общая конфигурация.
- `apps/api/src/app.ts` — сборка Fastify через внедрение зависимостей без запуска порта.
- `apps/api/src/server.ts` — чтение окружения и запуск HTTP-сервера.
- `apps/api/src/modules/*` — маршруты и API-сервисы по пользовательскому сценарию.
- `apps/api/src/adapters/*` — PostgreSQL, сессии, файлы и инфраструктурные реализации.
- `apps/web/src/features/*` — публичные, submission и admin вертикальные срезы.
- `apps/web/src/shared/*` — API-клиент, маршрутизация и общие доступные элементы.
- `packages/domain/src/*` — сущности, схемы, нормализация и переходы статусов без framework-зависимостей.
- `packages/db/migrations/*` — последовательные SQL-миграции.
- `packages/db/src/*` — Kysely-типы и мигратор.
- `seed/content/*` — проверенные исходные данные и ссылки на источники.
- `tests/e2e/*` — сквозные пользовательские и административные сценарии.

### Task 1: Репозиторий, тестовый контур и health-срез

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/test/health.test.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.test.tsx`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `buildApp(): FastifyInstance`; корневые команды `npm test`, `npm run typecheck`, `npm run build`, `npm run dev`.

- [ ] **Step 1: Написать падающие smoke-тесты**

`apps/api/test/health.test.ts` ожидает `GET /health -> 200 { status: "ok" }`. `apps/web/src/App.test.tsx` ожидает видимый заголовок `Skuf Skills` и текст миссии `Понимать друг друга`.

- [ ] **Step 2: Запустить smoke-тесты и подтвердить RED**

Run: `npm test -- --run apps/api/test/health.test.ts apps/web/src/App.test.tsx`  
Expected: FAIL, потому что workspace и приложения ещё не существуют.

- [ ] **Step 3: Создать минимальный workspace и реализации**

Настроить npm workspaces `apps/*` и `packages/*`, Vitest с `node` для API и `jsdom` для web, строгий TypeScript. Реализовать только health route и минимальную доступную страницу с заголовком и миссией.

- [ ] **Step 4: Проверить GREEN и полный контур**

Run: `npm test -- --run apps/api/test/health.test.ts apps/web/src/App.test.tsx`  
Expected: PASS.  
Run: `npm test && npm run typecheck && npm run build`  
Expected: все команды PASS без относящихся к проекту предупреждений.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.workspace.ts .env.example apps packages
git commit -m "chore: scaffold Skuf Skills workspace"
```

### Task 2: Домен карточек, ограничения и модерационные переходы

**Files:**
- Create: `packages/domain/src/content.ts`
- Create: `packages/domain/src/validation.ts`
- Create: `packages/domain/src/moderation.ts`
- Create: `packages/domain/src/alphabet.ts`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/test/content.test.ts`
- Create: `packages/domain/test/moderation.test.ts`
- Create: `packages/domain/test/alphabet.test.ts`

**Interfaces:**
- Produces: `ContentDraft`, `ContentItem`, `ContentStatus`, `MediaInput`; `parseContentDraft(input: unknown): ContentDraft`; `transitionContent(item, command, now): ContentItem`; `alphabetBucket(title: string): string`.

- [ ] **Step 1: Написать падающие тесты валидации**

Проверить точные пределы из спецификации: пустые поля; 80/81 символ для термина; 1500/1501 для объяснения; 8/9 тегов; нормализацию краевых пробелов без схлопывания осмысленных переводов строк; необязательный псевдоним; обязательность ровно одного media для мема. Добавить Unicode-случаи с эмодзи и смешанной кириллицей/латиницей.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run packages/domain/test/content.test.ts`  
Expected: FAIL с отсутствующим `parseContentDraft`.

- [ ] **Step 3: Реализовать минимальные доменные типы и Zod-схемы**

Считать лимиты по Unicode code points, не по UTF-16 units. Экспортировать типизированный результат только после успешного parse.

- [ ] **Step 4: Проверить валидацию и полный набор**

Run: `npm test -- --run packages/domain/test/content.test.ts && npm test`  
Expected: PASS.

- [ ] **Step 5: Написать падающие тесты переходов и алфавита**

Ожидать `pending -> published|rejected`, `published -> unpublished|deleted`, `unpublished -> published|deleted`; запретить остальные. Проверить бакеты `А`, `A`, `0`, `#`, пустую строку и заголовок с ведущей кавычкой.

- [ ] **Step 6: Подтвердить RED**

Run: `npm test -- --run packages/domain/test/moderation.test.ts packages/domain/test/alphabet.test.ts`  
Expected: FAIL из-за отсутствующих функций.

- [ ] **Step 7: Реализовать переходы и определение бакета**

`transitionContent` требует причину для `reject` и `unpublish`, заполняет соответствующие даты и не мутирует исходный объект. `alphabetBucket` пропускает ведущие пробелы и знаки пунктуации.

- [ ] **Step 8: Полная проверка и commit**

Run: `npm test && npm run typecheck && npm run build`  
Expected: PASS.

```bash
git add packages/domain
git commit -m "feat: define content and moderation domain"
```

### Task 3: PostgreSQL-схема и репозитории

**Files:**
- Create: `compose.yaml`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/migrations/001_initial.sql`
- Create: `packages/db/src/types.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `apps/api/src/ports/content-repository.ts`
- Create: `apps/api/src/adapters/postgres-content-repository.ts`
- Create: `apps/api/test/postgres-content-repository.test.ts`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ContentDraft`, `ContentItem`, `ContentStatus` from Task 2.
- Produces: `ContentRepository` with `createPending`, `findById`, `findByIdempotencyKey`, `listForAdmin`, `update`, `listPublished`, `searchPublished`; `PostgresContentRepository`.

- [ ] **Step 1: Написать падающие PostgreSQL integration-тесты**

Проверить сохранение всех типов, уникальность idempotency key, фильтрацию очереди, отсутствие неопубликованных записей в public queries, поиск по Unicode и стабильную сортировку. Тесты используют отдельную test database из Compose и очищают только собственную схему.

- [ ] **Step 2: Подтвердить RED**

Run: `npm run infra:up && npm test -- --run apps/api/test/postgres-content-repository.test.ts`  
Expected: FAIL из-за отсутствующих миграции и репозитория.

- [ ] **Step 3: Реализовать миграцию и минимальный адаптер**

Создать таблицы `content_items`, `content_tags`, `content_sources`, `admin_sessions`; использовать ограничения статуса и уникальный индекс idempotency key. Публичные методы всегда добавляют `status = 'published'`.

- [ ] **Step 4: Проверить GREEN и миграцию с нуля**

Run: `npm run db:migrate:test && npm test -- --run apps/api/test/postgres-content-repository.test.ts`  
Expected: PASS.  
Run: `npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add compose.yaml package.json package-lock.json .env.example packages/db apps/api/src/ports apps/api/src/adapters apps/api/test/postgres-content-repository.test.ts
git commit -m "feat: persist moderated content in PostgreSQL"
```

### Task 4: API приёма заявок и идемпотентность

**Files:**
- Create: `apps/api/src/modules/submissions/service.ts`
- Create: `apps/api/src/modules/submissions/routes.ts`
- Create: `apps/api/src/http/errors.ts`
- Create: `apps/api/src/http/rate-limit.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/submissions-api.test.ts`

**Interfaces:**
- Consumes: `parseContentDraft`; `ContentRepository.createPending` и `findByIdempotencyKey`.
- Produces: `POST /api/submissions` с обязательным `Idempotency-Key`; response `201 { submissionId, status: "pending" }` или повторный `200` с тем же id.

- [ ] **Step 1: Написать падающие API-тесты**

Проверить успешный term, успешный meme с video URL, 400 для неверного тела, 413 для превышенного JSON, 429 при превышении лимита, одинаковый response id при повторе ключа и 409 при повторе ключа с другим содержимым. Имитировать ошибку репозитория и ожидать безопасный 503 без создания частичной записи.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/api/test/submissions-api.test.ts`  
Expected: FAIL с 404 для маршрута.

- [ ] **Step 3: Реализовать сервис и маршрут**

Внедрять repository через `buildApp(dependencies)`. Хешировать нормализованное тело для проверки повторного ключа. Настроить размер body и rate limit без логирования содержимого заявки.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/api/test/submissions-api.test.ts && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: accept idempotent content submissions"
```

### Task 5: Безопасные изображения и видео-embed

**Files:**
- Create: `packages/domain/src/video.ts`
- Create: `packages/domain/test/video.test.ts`
- Create: `apps/api/src/ports/file-storage.ts`
- Create: `apps/api/src/adapters/local-file-storage.ts`
- Create: `apps/api/src/modules/uploads/image-validation.ts`
- Create: `apps/api/src/modules/uploads/routes.ts`
- Create: `apps/api/test/uploads-api.test.ts`
- Modify: `apps/api/src/modules/submissions/service.ts`
- Modify: `apps/api/src/modules/submissions/routes.ts`
- Modify: `apps/api/test/submissions-api.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `parseVideoUrl(url): { provider: "rutube"|"youtube"; videoId: string; embedUrl: string }`; `FileStorage.saveValidatedImage`; `POST /api/uploads/images -> 201 { uploadToken }`; submission media input `{ kind: "image"; uploadToken }`.

- [ ] **Step 1: Написать падающие тесты URL**

Проверить корректные RuTube/YouTube URL и отклонение HTTP, userinfo tricks, поддоменов-злоумышленников, произвольных query/fragment вариантов и неизвестных доменов. `embedUrl` строится из video id, а не копирует исходный URL.

- [ ] **Step 2: Подтвердить RED, реализовать и проверить URL parser**

Run: `npm test -- --run packages/domain/test/video.test.ts`  
Expected: FAIL из-за отсутствующего parser. Реализовать минимальный allowlist parser.  
Run: `npm test -- --run packages/domain/test/video.test.ts`  
Expected: PASS.

- [ ] **Step 3: Написать падающие upload-тесты**

Проверить JPEG/PNG/WebP fixtures, неправильную сигнатуру, SVG/polyglot, 5 МиБ/больше 5 МиБ, 4096/4097 px, path traversal в filename и cleanup после ошибки repository. Ожидать случайное серверное имя без исходного basename.

- [ ] **Step 4: Подтвердить RED**

Run: `npm test -- --run apps/api/test/uploads-api.test.ts`  
Expected: FAIL с 404.

- [ ] **Step 5: Реализовать validation и локальный storage**

Декодировать изображение библиотекой, проверять MIME по содержимому, писать во временный файл и атомарно перемещать после успеха. Upload token живёт ограниченное время, одноразово привязывается к будущей заявке и удаляется вместе с временным файлом по истечении срока. Расширить submission service: валидный token присоединяет файл к заявке транзакционно, повторный или чужой token отклоняется.

- [ ] **Step 6: Полная проверка и commit**

Run: `npm test && npm run typecheck && npm run build`  
Expected: PASS.

```bash
git add .gitignore package.json package-lock.json packages/domain apps/api
git commit -m "feat: validate media and store safe uploads"
```

### Task 6: Аутентификация одного администратора

**Files:**
- Create: `apps/api/src/modules/auth/service.ts`
- Create: `apps/api/src/modules/auth/routes.ts`
- Create: `apps/api/src/modules/auth/require-admin.ts`
- Create: `apps/api/src/modules/auth/csrf.ts`
- Create: `apps/api/src/adapters/postgres-session-store.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/test/auth-api.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/session`; `requireAdmin(request)`; HttpOnly session cookie и отдельный CSRF token.

- [ ] **Step 1: Написать падающие auth-тесты**

Проверить валидный/невалидный логин, отсутствие различимого сообщения о том, какое поле неверно, Argon2 verification, cookie flags, logout, истёкшую сессию, rate limiting, CSRF для изменяющих admin-запросов и отсутствие секрета в логах.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/api/test/auth-api.test.ts`  
Expected: FAIL с 404.

- [ ] **Step 3: Реализовать минимальную session auth**

Первичный admin bootstrap использует `ADMIN_LOGIN` и `ADMIN_PASSWORD_HASH`; приложение не принимает открытый пароль из env. Session id хранится в БД только как hash, raw token — только в cookie.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/api/test/auth-api.test.ts && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .env.example package.json package-lock.json apps/api
git commit -m "feat: secure administrator sessions"
```

### Task 7: Административный API модерации

**Files:**
- Create: `apps/api/src/modules/moderation/service.ts`
- Create: `apps/api/src/modules/moderation/routes.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/moderation-api.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `transitionContent`, `ContentRepository`, `FileStorage`.
- Produces: `GET /api/admin/content`; `GET /api/admin/content/:id`; `PATCH /api/admin/content/:id`; `POST /api/admin/content/:id/publish|reject|unpublish`; `DELETE /api/admin/content/:id`.

- [ ] **Step 1: Написать падающие moderation API-тесты**

Проверить 401 без сессии, 403 без CSRF, редактирование полей с повторной серверной валидацией, все допустимые переходы, 409 для запрещённых переходов, обязательность причины, отсутствие публикации при ошибке БД и удаление связанного файла только в подтверждённой delete-транзакции. Проверить обезличенный audit tombstone.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/api/test/moderation-api.test.ts`  
Expected: FAIL с 404.

- [ ] **Step 3: Реализовать admin routes и транзакционный сервис**

Использовать optimistic version field, чтобы две вкладки администратора не перезаписали изменения молча. Возвращать 409 с текущей версией.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/api/test/moderation-api.test.ts && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat: moderate submitted content"
```

### Task 8: Публичный API поиска, каталогов и карточек

**Files:**
- Create: `apps/api/src/modules/public-content/routes.ts`
- Create: `apps/api/src/modules/public-content/service.ts`
- Create: `apps/api/src/modules/public-content/media-route.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/public-content-api.test.ts`

**Interfaces:**
- Produces: `GET /api/content?type&query&tag&bucket&cursor`; `GET /api/content/:slug`; `GET /api/content/:slug/image`; cursor pagination и опубликованные DTO без внутренних полей.

- [ ] **Step 1: Написать падающие public API-тесты**

Проверить поиск по title/explanation/tags без учёта регистра, нормализацию `ё/е` только для поиска, смешанную кириллицу/латиницу без исключения, секции `А–Я`, `A–Z`, `0–9`, `#`, slug collision, cursor pagination и 404 для каждого непубличного статуса. Убедиться, что DTO не содержит idempotency key, внутренних причин и audit data. Изображение выдаётся с безопасным Content-Type и `nosniff` только для опубликованной карточки; pending/unpublished image возвращает 404.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/api/test/public-content-api.test.ts`  
Expected: FAIL с 404.

- [ ] **Step 3: Реализовать query service и маршруты**

Slug создаётся из Unicode title с транслитерацией кириллицы и стабильным коротким suffix при коллизии. Cursor подписывает sort tuple, не раскрывая SQL.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/api/test/public-content-api.test.ts && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/domain
git commit -m "feat: expose searchable public catalog"
```

### Task 9: Web shell, маршрутизация и два визуальных режима

**Files:**
- Create: `apps/web/src/shared/router.tsx`
- Create: `apps/web/src/shared/layout/AppShell.tsx`
- Create: `apps/web/src/shared/theme/theme.ts`
- Create: `apps/web/src/shared/theme/ThemeSwitch.tsx`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/modern.css`
- Create: `apps/web/src/styles/retro.css`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/shared/theme/ThemeSwitch.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: `Theme = "modern"|"retro"`; `readTheme`, `writeTheme`; доступный slider `ThemeSwitch`; общий responsive shell.

- [ ] **Step 1: Написать падающие theme-тесты**

Проверить modern default, сохранение в localStorage, восстановление, доступное имя переключателя, клавиатурное изменение и отсутствие transition при mocked `prefers-reduced-motion: reduce`.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/web/src/shared/theme/ThemeSwitch.test.tsx`  
Expected: FAIL из-за отсутствующего компонента.

- [ ] **Step 3: Реализовать shell и темы**

Современная тема следует одобренному редакционному направлению; retro использует визуальные признаки Windows 98 без копирования защищённых графических ресурсов. Slider имеет видимый текст и не полагается только на положение.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/web/src/shared/theme/ThemeSwitch.test.tsx && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: add responsive modern and retro shell"
```

### Task 10: Главная, каталоги, поиск и публичная карточка

**Files:**
- Create: `apps/web/src/shared/api/client.ts`
- Create: `apps/web/src/features/discovery/HomePage.tsx`
- Create: `apps/web/src/features/discovery/CatalogPage.tsx`
- Create: `apps/web/src/features/discovery/SearchForm.tsx`
- Create: `apps/web/src/features/content/ContentCard.tsx`
- Create: `apps/web/src/features/content/ContentPage.tsx`
- Create: `apps/web/src/features/content/SafeVideoEmbed.tsx`
- Create: `apps/web/src/features/discovery/discovery.test.tsx`
- Modify: `apps/web/src/shared/router.tsx`

**Interfaces:**
- Consumes: public API from Task 8.
- Produces: routes `/`, `/dictionary`, `/memology`, `/content/:slug`; search query URL state; safe provider-specific embed.

- [ ] **Step 1: Написать падающие component/integration-тесты**

Проверить миссию, поиск, алфавит, tags, loading/empty/error states, только опубликованные DTO, понятный 404, iframe allow/referrerpolicy/title и отсутствие `dangerouslySetInnerHTML`. Проверить клавиатурный порядок действий.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/web/src/features/discovery/discovery.test.tsx`  
Expected: FAIL из-за отсутствующих страниц.

- [ ] **Step 3: Реализовать публичные страницы**

Использовать AbortController для смены запроса, сохранять query в URL, показывать retry без потери фильтров. Все server strings рендерить как React text.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/web/src/features/discovery/discovery.test.tsx && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: browse and search published content"
```

### Task 11: Форма предложения материала и восстановление

**Files:**
- Create: `apps/web/src/features/submission/draft-storage.ts`
- Create: `apps/web/src/features/submission/SubmissionPage.tsx`
- Create: `apps/web/src/features/submission/TermFields.tsx`
- Create: `apps/web/src/features/submission/MemeFields.tsx`
- Create: `apps/web/src/features/submission/SubmissionSuccess.tsx`
- Create: `apps/web/src/features/submission/submission.test.tsx`
- Modify: `apps/web/src/shared/router.tsx`

**Interfaces:**
- Consumes: upload API Task 5 и submission API Task 4.
- Produces: route `/suggest`; `SubmissionDraftStorage`; client-generated idempotency key retained until success.

- [ ] **Step 1: Написать падающие form-тесты**

Проверить term/meme branches, exact limits, inline accessible errors, rules checkbox, RuTube→YouTube→image presentation order, upload failure, API retry with same key, draft restore, clear only after success and explicit message that file must be reselected after reload.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/web/src/features/submission/submission.test.tsx`  
Expected: FAIL из-за отсутствующей страницы.

- [ ] **Step 3: Реализовать форму минимально**

Сохранять только неперсональный текст и выбранный media mode в localStorage с versioned schema. Никогда не сохранять файл, пароль или server response body целиком.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/web/src/features/submission/submission.test.tsx && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: submit recoverable content proposals"
```

### Task 12: Вход и административный дашборд

**Files:**
- Create: `apps/web/src/features/admin/AdminLoginPage.tsx`
- Create: `apps/web/src/features/admin/AdminQueuePage.tsx`
- Create: `apps/web/src/features/admin/AdminEditorPage.tsx`
- Create: `apps/web/src/features/admin/DeleteConfirmation.tsx`
- Create: `apps/web/src/features/admin/admin.test.tsx`
- Modify: `apps/web/src/shared/api/client.ts`
- Modify: `apps/web/src/shared/router.tsx`

**Interfaces:**
- Consumes: auth API Task 6 и moderation API Task 7.
- Produces: routes `/admin/login`, `/admin`, `/admin/content/:id`; CSRF-aware admin client.

- [ ] **Step 1: Написать падающие admin UI-тесты**

Проверить generic login error, status filters, preview/edit/publish/reject/unpublish, delete confirmation, 409 version conflict, session expiry redirect с сохранением редакторского draft в sessionStorage и restoration после повторного входа. Проверить, что пароль не сохраняется.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run apps/web/src/features/admin/admin.test.tsx`  
Expected: FAIL из-за отсутствующих страниц.

- [ ] **Step 3: Реализовать admin flow**

Все destructive actions требуют явного подтверждения; publish/reject buttons имеют ясные labels. При 401 текущий редакторский draft остаётся локально только до закрытия вкладки.

- [ ] **Step 4: Проверить GREEN и полный набор**

Run: `npm test -- --run apps/web/src/features/admin/admin.test.tsx && npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat: manage moderation from admin dashboard"
```

### Task 13: Исследованный стартовый каталог

**Files:**
- Create: `seed/content/terms.json`
- Create: `seed/content/memes.json`
- Create: `seed/content/sources.json`
- Create: `seed/schema.ts`
- Create: `seed/import.ts`
- Create: `seed/content.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: domain schemas Task 2 и repository Task 3.
- Produces: `npm run seed`; минимум 60 term и 30 meme records, каждый с source URL и `verifiedAt`.

- [ ] **Step 1: Написать падающий seed contract-тест**

Ожидать ≥60 уникальных терминов, ≥30 уникальных мемов, период 2024-01-01..2026-10-18, минимум один доступный источник на карточку, отсутствие дублированных canonical titles, валидность всех карточек доменной схемой и отсутствие длинных цитат.

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -- --run seed/content.test.ts`  
Expected: FAIL из-за отсутствующих данных.

- [ ] **Step 3: Провести веб-исследование и составить данные**

Искать русскоязычные термины и мемы 2024–2026 годов по первичным публикациям, редакционным материалам и исследованиям трендов. Для технических фактов использовать первичные источники; для культурных трактовок сверять спорные значения минимум по двум независимым источникам. Не копировать определения и не использовать недоступный ролик как единственный источник.

- [ ] **Step 4: Реализовать валидируемый importer**

Importer выполняет upsert по стабильному editorial key, публикует только schema-valid records и сохраняет provenance. Повторный запуск не создаёт дублей.

- [ ] **Step 5: Проверить данные, импорт и полный набор**

Run: `npm test -- --run seed/content.test.ts && npm run seed:dry-run`  
Expected: PASS, отчёт ровно о валидных уникальных записях.  
Run: `npm test && npm run typecheck && npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json seed
git commit -m "content: seed contemporary terms and memes"
```

### Task 14: Сквозные сценарии, hardening и локальный запуск

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/public-flow.spec.ts`
- Create: `tests/e2e/moderation-flow.spec.ts`
- Create: `tests/e2e/security.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `scripts/start-local.mjs`
- Create: `scripts/check-env.mjs`
- Create: `README.md`
- Create: `docs/operations/local-run.md`
- Modify: `package.json`
- Modify: `compose.yaml`

**Interfaces:**
- Produces: `npm run local`; `npm run e2e`; документированный bootstrap admin hash и локальный LAN-доступ.

- [ ] **Step 1: Написать падающие E2E-тесты**

Основной тест отправляет term и meme в mobile viewport, проверяет очередь, admin edit и publish, затем находит обе карточки публично. Дополнительные тесты: duplicate retry, session expiry, XSS string, недоступный draft, keyboard-only flow, 320 px overflow и reduced motion.

- [ ] **Step 2: Подтвердить RED**

Run: `npm run e2e`  
Expected: FAIL до появления orchestration scripts и стабильных selectors.

- [ ] **Step 3: Реализовать локальный orchestration и исправить только выявленные gaps**

`npm run local` проверяет env, запускает PostgreSQL, миграции, API и web. README объясняет создание Argon2 hash без записи открытого пароля, адреса localhost/LAN, остановку и очистку только проектных volumes.

- [ ] **Step 4: Запустить security headers и dependency audit**

Добавить строгую CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, безопасный referrer policy и точный `frame-src` для RuTube/YouTube.  
Run: `npm audit --audit-level=high`  
Expected: 0 high/critical vulnerabilities; иначе обновить или документированно заменить зависимость до продолжения.

- [ ] **Step 5: Полный автоматический прогон**

Run: `npm test && npm run typecheck && npm run build && npm run e2e`  
Expected: PASS без относящихся к проекту ошибок и предупреждений.

- [ ] **Step 6: Ручная проверка**

Проверить desktop и 320 px, клавиатуру, modern/retro slider, reduced motion, загрузку валидного изображения, сообщение о повторном выборе файла и LAN-доступ со второго устройства. Записать результат и дату в `docs/operations/local-run.md`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests scripts README.md docs/operations compose.yaml apps
git commit -m "test: harden end-to-end Skuf Skills flows"
```

### Task 15: Финальное ревью соответствия, крайних случаев и безопасности

**Files:**
- Create: `docs/reviews/2026-10-18-mvp-review.md`
- Modify: only files required by regression tests for confirmed defects

**Interfaces:**
- Consumes: весь MVP и design spec.
- Produces: traceability checklist, edge-case/security findings, regression tests for every fixed defect.

- [ ] **Step 1: Сопоставить спецификацию с реализацией**

Для каждого требования разделов 1–12 design spec указать route/component/test или зафиксировать gap. Нельзя отмечать требование выполненным только по наличию файла.

- [ ] **Step 2: Проверить крайние случаи и безопасность**

Отдельно проверить Unicode confusables, длинные слова без пробелов, malformed multipart, decompression bombs, idempotency races, concurrent moderation, session fixation, CSRF, XSS, SSRF, path traversal, content-type sniffing, public draft leakage и секреты в истории Git.

- [ ] **Step 3: Для каждого дефекта выполнить отдельный TDD-цикл**

Сначала добавить минимальный regression test и увидеть ожидаемый FAIL; затем минимально исправить; затем запустить целевой и полный набор. Существенно независимые исправления коммитить отдельно с `fix:` сообщением.

- [ ] **Step 4: Финальная проверка**

Run: `npm test && npm run typecheck && npm run build && npm run e2e && npm audit --audit-level=high && git status --short`  
Expected: все проверки PASS; `git status` показывает только готовый review document перед его коммитом.

- [ ] **Step 5: Commit review**

```bash
git add docs/reviews/2026-10-18-mvp-review.md
git commit -m "docs: complete MVP conformance review"
```
