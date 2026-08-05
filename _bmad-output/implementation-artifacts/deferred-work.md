# Deferred Work

## Deferred from: code review of story-3.3-filter-sidebar-component (2026-08-05)

- No timeout/abort on search requests: a hung `searchPeople/searchCompanies` request leaves the page in `loading` forever (Apply permanently `aria-disabled`, no retry path). Add an axios timeout (service-level or the shared `HttpClient` config) — cross-cutting, touches all surfaces, belongs with the HTTP layer; revisit in Story 3.5 (results table) which will own retry/polling UX. [frontend/src/lib/api/search-service.ts, frontend/src/lib/api/http-client.ts]
- `elementFromPoint` jsdom polyfill in `src/test/mocks.ts` returns the open drawer popup for every call site — fine today, but it will mask real pointer hit-testing for the 3.4 wilaya combobox, tooltips, and any popup positioning logic. Narrow it (or scope by test) when 3.4 lands. [frontend/src/test/mocks.ts]
- Cross-stack industry parity is dev-run only: `frontend/src/data/industries.ts` must stay in lockstep with `backend/apps/search/data/industries.py` (seed order = serial ids). Extend the 3.4 wilaya parity item (below) to cover industries with a real parity check. [frontend/src/data/industries.ts]
- `aria-live="polite"` wraps the whole `#results` section; Story 3.5 must move the polite region to the count/status line before mounting the results table, or the entire table will be announced on every update. [frontend/src/components/search/SearchPage.tsx]
- Physical-property classes inside stock shadcn base-nova wrappers (drawer.tsx `md:text-left`, `left-`/`right-` swipe-direction variants, tooltip.tsx arrow offsets, scroll-area.tsx `border-l`) — registry defaults, dormant in 3.3 (swipe-down only, mobile only). Revisit if the drawer is reused at ≥md in RTL or if a CSS lint gate is added; do not hand-edit registry files lightly. [frontend/src/components/ui/{drawer,tooltip,scroll-area}.tsx]
- `FilterSidebar` `applied` re-sync effect: documented contract for Story 3.6 (saved-search re-runs replace the draft). The clobber risk for post-submit edits is accepted and documented in the story; 3.5 (chips) and 3.6 must drive `applied` with stable object identity and re-verify the effect with tests.

## Deferred from: code review of story-3.2-search-api-endpoints (2026-08-05)

- Rate-limit check-then-increment TOCTOU: the quota SELECT and the atomic upsert span the search query, so a concurrent burst at count = limit-1 can exceed the 30/100 cap. One-statement `INSERT ... ON CONFLICT DO UPDATE ... WHERE search_count < limit RETURNING` would require increment-before-success (conflicts with Q8) and a PG transaction + row lock; needs a Postgres-backed CI job to be exercised. Spine-documented pattern. [backend/apps/search/quota.py]
- PG keyword path exercised only via string assertions in CI (SQLite fallback runs behavior tests); real-PostgreSQL verification was done ad-hoc in this review. Add a Postgres-backed CI job that runs the search API tests against PG (deferred-work 2.2 precedent). [backend/apps/search/fts.py]

## Deferred from: code review of 3-1-search-database-schema (2026-08-04)

- `bulk_create` / `bulk_update` / `QuerySet.update()` skip the `save()` override, leaving `search_normalized` empty/stale (tsvector silently empty). Requirement for story 3.2 (search API) and Epic 6 (scraper pipeline): writers must set `search_normalized` explicitly or write per-row. [backend/apps/search/models.py]
- DailyUsage upsert via update-then-create races under concurrent rate-limited requests (both create → IntegrityError). Story 3.2 must use an atomic PG `INSERT ... ON CONFLICT (user_id, date) DO UPDATE` upsert; the tested pattern is the SQLite-compatible approximation. [backend/apps/search/tests/test_daily_usage.py]
- No cross-stack parity test between `backend/apps/search/data/wilayas.py` and `frontend/src/data/wilayas.ts` (mirrored by process, not by test). Story 3.4 (wilaya combobox) should consolidate the canonical source and add a parity check.

## Deferred from: code review of 2-2-signup-free-credits (2026-08-01)

- Rate limiting on `POST /api/auth/signup/` and `POST /api/auth/resend-verification/` — anonymous email bombing of existing users + unbounded account creation. Needs a new dependency (django-ratelimit / django-axes) → user approval required before prod. [backend/apps/accounts/views.py:159,225]
- `select_for_update` is a silent no-op on SQLite — the concurrent-verify double-grant protection is only exercised on Postgres; CI currently runs no backend tests. Add a Postgres-backed CI job. [backend/apps/accounts/views.py:174]
- Client routing for 401 `email_not_verified` (redirect to /verify-email) + refresh tokens minting for unverified users — belongs to story 2.3 (Login & Session Management). [backend/apps/accounts/auth.py:27]
- `SingleUseToken` rows accumulate (resend invalidates by UPDATE, never deletes) — add a daily cleanup task (expired/consumed rows) to the ops maintenance backlog.
- Verification token exposed in URL path / access logs — standard email-link tradeoff; mitigated by single-use + 24h TTL.
- stylelint globals.css debt (136 pre-existing errors in the story-1.x design-token file) — unrelated to story 2.2; `lint:css` is not in the CI verification list.

## Deferred from: code review of story 2.1 (2026-08-01)

- djoser 2.2.3 has no register/login/logout/password-reset endpoints — `include('djoser.urls')` mounts only the `users/` router. Story 2.2 (signup) and 2.4 (password reset) must plan custom endpoints; story dev notes corrected. [backend/config/urls.py:15]
- No migrate step in deploy path (docker-compose.yml django command, backend/Dockerfile gunicorn, .github/workflows/deploy.yml); AUTH_USER_MODEL switch is unsupported on an already-migrated default-user DB. [docker-compose.yml:42]
- last_active_at per-request write amplification — authenticated requests within a 1-minute window trigger a full UPDATE on the users row (auth.py:20-22); revisit interval when traffic exists.

## Deferred from: code review of 2-3-login-session-management (2026-08-01)

- "7 days" deletion grace hardcoded in frozen-account copy; backend has no shared grace constant. Story 2.6 owns the deletion-grace flow (recover action + constant). [frontend/messages/en.json]
- SessionUser cast blindly from /api/auth/me/ response; a backend field change would silently corrupt the Header. Adopt zod response parsing (AD-18 pattern) in a later story touching session data. [frontend/src/lib/api/auth-service.ts:22]
- /frozen renders the guest header (Login/Sign up links) since the probe degrades to guest there. Story 2.6 refines the frozen surface. [frontend/src/components/layout/Header.tsx:18]
