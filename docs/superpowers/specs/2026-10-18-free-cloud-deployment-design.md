# Free Cloud Deployment Design

## Goal

Keep `skufskills.ru` available around the clock without a monthly hosting bill. Visitors must be able to browse published cards and submit new cards or corrections while the owner's computer is turned off. The existing browser-based moderation workflow must continue to work.

## Approved architecture

- GitHub remains the source repository and GitHub Pages serves the React application at `skufskills.ru`.
- A Cloudflare Worker exposes the existing `/api` contract at `https://api.skufskills.ru`.
- Cloudflare D1 stores submissions, published content, moderation state, and administrator sessions.
- The web build receives the API origin through `VITE_API_BASE_URL`; local development continues to use `http://127.0.0.1:3001`.
- The Worker permits production and localhost origins explicitly. Administrator cookies are supported only on the same-site `skufskills.ru` origins; the GitHub Pages preview origin may perform public reads and anonymous submissions but not administrator actions.
- No uploaded files are stored. Meme cards continue to reference externally hosted HTTPS video or image material.

## Components

### Web application

The existing React UI and hash-based routes remain unchanged for users. API requests are routed through one shared URL resolver. Public reads, anonymous submissions, administrator login, moderation, and publication all use the Cloudflare API in production.

The dictionary keeps its embedded cards as a graceful fallback if the API is temporarily unavailable. A failed API refresh must not make the public site unusable.

### Cloudflare Worker

The Worker implements the current API surface required by the web application:

- health check;
- public content list, search, buckets, and detail;
- idempotent anonymous submissions with validation and rate limiting;
- administrator login, logout, and session check;
- moderation queue and item detail;
- per-field moderation decisions, publication, rejection, unpublication, and deletion.

The Worker uses Web Crypto with a salted PBKDF2 verifier for the administrator password, plus cryptographically random session and CSRF tokens, signed cursors, and request hashes. Secrets are configured as Cloudflare secrets and never committed to GitHub.

### D1 database

D1 receives a SQLite-compatible version of the current schema. JSON values and tag arrays are stored as JSON text. Migrations are versioned under the Worker package and applied by the deployment workflow.

Indexes cover moderation status, creation time, normalized title, session expiry, and submission rate-limit windows. Published content and pending submissions survive browser closure and the owner's computer being turned off.

### Deployment

GitHub Actions performs two independent deployments from `main`:

1. deploy the Worker and apply D1 migrations;
2. build the React app with the deployed Worker URL and publish it to GitHub Pages.

Cloudflare credentials and identifiers are GitHub Actions secrets. The administrator login, password verifier, cursor-signing secret, and session-signing secret are Cloudflare secrets.

The domain's authoritative DNS moves from REG.RU nameservers to Cloudflare Free DNS. Before the nameserver switch, the existing GitHub Pages apex records and `www` CNAME are copied into Cloudflare. The Worker receives the `api.skufskills.ru` custom domain. The switch happens only after those records and the Worker are ready, so the public site keeps pointing to GitHub Pages throughout the change.

## Data flow

1. A visitor loads the static site from GitHub Pages.
2. The browser requests published additions from the Worker. If that request fails, the embedded collection remains visible.
3. A submitted card or correction is validated by the Worker and inserted into D1 with an idempotency key.
4. The administrator signs in through the existing UI. The Worker returns a secure, HTTP-only session cookie and a CSRF token.
5. Moderation actions update the D1 item. Publication makes the public API return it immediately.

## Security and privacy

- Anonymous requests are schema-validated and size-limited.
- Submission rate limiting is persisted in D1 so it works across Worker instances.
- Administrator cookies use `Secure`, `HttpOnly`, and `SameSite=Lax`; the UI and API have different origins but remain on the same `skufskills.ru` site.
- State-changing administrator requests require both a valid session and CSRF token.
- Allowed CORS origins are an explicit list; arbitrary origins are rejected.
- Passwords are never stored or logged. Only a verifier configured as a secret is used.
- The project continues to discourage submitters from entering personal data.

## Failure handling

- If Cloudflare is unavailable, the public embedded catalogue still renders and submission forms retain entered values while reporting an error.
- Duplicate retries with the same idempotency key return the original submission; reuse with different data returns a conflict.
- Exhausted free-tier limits return a clear temporary-unavailability response and never trigger automatic billing.
- Database migrations are additive and safe to run repeatedly.
- A documented export command creates a local SQL backup of D1.

## Verification

- Unit tests cover validation, CORS, authentication, CSRF, idempotency, moderation transitions, public filtering, cursor tampering, and free-tier failure responses.
- Worker integration tests run against a local D1 database.
- The production workflow verifies Worker health and the GitHub Pages build before deployment is considered successful.
- A manual smoke test covers anonymous submission, administrator login, side-by-side moderation decisions, publication, and public visibility.

## Operational constraints

- Monthly platform cost must remain zero.
- The design stays within Workers Free and D1 Free limits; Cloudflare must not be upgraded to a paid plan automatically.
- The primary D1 database limit is 500 MB, with daily free allowances of 5 million rows read and 100,000 rows written.
- The owner's computer is not required for normal site operation or intake of submissions.
