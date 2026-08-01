---
story_id: 2.2
epic: 2
title: Story 2.2 — Signup with Free Credits
status: review
frs: [FR-21]
baseline_commit: dfd05d96c9ccb8cda88f97fedd61fdd3881ee052
---

# Story 2.2: Signup with Free Credits

Status: review

## Story

As a **new Algerian B2B buyer**,
I want **to sign up with only my email and password — no credit card asked — and receive 15 free credits on email verification**,
So that **I can try the product risk-free before committing to a paid plan**.

## Acceptance Criteria

1. **AC1: Signup form** — the `/signup` page shows exactly two fields (email, password), no payment fields, no tier preselection, no card input, and a note beside the CTA states "No card required".

2. **AC2: Signup submission** — a valid email + password creates the account with `tier='free'`, `credits_balance=0`; a verification email is sent with a single-use link (24h expiry); the user is redirected to `/verify-email` with a hard gate message.

3. **AC3: Verification gate** — until verified, the user is blocked from app surfaces at the verify-email screen, which offers a "Resend link" option. Gate is enforced server-side on the authenticated API surface.

4. **AC4: Link verification** — a valid (not expired, unused) link sets `email_verified_at`, increments `credits_balance` by 15, and shows a 15-credit welcome banner; redirect target is `/search` (default post-login landing) — story 2.2 implements a success screen with banner + "Start searching" CTA instead (Epic 3 owns `/search`).

5. **AC5: Expired link** — clicking a link after 24h shows a clear "link expired — request a new one" screen.

6. **AC6: Used link** — clicking an already-used link shows a "link already used" screen with a sign-in prompt; **no duplicate credit grant occurs** (idempotent).

7. **AC7: Validation** — invalid email format and password < 8 characters produce localized errors rendered with `aria-invalid` and `aria-describedby`.

## Tasks / Subtasks

- [x] **Task 1: Single-use token model + migration** (AC2, AC5, AC6)
  - [x] 1.1 Add generic `SingleUseToken` model to `backend/apps/accounts/models.py` (purpose `verify`/`reset`, user FK, unique token, `expires_at`, `consumed_at`, `created_at`) — one model serves story 2.4 password reset too
  - [x] 1.2 Create + apply migration `0002` (TDD: test model fields/defaults first)

- [x] **Task 2: Signup endpoint** (AC1, AC2, AC7)
  - [x] 2.1 `SignupSerializer` in `backend/apps/accounts/serializers.py` — email (lowercased, unique), password (min 8 via `django.contrib.auth.password_validation.validate_password`); card/payment fields NOT in serializer (extra keys ignored → no card data accepted)
  - [x] 2.2 `SignupView` (APIView, `permission_classes=[AllowAny]`) — creates user (`tier='free'`, `credits_balance=0`, `is_active=True`, locale from `x-locale` cookie default `'ar'`), creates 24h verify token, calls `send_verification_email.delay(user.pk)`, returns 201; duplicate email → 400 `email_taken`; validation errors → 400 with field keys
  - [x] 2.3 URL `api/auth/signup/` in `backend/apps/accounts/urls.py`

- [x] **Task 3: Verify email endpoint + 15 credits** (AC4, AC5, AC6)
  - [x] 3.1 `VerifyEmailView` (APIView, AllowAny) GET `api/auth/verify-email/<str:token>/` — `select_for_update()` + `transaction.atomic`; success → `consumed_at=now`, `email_verified_at=now`, `credits_balance += 15` (increment ONLY when transitioning unverified→verified → replay safe); error codes: `token_expired` (400), `token_used` (410), `token_not_found` (404)
  - [x] 3.2 URL `api/auth/verify-email/<str:token>/`
  - [x] 3.3 NOTE: `credit_ledger` row (`event_type='free_signup'`) DEFERRED to story 4-1 — do NOT create a ledger model here

- [x] **Task 4: Resend verification** (AC3)
  - [x] 4.1 `ResendVerificationView` (APIView, AllowAny) POST `api/auth/resend-verification/` body `{email}` — invalidates pending verify tokens for that user, creates a fresh 24h token, sends email; **always returns 200** (anti-enumeration — do not reveal whether the email exists)
  - [x] 4.2 URL `api/auth/resend-verification/`

- [x] **Task 5: Verification gate (server-side)** (AC3)
  - [x] 5.1 Extend `CookieJWTAuthentication.authenticate` in `backend/apps/accounts/auth.py`: if `user.email_verified_at is None` → `AuthenticationFailed('Email not verified', code='email_not_verified')`
  - [x] 5.2 Do NOT modify `validate_user_token`/`touch_activity` (story 2.4 reuses them); `TokenRefreshView` has `authentication_classes=[]` and must keep working for unverified users
  - [x] 5.3 Update shared fixture `logged_in_client` in `backend/conftest.py` to mark the user verified before login (keeps the existing 46 tests green)

- [x] **Task 6: send_verification_email task + email settings** (AC2, AC4)
  - [x] 6.1 Implement `send_verification_email(user_id)` in `backend/tasks/email_tasks.py` — fetch user + latest pending verify token, link = `{FRONTEND_PUBLIC_URL}/{user.locale}/verify-email/{token}`, `render_email('signup_confirm', user.locale, {'verificationLink': link})`, send via Django email backend (EmailMessage, HTML + plain text)
  - [x] 6.2 Add `FRONTEND_PUBLIC_URL` + `EMAIL_*` env-driven settings to `backend/config/settings/base.py` (default console email backend); `backend/config/settings/test.py` → `django.core.mail.backends.locmem.EmailBackend`
  - [x] 6.3 Keep stub signatures of other tasks (`send_payment_receipt`, `send_pack_receipt`, `check_low_credits`) untouched

- [x] **Task 7: Frontend signup page** (AC1, AC7)
  - [x] 7.1 `frontend/src/app/[locale]/signup/page.tsx` (Server Component shell + metadata)
  - [x] 7.2 `frontend/src/components/auth/SignupForm.tsx` (client) — email + password only, "No card required" note beside CTA, localized field errors with `aria-invalid` + `aria-describedby`, POST `/api/auth/signup/`, on 201 → `router.push('/verify-email?email=…')`, map 400 field errors (`email_taken` → error_email_taken)
  - [x] 7.3 Vitest: signup form renders 2 fields, no-card note, validation errors with aria attributes, submit success redirect

- [x] **Task 8: Frontend verify-email gate + resend** (AC3)
  - [x] 8.1 `frontend/src/app/[locale]/verify-email/page.tsx` + `frontend/src/components/auth/VerifyEmailGate.tsx` (client; `useSearchParams` wrapped in `<Suspense>` — Next 14 requirement) — hard gate message, email prefill from `?email=`, "Resend link" button → POST `/api/auth/resend-verification/` → success state (resend_success)
  - [x] 8.2 Vitest: gate renders message + resend flow states

- [x] **Task 9: Frontend verification link handling + welcome banner** (AC4, AC5, AC6)
  - [x] 9.1 `frontend/src/app/[locale]/verify-email/[token]/page.tsx` + `frontend/src/components/auth/VerifyLinkHandler.tsx` (client) — GET `/api/auth/verify-email/{token}/`; success → 15-credit welcome banner (`tabular-nums`) + "Start searching" CTA → `router.push('/search')`; `token_expired` → expired screen + resend form; `token_used` → used screen + sign-in prompt
  - [x] 9.2 Vitest: success/expired/used states (mock fetch)

- [x] **Task 10: i18n keys in all three locales** (AC7)
  - [x] 10.1 Extend `auth.signup` + `auth.verify` in `frontend/messages/en.json` (new keys: no_card_required, gate title/description, email_label, expired title/description, used title/description, sign_in link, welcome banner title/description, start_search, resend error)
  - [x] 10.2 Mirror keys in `fr.json` and `ar.json` (Arabic for AR, French for FR) — `npm run check:i18n` must pass

- [x] **Task 11: Backend tests (TDD-first)** (all ACs)
  - [x] 11.1 `backend/apps/accounts/tests/test_signup.py` — defaults created, no card fields (extra payload keys ignored), duplicate email 400, bad email 400, short password 400, 201 + token created + email queued (mail.outbox)
  - [x] 11.2 `backend/apps/accounts/tests/test_verify_email.py` — verify grants 15 once, replay → no double grant (410), expired → 400, unknown token → 404, already-verified user → no extra grant
  - [x] 11.3 `backend/apps/accounts/tests/test_resend.py` — new token issued, old pending invalidated, always 200 for unknown email, email sent
  - [x] 11.4 `backend/apps/accounts/tests/test_gate.py` — unverified logged-in user → 401 `email_not_verified` on `/api/health/`; verified user succeeds (existing tests cover the happy path)
  - [x] 11.5 `backend/tests/test_email_tasks.py` — extend: task sends email with correct recipient + link when token exists (patch `render_email`; `CELERY_TASK_ALWAYS_EAGER=True`)

- [x] **Task 12: Verification gates + story sync**
  - [x] 12.1 Full backend suite green (46 existing + new), `ruff check .` 0 errors, `mypy .` strict 0 errors
  - [x] 12.2 `npm run lint`, `npm run test`, `npm run typecheck`, `npm run check:i18n` all pass
  - [x] 12.3 Story file updated: tasks checked, File List complete, completion notes incl. ledger deferral; status → review

## Dev Notes

### Decided constraints (confirmed with user)

- **No djoser register endpoint exists** (djoser 2.2.3 mounts only `users/` router — verified in 2.1 review). Build custom signup matching the ACs exactly: email+password only, `tier='free'`, `credits_balance=0`, no card fields.
- **Verification link**: DB-backed single-use token, 24h expiry. Model is generic with `purpose` field (`'verify'` now, `'reset'` for story 2.4) — one model serves both.
- **Credit ledger row (AC: `event_type='free_signup'`) DEFERRED to Epic 4** (story 4-1 owns the ledger schema). Story 2.2 sets `email_verified_at` + increments `credits_balance` by 15 only. Record this deviation in completion notes.
- **Verification gate**: server-side in `CookieJWTAuthentication` (authenticated API surface). Frontend verify-email screen with "Resend link".
- **Emails**: render via existing Next.js render endpoint (`POST /api/emails/render`), pass `user.locale` (endpoint accepts `locale` in body; templates are English-only for now — pass-through, RTL via `BaseEmail` `dir="auto"`).
- **Post-verify redirect**: success screen with 15-credit welcome banner + "Start searching" CTA → `/search` (NOT a literal redirect — `/search` is Epic 3 backlog).
- **No auto-login after signup**: user stays a guest on `/verify-email?email=…`; sessions are story 2.3 (Login & Session Management). Do not set JWT cookies in the signup view.
- **Used-link sign-in prompt**: `/login` page is story 2.3 backlog (404 until then). Render the prompt as text + a `Link` to `/login` — flagged in completion notes; do not build the login page.

### Existing patterns to follow (from story 2.1)

- User model: `backend/apps/accounts/models.py` — email lowercased at create (`UserManager._create_user`), `USERNAME_FIELD='email'`, `db_table='users'`.
- Views: `backend/apps/accounts/views.py` — class-based `APIView` with explicit `permission_classes = [permissions.AllowAny]` (global DRF default is `IsAuthenticated` — every public endpoint MUST declare `AllowAny`).
- Auth: `backend/apps/accounts/auth.py` — `CookieJWTAuthentication`, `validate_user_token`, `touch_activity` are SHARED with story 2.4 — do not break their contract. Gate unverified users in `authenticate()` only.
- URLs: `backend/config/urls.py` mounts `api/auth/` → `djoser.urls` + `apps.accounts.urls`. Add new paths to `apps/accounts/urls.py`.
- Tests: pytest + pytest-django, `pytest.mark.django_db`, fixtures from `backend/conftest.py` (`api_client`, `user_data`, `create_user`, `logged_in_client`). Run from `backend/` with `.\.venv\Scripts\python.exe -m pytest`. `CELERY_TASK_ALWAYS_EAGER=True` set in conftest.
- Test client uses cookies via Django `Client` — cookie auth is exercised end-to-end.
- TDD is mandatory (retro action item #8): write failing tests first, confirm red, then implement, then green.

### Email task implementation notes

- `backend/tasks/email_tasks.py` stub exists: `send_verification_email(user_id)` with TODO Story 2.x. `render_email(template, locale, context)` helper already POSTs to `http://nextjs:3000/api/emails/render` and returns `(html, plainText)`.
- Backend currently has NO email settings — add env-driven `EMAIL_*` to `base.py` (default console backend), locmem in `test.py`.
- Verification link format: `{FRONTEND_PUBLIC_URL}/{user.locale}/verify-email/{token}` — frontend route `[locale]/verify-email/[token]` handles it.
- Task signature stays `user_id: int` (architecture docs reference `send_verification_email.delay(user_id)`); task looks up the latest pending `verify` token itself. Guard `DoesNotExist` (log + return, never raise in eager mode).

### Frontend patterns to follow

- Next.js 14 App Router, pages under `frontend/src/app/[locale]/`, server components with `getTranslations`/`setRequestLocale` (see `about/page.tsx`), client components with `useTranslations`.
- Messages: single flat JSON per locale at `frontend/messages/{en,fr,ar}.json`; `npm run check:i18n` requires full key parity (en source of truth).
- `useSearchParams` in client components requires `<Suspense>` wrapper (Next 14 static rendering).
- Design tokens: `px-gutter`, `max-w-content-max-marketing`, `bg-primary`, `text-muted-foreground`, `rounded-md` etc. — logical properties only (`ms-*`/`me-*`/`text-start`/`text-end`), NO `margin-left` etc. (stylelint enforces).
- Vitest: `frontend/src/__tests__/*.test.tsx`, jsdom, global mocks in `src/test/mocks.ts` (next-intl keys return the key itself — tests assert on key strings); mock `fetch` with `vi.stubGlobal` per test.
- Header already links to `/signup` (`common.nav.start_free`) and `/login`.

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`. `python3`/`uv` NOT available — use `python` for scripts, `.\.venv\Scripts\python.exe` for backend.
- Ruff line length 100; mypy strict needs annotations on every def; `# type: ignore` only when justified.
- Do not touch `/api/health/` (authenticated) or `/api/health/live/` (public) behavior from 2.1 review — the gate test uses `/api/health/` as the protected surface but must not change the views themselves.
- No code comments unless necessary; follow repo style.
- Commit author is unset in git — use `git -c user.name="bensouici akram" -c user.email="bensouiciakram@gmail.com"`. One commit per logical unit, message prefix `Story 2.2: …`. Do NOT push.
- `resolve_customization.py` requires Python 3.11+ (tomllib); on this machine it fails — manual fallback per SKILL.md (no overrides exist; defaults apply).

### Project Structure Notes

- Backend app layout mirrors architecture: `backend/apps/accounts/{models,views,serializers,urls,admin,auth}.py`.
- `serializers.py` does not exist yet in accounts — create it.
- Migration numbering: `0001_initial.py` exists; new migration will be `0002_*`.
- Frontend email components live in `frontend/emails/components/` (NOT `src/emails`) — `SignupConfirm.tsx` already exists, no changes needed this story.
- No `login` page exists yet (story 2.3); do not create one.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-02-signup-free-credits.md] Story spec (7 AC groups)
- [Source: _bmad-output/implementation-artifacts/2-1-django-auth-setup.md] Completed auth foundation (models, auth.py, views.py, urls.py, conftest, 46 tests)
- [Source: docs/ARCHITECTURE-SPINE.md#L134-L147] users table schema; #L280-L284 AD-13 auth; #L762-L783 Email system (render flow, SignupConfirm trigger)
- [Source: docs/ARCHITECTURE-SPINE.md#L411-L416] API routes (signup, verify-email, resend)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L134,L157,L275-L276] Verify-email gate UX (hard gate, resend, 24h notice, 15 credits on verification)
- [Source: backend/apps/accounts/models.py] User model + UserManager
- [Source: backend/apps/accounts/views.py] Existing AllowAny APIView patterns + cookie helpers
- [Source: backend/apps/accounts/auth.py] CookieJWTAuthentication (gate insertion point)
- [Source: backend/tasks/email_tasks.py] send_verification_email stub + render_email helper
- [Source: backend/conftest.py] Shared fixtures (logged_in_client needs verified-user update)
- [Source: backend/config/settings/base.py, test.py] Settings (EMAIL_* to add)
- [Source: frontend/messages/en.json] auth.signup / auth.verify key structure
- [Source: frontend/src/app/api/emails/render/route.ts] Render endpoint (accepts locale, currently English-only templates)
- [Source: frontend/src/components/layout/Header.tsx] Existing /signup link
- [Source: frontend/src/test/mocks.ts] Vitest mocks pattern

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- `resolve_customization.py` requires Python 3.11+ (tomllib) — this machine has Python 3.10.11; skill fallback applied (no custom overrides exist; defaults from `customize.toml` used)
- **Test hang (Redis)**: `send_verification_email.delay()` hung in tests — even in eager mode `send_task` calls the result backend's `on_task_call`; default `CELERY_RESULT_BACKEND=redis://redis:6379` blocked on connection. Fixed by wiring `CELERY_TASK_ALWAYS_EAGER` as a real Django setting in base.py (the conftest env var was previously inert — latent 2.1 bug, never exercised because no task was dispatched) + `CELERY_RESULT_BACKEND='cache+memory://'` + `CELERY_TASK_EAGER_PROPAGATES=True` in test.py. Diagnosed with a faulthandler dump plugin.
- **Circular import**: `config/celery.py` imports `tasks.email_tasks` before the app registry is ready → Django imports (settings, get_user_model, EmailMessage, SingleUseToken) deferred inside `send_verification_email`.
- **EmailMultiAlternatives**: `EmailMessage` has no `attach_alternative` — AttributeError in task; switched to `EmailMultiAlternatives`.
- **DRF 401 responses drop `code`**: `AuthenticationFailed(code=...)` renders as `{'detail': ...}` only; frontend needs a machine-readable code to distinguish `email_not_verified` from expired/invalid sessions → added `apps/accounts/exceptions.py` custom exception handler wiring `exc.get_codes()` into `response.data['code']` (additive; existing tests unaffected).
- **Gate vs existing tests**: 5 test_auth tests logged in unverified users and hit protected endpoints → helper `_verify_user` added in test_auth.py; shared `logged_in_client` fixture now marks users verified (test_health.py green via fixture).
- **Token uniqueness in tests**: `_make_token` used email-derived token values → UNIQUE collision on two tokens per user; switched to uuid4-based values.
- **Frontend**: `npm.ps1` blocked by execution policy → use `npm.cmd`. `useSearchParams` requires `<Suspense>` wrapper in Next 14 static pages. Vitest `getByText('errors.required')` matched two elements (both fields) → `getAllByText`.
- **Pre-existing debt fixed**: `email-render-route.test.ts` cast `Request` instead of `NextRequest` (story 1.8) — typecheck was red at baseline; minimal cast fix applied.
- **Pre-existing noise (not fixed, unrelated)**: stylelint errors in `src/app/globals.css` (136, story 1.x file, `lint:css` not in CI verification list); vitest prints 3 prettier serializer errors from the story-1.8 LowCredit template's nested `<p>` (tests still pass; exit code 0).

### Completion Notes List

- Custom `SignupView` (POST /api/auth/signup/, AllowAny): email+password only; `tier='free'`, `credits_balance=0`, `is_active=True`, locale from `x-locale` cookie (default 'ar', validated against LOCALE_CHOICES); email lowercased; 24h single-use verify token; `send_verification_email.delay()`; 201. Duplicate email 400 `email`, invalid email/short password 400 (via `validate_password` with AUTH_PASSWORD_VALIDATORS). Card/tier extra payload keys ignored (not in serializer → no card data accepted).
- `SignupSerializer` in new `apps/accounts/serializers.py`; `create_single_use_token` helper in new `apps/accounts/tokens.py` (`secrets.token_urlsafe(32)`, 24h TTL) — purpose `'verify'`/`'reset'` ready for story 2.4.
- Generic `SingleUseToken` model (user FK, purpose choices verify/reset, unique token, expires_at, consumed_at, created_at) + migration `0002_alter_user_locale_alter_user_tier_singleusetoken` (also backfills locale/tier choices that 0001 omitted).
- `VerifyEmailView` (GET /api/auth/verify-email/<token>/, AllowAny): `transaction.atomic` + `select_for_update` on token AND user rows → idempotent: success sets `consumed_at`, `email_verified_at`, `credits_balance += 15` only on unverified→verified transition; replay → 410 `token_used` (no double grant); expired → 400 `token_expired`; unknown → 404 `token_not_found`; already-verified user with fresh token → 200 `already_verified`, consumed, no grant.
- `ResendVerificationView` (POST /api/auth/resend-verification/, AllowAny): invalidates pending verify tokens, issues new one, sends email; **always 200** (anti-enumeration); verified users skipped.
- Verification gate: `check_email_verified` in `apps/accounts/auth.py` — `CookieJWTAuthentication` rejects unverified users with 401 `email_not_verified` (cookie AND header paths); `validate_user_token`/`touch_activity` contracts untouched; refresh endpoint (no auth classes) still works for unverified users (tested).
- `send_verification_email(user_id)` implemented for real: renders `signup_confirm` via Next.js render endpoint with `{FRONTEND_PUBLIC_URL}/{locale}/verify-email/{token}`, sends `EmailMultiAlternatives` (HTML alternative + plain text) via Django email backend; graceful no-op (log) when user/token missing.
- Settings: `FRONTEND_PUBLIC_URL` + `EMAIL_*` env-driven in base.py (console backend default), locmem in test.py, eager Celery wiring (see Debug Log).
- **Deviation (recorded)**: `credit_ledger` row (`event_type='free_signup'`, `amount=15`, `pool='subscription'`) DEFERRED to story 4-1 per decided constraint — only `email_verified_at` + `credits_balance += 15`.
- **Deviation (recorded)**: post-verify redirects to a success screen (15-credit welcome banner, tabular-nums) with "Start Searching" CTA → `/search` (route is Epic 3 backlog); used-link screen's sign-in prompt links to `/login` (story 2.3 backlog).
- **Deviation (recorded)**: no auto-login after signup (sessions are story 2.3); email subject/template remain English (render endpoint accepts `locale` and it is passed through; templates are story-1.8 English-only — RTL handled by BaseEmail `dir="auto"`).
- Backend: 74 pytest tests green (46 prior + 28 new: 10 signup, 7 verify, 4 resend, 4 gate, 3 email task), ruff 0, mypy strict 0.
- Frontend: `/signup` page (2 fields + no-card note), `/verify-email` hard-gate with resend, `/verify-email/[token]` link handler (success/already/expired/used/error states), localized messages in en/fr/ar (329 keys parity), 19 new vitest tests (46 total green), lint + typecheck + check:i18n clean.

### File List

- `_bmad-output/implementation-artifacts/2-2-signup-free-credits.md` — NEW (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (2-2 → in-progress → review, last_updated)
- `backend/apps/accounts/models.py` — UPDATE (SingleUseToken + TOKEN_PURPOSE_CHOICES)
- `backend/apps/accounts/migrations/0002_alter_user_locale_alter_user_tier_singleusetoken.py` — GENERATED
- `backend/apps/accounts/serializers.py` — NEW (SignupSerializer)
- `backend/apps/accounts/tokens.py` — NEW (create_single_use_token, TOKEN_TTL)
- `backend/apps/accounts/exceptions.py` — NEW (custom_exception_handler adds `code`)
- `backend/apps/accounts/views.py` — UPDATE (SignupView, VerifyEmailView, ResendVerificationView, FREE_SIGNUP_CREDITS)
- `backend/apps/accounts/urls.py` — UPDATE (3 new paths)
- `backend/apps/accounts/auth.py` — UPDATE (check_email_verified + gate in CookieJWTAuthentication)
- `backend/apps/accounts/tests/test_signup.py` — NEW (10 tests)
- `backend/apps/accounts/tests/test_verify_email.py` — NEW (7 tests)
- `backend/apps/accounts/tests/test_resend.py` — NEW (4 tests)
- `backend/apps/accounts/tests/test_gate.py` — NEW (4 tests)
- `backend/apps/accounts/tests/test_auth.py` — UPDATE (_verify_user helper, 5 tests verify before protected calls)
- `backend/tasks/email_tasks.py` — UPDATE (send_verification_email implemented)
- `backend/tests/test_email_tasks.py` — UPDATE (3 new task tests)
- `backend/conftest.py` — UPDATE (autouse render_email patch, verified logged_in_client)
- `backend/config/settings/base.py` — UPDATE (FRONTEND_PUBLIC_URL, EMAIL_*, CELERY_TASK_ALWAYS_EAGER)
- `backend/config/settings/test.py` — UPDATE (locmem email, eager celery + cache+memory result backend)
- `frontend/src/app/[locale]/signup/page.tsx` — NEW
- `frontend/src/app/[locale]/verify-email/page.tsx` — NEW
- `frontend/src/app/[locale]/verify-email/[token]/page.tsx` — NEW
- `frontend/src/components/auth/SignupForm.tsx` — NEW
- `frontend/src/components/auth/VerifyEmailGate.tsx` — NEW
- `frontend/src/components/auth/VerifyLinkHandler.tsx` — NEW
- `frontend/src/__tests__/signup-form.test.tsx` — NEW (8 tests)
- `frontend/src/__tests__/verify-email-gate.test.tsx` — NEW (4 tests)
- `frontend/src/__tests__/verify-link-handler.test.tsx` — NEW (7 tests)
- `frontend/src/__tests__/email-render-route.test.ts` — UPDATE (NextRequest cast, pre-existing typecheck debt)
- `frontend/src/test/mocks.ts` — UPDATE (push/replace/useSearchParams mocks)
- `frontend/messages/en.json` — UPDATE (auth.signup + auth.verify keys)
- `frontend/messages/fr.json` — UPDATE (parallel keys)
- `frontend/messages/ar.json` — UPDATE (parallel keys)

## Change Log

- 2026-08-01: Story created (ready-for-dev) from epic 2.2 spec; validated against checklist.
- 2026-08-01: Implemented backend (TDD red→green) + frontend; 74 backend tests, 46 frontend tests; ruff/mypy/lint/typecheck/i18n clean; 2 commits (backend, frontend); status → review.

