# Free Cloud Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing public site, submission queue, moderation UI, and published-content API so they remain available while the owner's computer is off, with no monthly platform charge.

**Architecture:** GitHub Pages continues to serve the React application. A Cloudflare Worker at `api.skufskills.ru` implements the existing HTTP contract and stores durable state in D1; GitHub Actions deploys the Worker before building the website with its production API origin. Cloudflare Free DNS preserves the existing GitHub Pages records and adds the API subdomain.

**Tech Stack:** TypeScript, React/Vite, Hono, Cloudflare Workers, Cloudflare D1, Web Crypto, Vitest, Wrangler, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-10-18-free-cloud-deployment-design.md`

## Global Constraints

- Monthly platform cost remains zero; do not enable Workers Paid or another paid product.
- `skufskills.ru` continues to serve the existing GitHub Pages site during DNS migration.
- The owner's computer is not required for public reads, submissions, or moderation.
- The Worker accepts credentialed administrator requests only from same-site production and localhost origins; the GitHub Pages preview origin is limited to public reads and anonymous submissions.
- No media uploads are added; meme media remains an external HTTPS reference.
- Secrets and administrator credentials are never committed or printed.

## Review Focus

- Cross-origin administrator cookies must work between `skufskills.ru` and `api.skufskills.ru` while requests from unrelated origins fail.
- Identical retries must remain idempotent across separate Worker invocations, while conflicting payloads return `409`.
- Concurrent moderator tabs must detect stale versions rather than overwrite a newer decision.
- D1/Worker quota or temporary failures must leave the embedded public catalogue usable and retain form input.
- DNS nameserver migration must copy all active GitHub Pages records before delegation changes.

---

### Task 1: Create the Worker package and health boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/wrangler.jsonc`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/app.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/test/health.test.ts`

**Interfaces:**
- Consumes: Cloudflare `Env` bindings and Hono's fetch interface.
- Produces: `createWorkerApp(): Hono<WorkerBindings>` and `GET /health -> { status: "ok" }`.

- [ ] **Step 1: Write the failing health test**

Create `apps/worker/test/health.test.ts` asserting that an in-process request to `/health` returns status `200` and `{ status: 'ok' }`.

- [ ] **Step 2: Run the Worker health test and verify it fails**

Run: `npm test -- apps/worker/test/health.test.ts`
Expected: FAIL because the Worker app does not exist.

- [ ] **Step 3: Add the Worker workspace and minimal fetch app**

Add Hono, Wrangler, and Cloudflare Worker types; define `WorkerBindings` with `DB`, secret, and allowed-origin bindings; export the health route and Worker fetch handler.

- [ ] **Step 4: Run the health test and typecheck**

Run: `npm test -- apps/worker/test/health.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add package.json package-lock.json tsconfig.json apps/worker && git commit -m "feat: scaffold Cloudflare API worker"`

### Task 2: Add the D1 schema and content repository

**Files:**
- Create: `apps/worker/migrations/0001_initial.sql`
- Create: `apps/worker/src/content/serialization.ts`
- Create: `apps/worker/src/content/d1-content-repository.ts`
- Create: `apps/worker/src/content/types.ts`
- Create: `apps/worker/test/d1-content-repository.test.ts`

**Interfaces:**
- Consumes: `D1Database`, domain `ContentDraft`, `ContentItem`, and `ContentStatus`.
- Produces: `D1ContentRepository` methods `createPending`, `findById`, `findByIdempotencyKey`, `listForAdmin`, `update`, and `listPublished` with the same behavioral contract as the current API repository.

- [ ] **Step 1: Write failing repository integration tests**

Test pending-item persistence, unique idempotency keys, public-status filtering, stable moderation sorting, JSON tag/media round trips, and optimistic update conflicts against local D1.

- [ ] **Step 2: Run the repository test and verify it fails**

Run: `npm test -- apps/worker/test/d1-content-repository.test.ts`
Expected: FAIL because the migration and repository are missing.

- [ ] **Step 3: Implement the SQLite-compatible migration and serializers**

Create `content_items`, `admin_sessions`, and `rate_limits` tables. Store structured draft data and tags as JSON text; store timestamps as ISO-8601 strings; add indexes for status/time, normalized title, and session expiry.

- [ ] **Step 4: Implement `D1ContentRepository`**

Use bound parameters for every query and `updated_at` in the update predicate for optimistic concurrency.

- [ ] **Step 5: Run the repository tests**

Run: `npm test -- apps/worker/test/d1-content-repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add apps/worker && git commit -m "feat: persist moderation content in D1"`

### Task 3: Port public content and anonymous submissions

**Files:**
- Create: `apps/worker/src/security/crypto.ts`
- Create: `apps/worker/src/http/cors.ts`
- Create: `apps/worker/src/http/errors.ts`
- Create: `apps/worker/src/content/public-routes.ts`
- Create: `apps/worker/src/content/submission-routes.ts`
- Modify: `apps/worker/src/app.ts`
- Create: `apps/worker/test/public-content.test.ts`
- Create: `apps/worker/test/submissions.test.ts`

**Interfaces:**
- Consumes: `D1ContentRepository`, `parseContentDraft`, `alphabetBucket`, Web Crypto, and `Env.CURSOR_SECRET`.
- Produces: current `/api/content`, `/api/content/:slug`, and `/api/submissions` response contracts.

- [ ] **Step 1: Write failing public-content tests**

Cover published-only DTOs, normalized search, alphabet buckets, stable collision-safe slugs, pagination, and tampered cursors.

- [ ] **Step 2: Write failing submission tests**

Cover allowed/disallowed origins, validation, the 64 KiB body ceiling, durable idempotency, conflicting reuse, persisted rate limits, and safe quota/failure responses.

- [ ] **Step 3: Run both suites and verify they fail**

Run: `npm test -- apps/worker/test/public-content.test.ts apps/worker/test/submissions.test.ts`
Expected: FAIL because the routes are missing.

- [ ] **Step 4: Implement Worker-native signing, hashing, CORS, and error mapping**

Export `sha256Hex`, `hmacSign`, `secureEqual`, `encodeCursor`, and `decodeCursor` using Web Crypto and base64url encoding without Node APIs.

- [ ] **Step 5: Implement public and submission routes**

Match the current status codes and safe response bodies. Persist IP-window rate limits in D1 and use the idempotency key plus canonical draft hash for retries.

- [ ] **Step 6: Run the public and submission tests**

Run: `npm test -- apps/worker/test/public-content.test.ts apps/worker/test/submissions.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

Run: `git add apps/worker && git commit -m "feat: add public and submission Worker APIs"`

### Task 4: Port administrator authentication and moderation

**Files:**
- Create: `apps/worker/src/auth/password.ts`
- Create: `apps/worker/src/auth/session-store.ts`
- Create: `apps/worker/src/auth/routes.ts`
- Create: `apps/worker/src/moderation/routes.ts`
- Modify: `apps/worker/src/app.ts`
- Create: `apps/worker/test/auth.test.ts`
- Create: `apps/worker/test/moderation.test.ts`
- Create: `scripts/cloudflare-admin-setup.mjs`
- Create: `apps/api/test/cloudflare-admin-setup.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Env.ADMIN_LOGIN`, `Env.ADMIN_PASSWORD_SALT`, `Env.ADMIN_PASSWORD_DERIVED_KEY`, `D1ContentRepository`, and the existing domain moderation state machine.
- Produces: current `/api/admin/session`, `/api/admin/login`, `/api/admin/logout`, and moderation endpoint contracts; `npm run cloudflare:admin-setup` configures secrets without persisting a plaintext password.

- [ ] **Step 1: Write failing authentication tests**

Cover PBKDF2 verification, generic login errors, secure cookie attributes, expiry, CSRF, logout, persistent login throttling, and rejection of unrelated origins.

- [ ] **Step 2: Write failing moderation tests**

Cover protected queue reads, detail reads, draft edits, version conflicts, publication, rejection, unpublication, deletion tombstones, and invalid transitions.

- [ ] **Step 3: Write failing administrator-setup tests**

Assert that secret payload generation emits only login, salt, derived key, and random signing secrets; rejects short passwords and line breaks; and never contains the plaintext password.

- [ ] **Step 4: Run the new suites and verify they fail**

Run: `npm test -- apps/worker/test/auth.test.ts apps/worker/test/moderation.test.ts apps/api/test/cloudflare-admin-setup.test.ts`
Expected: FAIL because authentication and moderation are missing.

- [ ] **Step 5: Implement authentication and secret setup**

Use PBKDF2-SHA-256 with an explicit iteration count stored with the verifier. Set `Secure`, `HttpOnly`, `SameSite=Lax`, `Domain=.skufskills.ru`, and a 24-hour expiry on production session cookies; return the CSRF token through the existing response contract.

- [ ] **Step 6: Implement moderation routes**

Reuse domain parsing and transition functions; require session plus CSRF on every state-changing route; preserve current error status codes and version-conflict payloads.

- [ ] **Step 7: Run the authentication and moderation tests**

Run: `npm test -- apps/worker/test/auth.test.ts apps/worker/test/moderation.test.ts apps/api/test/cloudflare-admin-setup.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

Run: `git add package.json package-lock.json apps/worker scripts/cloudflare-admin-setup.mjs apps/api/test/cloudflare-admin-setup.test.ts && git commit -m "feat: secure Worker moderation API"`

### Task 5: Point the web application at the production API

**Files:**
- Modify: `apps/web/src/shared/api/client.ts`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/shared/api/origin.ts`
- Create: `apps/web/src/shared/api/origin.test.ts`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/features/admin/admin.test.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_BASE_URL`.
- Produces: `apiUrl(path: string): string`, used by every public, submission, and administrator request.

- [ ] **Step 1: Write failing API-origin tests**

Assert localhost defaults to `http://127.0.0.1:3001`, production uses the trimmed HTTPS `VITE_API_BASE_URL`, malformed values fail the build/runtime boundary, and every form/admin request uses the shared resolver.

- [ ] **Step 2: Run focused web tests and verify they fail**

Run: `npm test -- apps/web/src/shared/api/origin.test.ts apps/web/src/App.test.tsx apps/web/src/features/admin/admin.test.tsx`
Expected: FAIL until endpoint selection is centralized.

- [ ] **Step 3: Implement the shared origin resolver and replace duplicate endpoint logic**

Keep credentialed admin requests and the existing fallback/error behavior unchanged.

- [ ] **Step 4: Run focused web tests**

Run: `npm test -- apps/web/src/shared/api/origin.test.ts apps/web/src/App.test.tsx apps/web/src/features/admin/admin.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web .env.example && git commit -m "feat: connect web app to cloud API"`

### Task 6: Automate Worker, D1, and Pages deployment

**Files:**
- Create: `.github/workflows/worker.yml`
- Modify: `.github/workflows/pages.yml`
- Create: `docs/cloudflare-deployment.md`
- Create: `scripts/check-cloud-deployment.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and variable `VITE_API_BASE_URL`.
- Produces: reproducible Worker/D1 deployment, Pages build configured for `https://api.skufskills.ru`, health verification, DNS checklist, and D1 export instructions.

- [ ] **Step 1: Write the deployment checker first**

Make `scripts/check-cloud-deployment.mjs` fail unless Wrangler config, migrations, workflow dependencies, required secret names, the API build variable, health probe, and backup command are all present.

- [ ] **Step 2: Run the checker and verify it fails**

Run: `node scripts/check-cloud-deployment.mjs`
Expected: FAIL with missing Worker workflow/deployment configuration.

- [ ] **Step 3: Add the Worker deployment workflow**

Install with `npm ci`, run tests/typecheck, apply remote D1 migrations, deploy the Worker, and verify `/health`. Serialize deployments so Pages never points at an unavailable API version.

- [ ] **Step 4: Update the Pages workflow**

Call the Worker workflow as a reusable workflow and make the Pages build depend on that job for pushes to `main`; build with `VITE_API_BASE_URL=https://api.skufskills.ru`; preserve manual dispatch for recovery.

- [ ] **Step 5: Document secrets, Cloudflare Free DNS records, nameserver cutover, rollback, and backup**

List the four existing GitHub Pages apex A records, `www -> miromanof.github.io`, the `api` Worker custom domain, pre-cutover verification, and `wrangler d1 export` command.

- [ ] **Step 6: Run deployment checks and the complete repository verification**

Run: `node scripts/check-cloud-deployment.mjs && npm test && npm run typecheck && npm run build`
Expected: all commands PASS.

- [ ] **Step 7: Commit**

Run: `git add .github package.json package-lock.json scripts/check-cloud-deployment.mjs docs/cloudflare-deployment.md && git commit -m "ci: deploy free cloud backend and website"`

### Task 7: Provision and release the production environment

**Files:**
- Modify: `apps/worker/wrangler.jsonc` with the real D1 database identifier after provisioning.
- Modify: `docs/cloudflare-deployment.md` only if observed provider instructions differ from the documented checklist.

**Interfaces:**
- Consumes: authenticated Cloudflare and GitHub accounts, approved spec, completed deployment workflows.
- Produces: live `https://api.skufskills.ru/health`, working `https://skufskills.ru`, and a recoverable D1 backup.

- [ ] **Step 1: Create the Cloudflare Free zone and copy DNS records**

Create `skufskills.ru` without enabling paid add-ons. Add the four GitHub Pages apex A records and the `www` CNAME before changing authoritative nameservers.

- [ ] **Step 2: Create D1 and bind the Worker custom domain**

Create the production database, write its ID to Wrangler config, configure `api.skufskills.ru`, and verify that the apex remains pointed at GitHub Pages.

- [ ] **Step 3: Configure Worker and GitHub secrets**

Run the hidden-input administrator setup, store Cloudflare deployment credentials in GitHub Actions, and verify no secret appears in git diff or workflow logs.

- [ ] **Step 4: Push the implementation and observe both workflows**

Expected: Worker migration/deployment and Pages deployment finish successfully; failed jobs do not replace the previous live versions.

- [ ] **Step 5: Switch REG.RU nameservers to Cloudflare**

Verify the copied records in Cloudflare first, then change only the authoritative nameservers. Wait for delegation and TLS verification without deleting the previous REG.RU records during propagation.

- [ ] **Step 6: Run the production smoke test**

Verify public fallback and remote reads, submit a new test term, log in to the administrator UI, compare fields, publish it, confirm public visibility, then unpublish/delete the test item.

- [ ] **Step 7: Export and verify a backup**

Export D1 to a local ignored `.sql` file and confirm it contains the migrated tables without adding it to git.

- [ ] **Step 8: Commit any provider-derived documentation correction**

Run only if documentation changed: `git add docs/cloudflare-deployment.md apps/worker/wrangler.jsonc && git commit -m "docs: record production cloud configuration"`
