# Skuf Skills Release Hardening and Quiz Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширить средний уровень до всех встроенных словарных терминов, усилить защиту сайта и API и подтвердить готовность опубликованной версии полным UX-проходом.

**Architecture:** Встроенные карточки словаря становятся единым экспортируемым источником данных для интерфейса и тестов покрытия. Средний банк хранит редакторские контекстные вопросы отдельно от лёгкого/сложного банка и валидируется структурными тестами. Статический сайт получает совместимую meta CSP, Worker — единый middleware защитных заголовков, а недоступные GitHub Pages заголовки документируются как Cloudflare Transform Rule.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Cloudflare Workers/Hono, GitHub Pages, Cloudflare DNS/HTTP.

**Spec:** `docs/superpowers/specs/2026-10-20-release-hardening-and-quiz-expansion-design.md`

## Global Constraints

- GitHub Pages, Cloudflare Worker/D1 и DNS-маршрутизация сохраняются.
- Средний уровень охватывает все встроенные словарные термины, исключая мемологию.
- В одном прохождении остаётся 10 уникальных вопросов.
- Каждый вариант среднего вопроса содержит проверяемый термин или его грамматическую форму и звучит естественно.
- CSP не блокирует API, RuTube/YouTube, внешние изображения, админку или локальную разработку.
- Существующие iOS fallback, CORS, CSRF, cookie и rate-limit гарантии сохраняются.
- Публикация выполняется только после полного автоматического и пользовательского прогона.

## Review Focus

- Словарная карточка добавлена, а вопрос среднего уровня забыли: тест покрытия должен падать.
- Вариант ответа не содержит термин или повторяет другой вариант: структурный тест должен падать.
- CSP блокирует видео, API или внешний источник изображения: build-проверка политики и ручной UX-проход должны это обнаружить.
- Защитный middleware удаляет CORS-заголовки или кэширует админские ответы: Worker-тесты должны проверять совместную работу middleware.
- Повторное прохождение снова выдаёт одну и ту же десятку: детерминированный тест с разными random-последовательностями должен показать разные наборы.

---

### Task 1: Единый источник встроенного словаря

**Files:**
- Create: `apps/web/src/content/builtin-cards.ts`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/content/builtin-cards.test.ts`

**Interfaces:**
- Produces: `dictionaryCards`, `memeCards`, `Card`, `CardMedia` exports.
- Consumes: существующие неизменённые данные карточек из `App.tsx`.

- [ ] **Step 1: Write the failing test**

Проверить, что экспорт содержит уникальные slug/title, словарные карточки не имеют типа «Мемология», а мем-карточки имеют этот тип.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/src/content/builtin-cards.test.ts`
Expected: FAIL, модуль ещё не существует.

- [ ] **Step 3: Extract the data module**

Перенести типы и массивы без изменения контента; импортировать их в `App.tsx`.

- [ ] **Step 4: Run focused and app tests**

Run: `npm test -- apps/web/src/content/builtin-cards.test.ts apps/web/src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "refactor: share built-in glossary data"`

### Task 2: Полный и сложный средний банк

**Files:**
- Create: `apps/web/src/features/quiz/medium-questions.ts`
- Modify: `apps/web/src/features/quiz/quiz.ts`
- Test: `apps/web/src/features/quiz/quiz.test.ts`

**Interfaces:**
- Consumes: `dictionaryCards` from Task 1.
- Produces: `mediumQuestions: QuizQuestion[]`, used as `questionBank.medium`.

- [ ] **Step 1: Write failing coverage tests**

Добавить проверки:

- множество названий среднего банка совпадает с множеством `dictionaryCards`;
- банк содержит больше 10 вопросов;
- все четыре варианта уникальны и содержат нормализованную проверяемую форму/алиас;
- каждый вариант похож на законченное предложение и не использует прежние абсурдные шаблоны;
- разные детерминированные random-последовательности способны дать разные десятки.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- apps/web/src/features/quiz/quiz.test.ts`
Expected: FAIL по покрытию словаря и размеру банка.

- [ ] **Step 3: Author medium questions for every dictionary term**

Для каждого термина добавить один правильный и три естественных пограничных контекста. Английские карточки используют отображаемую форму из словаря и допускают перечисленные алиасы при структурной проверке.

- [ ] **Step 4: Wire the expanded bank**

Оставить лёгкий и сложный банки без изменения поведения; заменить только источник `questionBank.medium`.

- [ ] **Step 5: Run quiz and UI tests**

Run: `npm test -- apps/web/src/features/quiz/quiz.test.ts apps/web/src/features/quiz/QuizPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: expand medium quiz across the glossary"`

### Task 3: Защитные политики статического сайта

**Files:**
- Modify: `apps/web/index.html`
- Create: `apps/web/src/security-policy.test.ts`

**Interfaces:**
- Produces: meta CSP and referrer policy in the production HTML.

- [ ] **Step 1: Write failing HTML policy tests**

Проверить наличие `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, API в `connect-src`, RuTube/YouTube в `frame-src`, необходимых image origins и `no-referrer`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- apps/web/src/security-policy.test.ts`
Expected: FAIL, политики отсутствуют.

- [ ] **Step 3: Add the minimal compatible policies**

Добавить meta-теги без inline scripts/styles и без директив, не поддерживаемых meta CSP.

- [ ] **Step 4: Build and run policy tests**

Run: `npm test -- apps/web/src/security-policy.test.ts && npm run build -w @skuf-skills/web`
Expected: PASS and successful Vite build.

- [ ] **Step 5: Commit**

`git commit -m "security: restrict static site capabilities"`

### Task 4: Защитные заголовки Worker

**Files:**
- Create: `apps/worker/src/http/security-headers.ts`
- Modify: `apps/worker/src/app.ts`
- Create: `apps/worker/test/security-headers.test.ts`
- Modify: `apps/worker/test/auth.test.ts`

**Interfaces:**
- Produces: `securityHeaders(): MiddlewareHandler` applied before routes.
- Consumes: existing CORS and admin route middleware.

- [ ] **Step 1: Write failing response-header tests**

Для `/health`, публичного API, CORS preflight и неавторизованного admin API проверить `nosniff`, `no-referrer`, `DENY`, restrictive `Permissions-Policy`; для `/api/admin/*` дополнительно `Cache-Control: no-store`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- apps/worker/test/security-headers.test.ts`
Expected: FAIL, заголовки отсутствуют.

- [ ] **Step 3: Implement and register middleware**

Middleware добавляет заголовки ко всем ответам и не перезаписывает CORS. Admin cache policy определяется по pathname.

- [ ] **Step 4: Run all Worker tests**

Run: `npm test -- apps/worker/test`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "security: harden worker responses"`

### Task 5: Cloudflare production instructions and verification script

**Files:**
- Modify: `docs/cloudflare-deployment.md`
- Modify: `scripts/check-cloud-deployment.mjs`

**Interfaces:**
- Produces: documented Response Header Transform Rule and automated checks for headers that production can expose.

- [ ] **Step 1: Add failing script expectations**

Расширить проверку так, чтобы она требовала Worker security headers и печатала точный список отсутствующих GitHub Pages/Cloudflare response headers без ложного успеха.

- [ ] **Step 2: Verify failure against current production**

Run: `npm run check:cloud-deployment`
Expected: FAIL/report missing site headers before Cloudflare rule is applied.

- [ ] **Step 3: Document exact Transform Rule**

Указать hostname `skufskills.ru`, значения `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP/reporting strategy and rollback.

- [ ] **Step 4: Commit**

`git commit -m "docs: add production header hardening"`

### Task 6: Full local release gate

**Files:**
- Modify only if a failing check reveals a root cause in scoped code.

- [ ] **Step 1: Run complete verification**

Run sequentially:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run check:mobile-css`
- `npm audit --omit=dev`

Expected: zero failures and zero known production dependency vulnerabilities.

- [ ] **Step 2: Review the diff for secrets and unrelated changes**

Run: `git diff --check` and secret-pattern scan over changed files.
Expected: no whitespace errors, credentials, tokens or unrelated edits.

- [ ] **Step 3: Commit any test-only release gate changes**

`git commit -m "test: strengthen release readiness checks"` when applicable.

### Task 7: Publish and Codex-browser acceptance

**Files:**
- Create: `outputs/skuf-skills-release-audit.md`

**Interfaces:**
- Consumes: successful Tasks 1–6 and deployed GitHub Actions run.
- Produces: user-facing audit report with evidence, residual risks and production URLs.

- [ ] **Step 1: Publish the reviewed commits to `main`**

Wait for the Pages workflow, Worker deploy, tests and build jobs to finish successfully.

- [ ] **Step 2: Verify production network boundaries**

Check HTTPS certificate, site/API status, CORS allow/deny cases, unauthenticated admin denial and deployed response headers.

- [ ] **Step 3: Run the Codex in-app browser scenarios**

Complete every scenario from the spec, including three quiz levels, retry, 1998 switch, search, form, admin queue and approximately 390 px layout. Do not bypass TLS warnings.

- [ ] **Step 4: Clean up the acceptance submission**

Reject or delete only the explicitly named test submission; do not modify real user submissions.

- [ ] **Step 5: Write the release audit**

Record exact test counts, workflow run, checked routes, mobile observations, applied protections, unresolved Cloudflare-only settings and recommended follow-up.

- [ ] **Step 6: Final verification**

Re-run production header/API checks and confirm the report matches current state before claiming readiness.

