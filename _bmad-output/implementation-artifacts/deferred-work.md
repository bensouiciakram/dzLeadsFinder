# Deferred Work

## Deferred from: code review of story 2.1 (2026-08-01)

- djoser 2.2.3 has no register/login/logout/password-reset endpoints — `include('djoser.urls')` mounts only the `users/` router. Story 2.2 (signup) and 2.4 (password reset) must plan custom endpoints; story dev notes corrected. [backend/config/urls.py:15]
- No migrate step in deploy path (docker-compose.yml django command, backend/Dockerfile gunicorn, .github/workflows/deploy.yml); AUTH_USER_MODEL switch is unsupported on an already-migrated default-user DB. [docker-compose.yml:42]
- last_active_at per-request write amplification — authenticated requests within a 1-minute window trigger a full UPDATE on the users row (auth.py:20-22); revisit interval when traffic exists.
