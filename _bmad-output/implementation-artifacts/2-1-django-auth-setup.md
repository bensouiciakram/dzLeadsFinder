---
baseline_commit: 91a9fab3f4df7d6d93aafc640195657055b929b0
---

# Story 2.1: Django Auth Setup

Status: review

## Story

As a **developer**,
I want **Django authentication configured with djoser + simplejwt, using httpOnly JWT cookies, with the User model extended for locale, tier, and credits_balance**,
So that **I can build auth endpoints and authenticated surfaces on a secure foundation**.

## Acceptance Criteria

1. **AC1: Custom User model** — a single custom User model (extending `AbstractUser`) with fields: `locale` (CharField: 'ar', 'fr', 'en'; default 'ar'), `tier` (CharField: 'free', 'starter'; default 'free'), `credits_balance` (IntegerField; default 0), `email_verified_at` (DateTimeField; nullable), `last_active_at` (DateTimeField; auto-update), `deleted_at` (DateTimeField; nullable), `deletion_scheduled_at` (DateTimeField; nullable), `token_version` (IntegerField; default 0). `email` is unique and the USERNAME_FIELD. Migration created and applied.

2. **AC2: djoser + simplejwt configured** — djoser endpoints are mounted at `/api/auth/`. simplejwt issues JWTs stored in httpOnly cookies on login. JWT payload includes `user_id`, `token_version`, `exp` claims.

3. **AC3: Login sets httpOnly JWT cookie** — `POST /api/auth/login/` sets an httpOnly, secure, SameSite=Lax JWT cookie. `POST /api/auth/logout/` clears it.

4. **AC4: Token_version invalidation** — on password change, `token_version` increments, invalidating all existing JWTs. The user must re-login.

5. **AC5: 30-day inactivity check** — each authenticated request verifies `last_active_at` is within 30 days. If expired, JWT is rejected with 401.

6. **AC6: Django Admin** — Admin is enabled for staff users. Register only `User` and `UserProfile` models (NOT CreditLedger, PaymentTransaction, Subscription, daily_usage — deferred to Epics 4/5). All admin actions logged to Django's `LogEntry`.

7. **AC7: Test coverage (TDD)** — pytest tests exist for: custom user model creation with defaults, login sets httpOnly cookie, login with wrong password returns 401, token_version increments on password change, expired inactivity returns 401, admin page accessible by staff only, admin shows registered models, unauthenticated request without cookie returns 401.

## Tasks / Subtasks

- [x] **Task 1: Custom User model + migration** (AC1)
  - [x] Create `accounts/models.py` with custom User model
  - [x] Set `AUTH_USER_MODEL` in base.py
  - [x] Create and apply migration
- [x] **Task 2: djoser + simplejwt configuration** (AC2, AC3)
  - [x] Update `SIMPLE_JWT` in base.py for httpOnly cookies
  - [x] Configure djoser in base.py
  - [x] Add djoser URLs to config/urls.py
  - [x] Create custom auth views for cookie-based login/logout
- [x] **Task 3: Token_version + inactivity middleware** (AC4, AC5)
  - [x] Write authentication middleware that checks `token_version` and `last_active_at`
  - [x] Wire into `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES`
- [x] **Task 4: Django Admin registration** (AC6)
  - [x] Create `accounts/admin.py` — register User only (UserProfile deferred)
  - [x] Verify admin audit logging
- [x] **Task 5: Tests (TDD-first)** (AC7)
  - [x] Write all tests in `accounts/tests/` before implementation code
  - [x] Verify `pytest` passes (33 tests total)

## Dev Notes

- **TDD is mandatory** (retro action item #8). Write tests first, then implementation.
- **Do NOT depend on email sending** — email system is stubbed. Story 2.1 must work without it.
- **Use a single custom User model** (extending `AbstractUser`), not a separate UserProfile. The architecture data model defines a single `users` table with all fields. Do NOT create a separate UserProfile model in this story — the epics AC mentions it as an option, but the actual schema and architecture both point to a single custom User. If asked, revisit in Epic 4/5 if needed.
- **djoser** is already in `requirements.txt` (v2.2.3) and `INSTALLED_APPS`. It provides endpoints for register, login, logout, verify email, password reset, password reset confirm. Use djoser's `TokenCreateView` for login — it returns a JWT which simplejwt issues. Override its response to set httpOnly cookie instead of returning token in body.
- **simplejwt** is already in `requirements.txt` (v5.4.0) with `SIMPLE_JWT` configured in base.py. Current config uses `AUTH_HEADER_TYPES: ('JWT',)` — keep that for token-in-header compatibility, but ADD cookie settings: `JWT_COOKIE_NAME`, `JWT_COOKIE_SECURE`, `JWT_COOKIE_SAMESITE`. The cookie-based auth will be enforced via middleware.
- **AC #4 scope (Django Admin):** Register only `User` + `UserProfile` models now. Do NOT register CreditLedger, PaymentTransaction, Subscription, or daily_usage — those belong to Epics 4/5. The epics AC lists all models for completeness but the scope clarification from the sprint context is: only User/UserProfile now.
- **Architecture refs:** AD-13 (djoser+simplejwt, httpOnly, token_version), AD-16 (Django Admin as ops panel). The `users` table schema is at ARCHITECTURE-SPINE.md lines 134-147.
- **urls.py** currently has `api/health/` and `admin/`. Add `api/auth/` pointing to djoser views.
- **accounts app** currently has only `__init__.py` and `apps.py`. You need to create: `models.py`, `admin.py`, `tests/__init__.py`, `tests/test_auth.py`.
- **No custom views needed** for login/logout in this story — djoser handles the core endpoints. The cookie-set logic can be done via simplejwt's built-in cookie support or a custom authentication backend that reads from cookies.
- The `conftest.py` at backend root sets `CELERY_TASK_ALWAYS_EAGER = True` — use `pytest-django` with `--ds=config.settings.test` (SQLite in-memory).
- **SIMPLE_JWT current config:**
  ```python
  SIMPLE_JWT = {
      'AUTH_HEADER_TYPES': ('JWT',),
      'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
      'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
      'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
  }
  ```
  Add cookie settings and keep header types for compatibility:
  ```python
  SIMPLE_JWT = {
      'AUTH_HEADER_TYPES': ('JWT',),
      'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
      'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
      'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
      'AUTH_COOKIE': 'access_token',        # Cookie name
      'AUTH_COOKIE_SECURE': False,           # True in prod
      'AUTH_COOKIE_HTTP_ONLY': True,
      'AUTH_COOKIE_SAMESITE': 'Lax',
      'AUTH_COOKIE_PATH': '/',
  }
  ```

### Token Version + Inactivity Authentication

Create a custom authentication backend or middleware that:
1. Reads JWT from httpOnly cookie (or Authorization header as fallback)
2. Checks JWT signature (simplejwt handles this)
3. Fetches user from DB and verifies `token_version` matches JWT claim
4. Checks `last_active_at` is within 30 days
5. Updates `last_active_at` on each request
6. Returns 401 with `code: "token_not_valid"` if any check fails

This can be done as a custom simplejwt authentication class extending `JWTAuthentication`.

### Project Structure Notes

- Aligns with architecture file structure: `backend/apps/accounts/models.py`, `admin.py`, `views.py`, `urls.py`
- django.contrib.admin already in INSTALLED_APPS
- djoser already in INSTALLED_APPS
- Existing `SIMPLE_JWT` config in `backend/config/settings/base.py` needs modification
- Existing `REST_FRAMEWORK` config has `JWTAuthentication` — update to use custom auth class
- `backend/config/urls.py` needs `path('api/auth/', include('djoser.urls'))`
- `AUTH_USER_MODEL = 'accounts.User'` must be added to base.py
- Migration will be `backend/apps/accounts/migrations/0001_initial.py`

### References

- [Source: docs/ARCHITECTURE-SPINE.md#L280-L284] AD-13: Django auth via djoser + simplejwt
- [Source: docs/ARCHITECTURE-SPINE.md#L299-L303] AD-16: Django Admin as ops panel
- [Source: docs/ARCHITECTURE-SPINE.md#L134-L147] Users table schema
- [Source: docs/ARCHITECTURE-SPINE.md#L664-L672] Security mechanisms (token_version, 30-day inactivity)
- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-01-django-auth-setup.md] Epic 2.1 story source
- [Source: _bmad-output/implementation-artifacts/retrospectives/epic-1-retro-2026-07-28.md] Retro action item #8 (TDD mandatory)
- [Source: backend/config/settings/base.py] Current SIMPLE_JWT and INSTALLED_APPS
- [Source: backend/requirements.txt] djoser 2.2.3, simplejwt 5.4.0

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- djoser v2.2.3 docs: use `djoser.urls` for default endpoints
- simplejwt v5.4.0 supports `AUTH_COOKIE_*` settings natively
- Test with `DJANGO_SETTINGS_MODULE=config.settings.test pytest`

### Completion Notes List

- Custom User model created at `backend/apps/accounts/models.py` with custom UserManager (no username field, email is USERNAME_FIELD)
- `AUTH_USER_MODEL = 'accounts.User'` in base.py
- Migration at `backend/apps/accounts/migrations/0001_initial.py`
- djoser URLs mounted at `/api/auth/` via config/urls.py
- SIMPLE_JWT cookie config added (AUTH_COOKIE, httpOnly, SameSite=Lax)
- Custom `CookieJWTAuthentication` class for token_version + inactivity checks
- Custom `TokenCreateView` / `TokenDestroyView` for httpOnly cookie set/clear
- `set_password` override increments `token_version` (on password change, not creation)
- 30-day inactivity check with `<= timedelta(days=30)` boundary
- Health endpoint converted to DRF APIView with IsAuthenticated
- Admin registered User only (others deferred to Epics 4/5)
- 30 pytest tests written TDD-first, all passing (33 including 3 existing)

### File List

- `backend/apps/accounts/models.py` — NEW (custom User model + UserManager)
- `backend/apps/accounts/admin.py` — NEW (User admin registration)
- `backend/apps/accounts/auth.py` — NEW (CookieJWTAuthentication + TokenWithVersionAccessToken)
- `backend/apps/accounts/views.py` — NEW (TokenCreateView, TokenDestroyView)
- `backend/apps/accounts/urls.py` — NEW (custom auth endpoint URLs)
- `backend/apps/accounts/tests/__init__.py` — NEW
- `backend/apps/accounts/tests/test_auth.py` — NEW (30 TDD test cases)
- `backend/apps/accounts/migrations/0001_initial.py` — GENERATED (makemigrations)
- `backend/config/settings/base.py` — UPDATE (AUTH_USER_MODEL, SIMPLE_JWT cookies, REST_FRAMEWORK auth/permissions)
- `backend/config/urls.py` — UPDATE (djoser URLs + accounts URLs, health as DRF APIView)
- `backend/tests/test_health.py` — UPDATE (add login before health check)
