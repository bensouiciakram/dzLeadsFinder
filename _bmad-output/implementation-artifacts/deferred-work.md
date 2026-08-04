# Deferred Work

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
