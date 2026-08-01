# Deferred Work

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
