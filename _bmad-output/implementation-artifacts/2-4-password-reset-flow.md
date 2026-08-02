---
story_id: 2.4
epic: 2
title: Story 2.4 — Password Reset Flow
status: review
frs: [FR-22]
baseline_commit: 4ec7db263cdc119e7a8478de9c5a106993653503
---

# Story 2.4: Password Reset Flow

Status: review

## Story

As a **user who forgot their password**,
I want **to request a password reset via email and set a new password using a secure, single-use link**,
So that **I can regain access to my account without losing data**.

## Acceptance Criteria

1. **AC1: Reset request page** — the `/password-reset` page shows a single email field and a "Send reset link" button.

2. **AC2: Reset request submission** — submitting the email makes the server send a password reset email containing a single-use link that expires after **1 hour**, and a confirmation message is shown: "If an account exists with this email, a reset link has been sent" (**always-200 anti-enumeration** — same response for existing and unknown emails).

3. **AC3: Valid link → new password** — clicking a valid reset link lands on a page with new-password + confirmation fields; submitting replaces the old password, increments `token_version` (invalidating all existing sessions — old cookies 401 on `/api/auth/me/`), shows "Password reset successfully — please log in", and the user is redirected to `/login`.

4. **AC4: Expired link** — clicking a reset link after 1h shows an "Link expired — request a new one" page with a link back to `/password-reset`.

5. **AC5: Used link** — clicking an already-used reset link shows a "Link already used" message and **no password change occurs**.

6. **AC6: Locale-aware email** — the reset email renders in the user's active locale with correct RTL support per Story 1.8 (trilingual template — user decision).

7. **AC7: Validation** — invalid email format and password < 8 characters (or confirmation mismatch) produce localized errors rendered with `aria-invalid` and `aria-describedby`; password requirements are stated adjacent to the field before submit (EXPERIENCE.md AA floor).

## Tasks / Subtasks

- [x] **Task 1: Token TTL parameter** (AC2, AC4)
  - [x] 1.1 `backend/apps/accounts/tokens.py` — `create_single_use_token(user, purpose='verify', ttl=TOKEN_TTL)`; add `RESET_TOKEN_TTL = timedelta(hours=1)`; keep `TOKEN_TTL = timedelta(hours=24)` as the default. Existing verify call sites (SignupView, ResendVerificationView) are unchanged (default 24h)
  - [x] 1.2 No model/migration changes — `SingleUseToken.purpose` already has `'reset'` in `TOKEN_PURPOSE_CHOICES` (verified)

- [x] **Task 2: Reset request endpoint** (AC2)
  - [x] 2.1 `PasswordResetRequestView` (APIView, `permission_classes=[AllowAny]`) in `backend/apps/accounts/views.py` — POST `api/auth/password-reset/` body `{email}`: **always returns 200** (mirror `ResendVerificationView` always-200 contract, including the non-dict body guard `isinstance(request.data, dict)`); for an EXISTING user where `deleted_at IS NULL` (guard `deletion_scheduled_at` too — soft-delete decision 6): invalidate pending `reset` tokens (`consumed_at=now`), create a fresh 1h `reset` token, `send_password_reset_email.delay(user.pk)`; verified status is IRRELEVANT (unverified users may also reset — unlike Resend which skips verified users, reset skips NOBODY except soft-deleted)
  - [x] 2.2 URL `api/auth/password-reset/` in `backend/apps/accounts/urls.py`

- [x] **Task 3: Reset confirm endpoint — GET validate + POST set** (AC3, AC4, AC5; decision 2)
  - [x] 3.1 `PasswordResetConfirmView` (APIView, `permission_classes=[AllowAny]`) GET `api/auth/password-reset/<str:token>/` — VALIDATES ONLY, does NOT consume: unknown token → 404 `token_not_found`; user `deleted_at`/`deletion_scheduled_at` → 404 `token_not_found`; `consumed_at` set → 410 `token_used`; `expires_at <= now` → 400 `token_expired`; else 200 (e.g. `code: 'token_valid'`). Structure mirrors `VerifyEmailView` (lock-free — read-only GET)
  - [x] 3.2 POST `api/auth/password-reset/<str:token>/` body `{password}` — same token lookups (404/410/400/soft-delete guards), then `with transaction.atomic():` + `select_for_update()` on token AND user rows (2.2 pattern); `validate_password(password, user=user)` via `django.contrib.auth.password_validation` (AUTH_PASSWORD_VALIDATORS — min 8, mirrors SignupSerializer) → 400 on violation; success: `user.set_password(password)` (bumps `token_version` — invalidates all sessions, AC3), `user.save()`, `entry.consumed_at = now`, `entry.save()`, return 200 `password_reset`; replay → 410 `token_used` (consumed before expiry check ordering per 2.2: consumed checked FIRST)
  - [x] 3.3 URL `api/auth/password-reset/<str:token>/` in `backend/apps/accounts/urls.py`

- [x] **Task 4: send_password_reset_email task** (AC2, AC6)
  - [x] 4.1 `backend/tasks/email_tasks.py` — `send_password_reset_email(user_id: int)` — copy `send_verification_email` structure exactly: deferred Django imports inside the function (celery.py imports this module pre-app-registry), `@shared_task(autoretry_for=(Exception,), retry_kwargs={'max_retries': 1}, retry_backoff=True)` (AD-14: 1 retry for email), fetch user (DoesNotExist → log + return), fetch latest pending `reset` token (`purpose='reset'`, `consumed_at__isnull=True`, `expires_at__gt=now`, order `-created_at`, `.first()`), None → log + return
  - [x] 4.2 Link format: `f'{settings.FRONTEND_PUBLIC_URL.rstrip("/")}/password-reset/{token.token}'` — **NO `{locale}` path segment** (2.2 review: localePrefix `'never'` 307s it away); `user.locale` still passed to the render endpoint
  - [x] 4.3 `render_email('password_reset', user.locale, {'resetLink': reset_link})` (task template name `password_reset`); **trilingual subject** by `user.locale` (ar/fr/en — decision 4: full trilingual template); `EmailMultiAlternatives` (subject, plain-text-or-html body, `DEFAULT_FROM_EMAIL`, `to=[user.email]`), `attach_alternative` when plain text exists, else `content_subtype = 'html'`; `message.send()`

- [x] **Task 5: Backend tests (TDD-first)** (all ACs)
  - [x] 5.1 `backend/apps/accounts/tests/test_password_reset.py` — NEW:
    - request 200 + email sent + fresh `reset` token (1h expiry) for existing user; pending old `reset` tokens invalidated (consumed_at set)
    - request 200 + NO outbox + NO tokens for unknown email (anti-enumeration)
    - request 200 + NO email for soft-deleted (`deleted_at`) and deletion-scheduled users
    - request 200 with non-dict body (`'[1,2]'` content_type json) — no crash (2.2 review pattern)
    - GET valid token → 200; token NOT consumed by GET (refresh-safe)
    - GET expired token → 400 `token_expired`; GET used token → 410 `token_used`; GET unknown token → 404 `token_not_found`; GET soft-deleted user token → 404
    - POST valid → 200 `password_reset`; `user.password` differs from old (check via `user.check_password(new)` + `check_password(old)` False); token consumed; `token_version` bumped
    - POST invalidates sessions: login BEFORE reset (cookies), reset via fresh token, then GET `/api/auth/me/` with old cookie → 401 `token_not_valid`
    - POST weak/short password → 400; replay POST → 410 `token_used`
  - [x] 5.2 `backend/tests/test_email_tasks.py` — extend: reset task sends with recipient + correct `password-reset/{token}` link (patch `render_email`, assert context), no-send when token missing/expired, no-send when user missing; trilingual subject selection (user.locale ar/fr/en)

- [x] **Task 6: Frontend API + validation** (AC1, AC3, AC7)
  - [x] 6.1 `frontend/src/lib/api/auth-service.ts` — `requestPasswordReset(email: string): Promise<void>` → POST `/auth/password-reset/`; `confirmPasswordReset(token: string, password: string): Promise<void>` → POST `/auth/password-reset/{token}/` (AD-19 inheritance; NO interceptor changes — these endpoints are AllowAny, never 401)
  - [x] 6.2 `frontend/src/lib/validation/auth.ts` — `passwordResetSchema` (email via shared `emailRule`); `newPasswordSchema` — `password` mirroring signup (min 1 required → max 128 → `[...value].length >= 8` refine → `common.errors.invalid_password`), `confirmPassword` string + `refine` on the OBJECT level `(data) => data.password === data.confirmPassword` → new `common.errors.password_mismatch` key; full i18n-key messages (AD-18); export inferred types

- [x] **Task 7: Reset request page + form** (AC1, AC2, AC7)
  - [x] 7.1 `frontend/src/app/[locale]/password-reset/page.tsx` — NEW server component shell: `generateMetadata` (`auth.password_reset.title`/`description`), `setRequestLocale`, card layout mirroring `login/page.tsx` (no Suspense needed unless `useSearchParams` is used — the request form does NOT need it)
  - [x] 7.2 `frontend/src/components/auth/PasswordResetForm.tsx` — NEW client: RHF + `zodResolver(passwordResetSchema)`; single email field (`autoComplete="email"`, visible label `auth.password_reset.email_label`, `aria-invalid` + `aria-describedby` with stable id `reset-email-error`); submit → `authService.requestPasswordReset(email)`; **always-200 → confirmation state** rendering `auth.password_reset.sent_confirmation` (anti-enumeration wording — the AC text) + link back to `/login`; network failure (non-axios error) → `common.errors.network` root error in `role="alert"`; double-submit guard (`if (isSubmitting) return`); NO "email not found" branch — server never reveals it

- [x] **Task 8: Reset confirm page + component** (AC3, AC4, AC5, AC7)
  - [x] 8.1 `frontend/src/app/[locale]/password-reset/[token]/page.tsx` — NEW server component: awaits `params` (`Promise<{ locale: string; token: string }>`), `setRequestLocale`, passes `token` to client component
  - [x] 8.2 `frontend/src/components/auth/PasswordResetConfirm.tsx` — NEW client (2.2 `VerifyLinkHandler` state-pattern): on mount GET `/auth/password-reset/{token}/` via `authService` (use `this.client.get` on AuthService — add a `validatePasswordResetToken(token)` service method returning `{code}` or use `client.get` directly through a service method; prefer a service method per AD-19); states `loading | valid | expired | used | invalid | error`; **410 must not overwrite a later success** (`setState((prev) => prev.kind === 'valid' && <post-success> ? prev : ...)` guard — see VerifyLinkHandler); `token_expired` (400) and `token_not_found` (404) → expired-or-invalid screen (`auth.password_reset.expired_title`/`expired_description`) with link to `/password-reset` (`auth.password_reset.request_new_link`); `token_used` (410) → used screen (`used_title`/`used_description`); valid → new-password form (RHF + `newPasswordSchema`): two password fields (`autoComplete="new-password"`), per-field `aria-invalid`/`aria-describedby` (`reset-new-password-error`, `reset-confirm-password-error`), password requirements note `auth.password_reset.password_requirements` adjacent to field; submit → `authService.confirmPasswordReset(token, values.password)` → success state (`auth.password_reset.reset_done`) + "Go to login" button → `router.push('/login?reason=password_reset')` (decision 3); 400/410 on POST → server-side error surface (`common.states.error` or remap: 410 → used screen); network error → `common.errors.network`
  - [x] 8.3 `frontend/src/components/auth/LoginForm.tsx` + `frontend/src/app/[locale]/login/page.tsx` — UPDATE: read `useSearchParams().get('reason') === 'password_reset'` → `role="alert"` banner `auth.login.password_reset` ("Password reset successfully — please log in") above the form (mirror the `session_expired` banner exactly; login page already wraps in `<Suspense>`)

- [x] **Task 9: Trilingual reset email + render route** (AC6, decision 4)
  - [x] 9.1 `frontend/emails/components/PasswordReset.tsx` — NEW: props `{ resetLink: string; locale?: 'ar' | 'fr' | 'en' }`; trilingual copy (title/body/button/ignore-note) selected by `locale` defaulting to `'en'`; `BaseEmail` wrapper (`dir="auto"` handles RTL, story 1.8); `<Link href={resetLink}>` styled like `SignupConfirm`; copy strings as const objects in the component (no i18n dependency — emails are standalone)
  - [x] 9.2 `frontend/src/app/api/emails/render/route.ts` — UPDATE: destructure `locale` from the request body (currently ignored); pass it to the component props (`render(Component({ ...(context as Record<string, unknown>), locale }))`); register `password_reset: PasswordReset` in the `TEMPLATES` map. Existing templates are locale-agnostic — passing an extra `locale` prop is harmless (props are `any`-cast)
  - [x] 9.3 `frontend/src/__tests__/email-render-route.test.ts` — UPDATE: new template renders; locale flows into props (render `password_reset` and assert link present; unknown template still 400)

- [x] **Task 10: i18n keys in all three locales** (all ACs)
  - [x] 10.1 `frontend/messages/en.json` — extend `auth.password_reset` (+ existing 11 keys: title, description, email_label, email_placeholder, submit, success, new_password_title, new_password_label, confirm_password_label, submit_new, error_token_invalid): `sent_confirmation` (anti-enumeration: "If an account exists with this email, a reset link has been sent."), `expired_title` / `expired_description` / `request_new_link`, `used_title` / `used_description`, `password_requirements` (note adjacent to field, AA floor), `reset_done` (confirm-page success), `go_to_login` (CTA); add `auth.login.password_reset` ("Password reset successfully — please log in") for the login banner; add `common.errors.password_mismatch` ("Passwords do not match")
  - [x] 10.2 Mirror in `fr.json` + `ar.json` (Arabic for AR, French for FR) — `npm.cmd run check:i18n` must pass (en is the source of truth)

- [x] **Task 11: Frontend tests (TDD-first)** (all ACs)
  - [x] 11.1 `frontend/src/__tests__/password-reset-form.test.tsx` — NEW (mock `@/lib/api/auth-service` — NOT fetch): renders single email field + submit; required/invalid email errors with aria (`waitFor`/`findBy*` — RHF async); submit calls `requestPasswordReset(email)`; success → confirmation state with anti-enumeration text + login link; network error → `common.errors.network`; double-submit guard
  - [x] 11.2 `frontend/src/__tests__/password-reset-confirm.test.tsx` — NEW (mock `@/lib/api/auth-service`): valid token → new-password form renders (2 fields, requirements note); short password → `common.errors.invalid_password` with aria; mismatch → `common.errors.password_mismatch`; submit calls `confirmPasswordReset(token, password)`; success → `reset_done` + "Go to login" → `router.push('/login?reason=password_reset')`; expired (400) → expired screen + request-new-link; used (410) → used screen; unknown (404) → expired-or-invalid; network error on GET → error state; 410 arriving after a success must NOT overwrite (replay-guard test)
  - [x] 11.3 `frontend/src/__tests__/validation-auth.test.ts` — UPDATE: `passwordResetSchema` (required/invalid email) + `newPasswordSchema` (required, 7 code points rejected, 8 emoji accepted, 129 rejected, mismatch rejected)
  - [x] 11.4 `frontend/src/__tests__/login-form.test.tsx` — UPDATE: `reason=password_reset` renders the reset-success banner

- [x] **Task 12: Verification gates + story sync**
  - [x] 12.1 Backend: `.\.venv\Scripts\python.exe -m pytest` (87 existing + new green), `.\.venv\Scripts\ruff.exe check .` 0 errors, `.\.venv\Scripts\mypy.exe .` strict 0 errors (from `backend/`)
  - [x] 12.2 Frontend: `npm.cmd run lint`, `npm.cmd run test` (104 existing + new green), `npm.cmd run typecheck`, `node scripts/check-i18n.mjs`
  - [x] 12.3 Story file updated: tasks checked, File List complete, deviations + completion notes; status → review (dev-story) → done (code-review)

## Dev Notes

### Decided constraints (confirmed with user)

- **Reset TTL (user decision)**: `create_single_use_token` gains a `ttl: timedelta` parameter (default `TOKEN_TTL` = 24h); the reset flow passes `RESET_TOKEN_TTL = timedelta(hours=1)`. Explicit at call sites — no implicit purpose→TTL map.
- **Endpoint shape (user decision)**: validate-first — `GET /api/auth/password-reset/<token>/` validates WITHOUT consuming (client renders expired/used screens before showing the form; page refreshes stay safe), then `POST /api/auth/password-reset/<token>/` with `{password}` consumes + sets. NOT djoser's `password-reset/confirm/` (djoser reset endpoints are NOT mounted — verified in 2.1 review; record as deviation vs the AD-13 API table).
- **Post-reset redirect (user decision)**: confirm success shows `reset_done` + "Go to login" button → `/login?reason=password_reset`; `LoginForm` renders a `role="alert"` banner `auth.login.password_reset` (reuses 2.3's `session_expired` banner pattern). The AC success string lives on the login page so it survives the redirect.
- **Trilingual email (user decision — OVERRIDES the 2.2 English-only precedent)**: `PasswordReset.tsx` carries ar/fr/en copy selected by the `locale` prop; the render route must now pass `locale` (previously ignored) into component props; the Celery task localizes the subject line. RTL via `BaseEmail dir="auto"`. Record as deviation vs 2.2's documented English-only approach (this story deliberately lands the trilingual email pattern).
- **Anti-enumeration (user decision)**: request endpoint ALWAYS returns 200 with the "If an account exists..." message — mirrors `ResendVerificationView`; unknown emails get no email, no token, no distinguishable response.
- **Soft-delete guard (user decision)**: reset GET/POST return 404 `token_not_found` for `deleted_at`/`deletion_scheduled_at` users; the request endpoint never emails them (2.2 verify/resend guard parity).
- **Session invalidation comes free**: `User.set_password` already bumps `token_version` (models.py) — old JWT cookies 401 `token_not_valid` after a reset. Verify via a pre-reset cookie hitting `/api/auth/me/`.
- **NO changes** to login/logout/refresh/me views (2.1/2.3 contracts), `validate_user_token`/`touch_activity`, `/api/health/` or `/api/health/live/`.
- **AD-20 is PLANNED for Epic 3** — do NOT add TanStack Query in 2.4.

### Existing patterns to follow (from stories 2.1/2.2/2.3)

- Views: class-based `APIView` in `backend/apps/accounts/views.py`; global DRF default `IsAuthenticated` — every public endpoint declares `permission_classes = [permissions.AllowAny]` explicitly.
- Token flow: `apps/accounts/tokens.py` `create_single_use_token`; `VerifyEmailView` GET is the template (lookup `SingleUseToken.objects.get(token=..., purpose=...)` → DoesNotExist → 404; then `transaction.atomic()` + `select_for_update()`; consumed checked BEFORE expired (2.2 review ordering); soft-delete → 404).
- Always-200 anti-enumeration: `ResendVerificationView` (non-dict body guard: `isinstance(request.data, dict)`; `email.lower().strip()`).
- Exception codes: custom handler in `apps/accounts/exceptions.py` adds `code` to every APIException response — but the 2.2/2.4 views return plain `Response({'detail': ..., 'code': ...}, status=...)` (manual codes: `token_not_found`/`token_used`/`token_expired`); frontend maps machine codes, never English strings.
- Email task: `backend/tasks/email_tasks.py` `send_verification_email` is the exact template (deferred imports, AD-14 retry decorator, latest-pending-token query, `rstrip('/')` link, `EmailMultiAlternatives`). `render_email(template, locale, context)` POSTs to the Next render endpoint (autouse-conftest fixture patches it in tests).
- Backend tests: pytest + pytest-django from `backend/` (`.\.venv\Scripts\python.exe -m pytest`); fixtures `api_client`, `user_data`, `create_user` from `backend/conftest.py`; `mail.outbox` (locmem backend); `CELERY_TASK_ALWAYS_EAGER` wired in base.py/test.py. **TDD mandatory** (retro action item #8): write failing tests first, confirm red, implement, confirm green.
- Frontend pages: server component shells with `generateMetadata` + `setRequestLocale` (see `login/page.tsx`); client forms RHF+zod per AD-18, schemas in `frontend/src/lib/validation/auth.ts`, full i18n keys as messages, unnamespaced `useTranslations()`.
- Vitest: `setup.ts` imports `mocks.ts` (next-intl returns keys; next/navigation stubs); **mock the `@/lib/api/auth-service` module (`vi.mock('@/lib/api/auth-service')`) — never fetch** (axios is module-mocked, never real). RHF+zod validation is ASYNC — `waitFor`/`findBy*`.
- 410-guard: `VerifyLinkHandler` state pattern — a later 410 must not overwrite a success state (`setState((prev) => prev.kind === success ? prev : {used})`).
- Design tokens: `px-gutter`, `max-w-content-max-marketing`, `rounded-lg border-border bg-card`, `text-title`, `text-small text-muted-foreground`, `text-destructive`, `aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30`; logical properties only (`ms-*`/`me-*`/`text-start`), NO `margin-left` etc.
- No code comments unless necessary; repo commit style `Story 2.4: ...` with author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push. One commit per logical unit (backend, frontend).
- Checkbox `- [x]` items stay unchecked until the dev story executes them — tasks above are the live checklist.

### Backend implementation notes

- `tokens.py` current state: `create_single_use_token(user: Any, purpose: str = 'verify')` hardcodes `expires_at=timezone.now() + TOKEN_TTL`. Add `ttl: timedelta = TOKEN_TTL` param; `expires_at=timezone.now() + ttl`.
- `PasswordResetRequestView` body guard + flow (pseudo):
  `email = str(request.data.get('email') or '').lower().strip()` inside `isinstance(request.data, dict)`; `user = User.objects.filter(email=email, deleted_at__isnull=True).first()`; if user: `SingleUseToken.objects.filter(user=user, purpose='reset', consumed_at__isnull=True).update(consumed_at=now)`; `create_single_use_token(user, purpose='reset', ttl=RESET_TOKEN_TTL)`; `send_password_reset_email.delay(user.pk)`. Always 200 with the AC confirmation text. NOTE: unlike `ResendVerificationView`, do NOT skip verified users — a verified user can forget their password too.
- `PasswordResetConfirmView`: one shared `_resolve_reset_token(token)` helper or inline duplicated lookups (2.2 style) — GET validates, POST validates then mutates. Soft-delete check needs the user row: `User.objects.get(pk=entry.user_id)` inside the transaction for POST (`select_for_update`), plain get for GET. POST: `validate_password(password, user=user)` raises `django.core.exceptions.ValidationError` → catch → 400 `{password: [...]}` (DRF `serializers.ValidationError` style — mirror SignupSerializer's field-error shape so the client maps codes). Password field guards: string + max 128 (PBKDF2 DoS guard, 2.2 review) — apply BEFORE validate_password. `user.set_password(password)`; `user.save()`; `entry.consumed_at = timezone.now()`; `entry.save(update_fields=['consumed_at'])`.
- URLs: order matters — `password-reset/` before `password-reset/<str:token>/` is NOT required in Django (exact vs converter paths don't collide) but keep both defined in `urls.py`.
- `send_password_reset_email` subject by locale:
  - `ar`: 'إعادة تعيين كلمة المرور — dzLeadsFinder'
  - `fr`: 'Réinitialisation de votre mot de passe — dzLeadsFinder'
  - `en`: 'Reset your password — dzLeadsFinder'
  (default en for unexpected locales)

### Frontend implementation notes

- `auth-service.ts`: keep `AuthService extends HttpClient`; add three methods: `requestPasswordReset(email)`, `confirmPasswordReset(token, password)`, and `validatePasswordResetToken(token)` (GET → typed `{ code?: string }`; the confirm component uses it on mount). All three endpoints are AllowAny — the 401 interceptor never fires for them.
- `newPasswordSchema` object-level refine for the confirm match (zod): `z.object({ password: ..., confirmPassword: ... }).refine((d) => d.password === d.confirmPassword, { message: 'common.errors.password_mismatch', path: ['confirmPassword'] })`.
- `PasswordResetForm` confirmation state replaces the form after submit (like VerifyEmailGate's resend success): show `sent_confirmation` in `role="status"` + a `Link` to `/login` (`common.nav.login`). Anti-enumeration wording IS the AC text.
- `PasswordResetConfirm` on-mount GET: reuse `validatePasswordResetToken(token)`; map `400 token_expired` AND `404 token_not_found` → `expired` screen; `410` → `used` (with the 410-after-success guard); network error → `error`. On valid → render form. POST success → `reset_done` state; replace the form area, show `reset_done` + Button → `router.push('/login?reason=password_reset')`. POST 410 (race: two tabs) → flip to `used` only if not already in a success-ish state.
- Login banner: `const resetDone = searchParams.get('reason') === 'password_reset'` alongside `sessionExpired`; same `<p role="alert" ...>` styling.
- Email render route: `const { template, locale, context } = ...`; `const props = { ...(context as Record<string, unknown>), locale }`; `render(Component(props as any), ...)` — existing templates ignore the extra prop (already `any`-cast).
- Vitest for the confirm component: mock `authServiceMock.validatePasswordResetToken` (resolves `{ code: 'token_valid' }`), `confirmPasswordReset`. The `router.push` assertion: `/login?reason=password_reset`.

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`. `python3`/`uv` NOT available — use `python` for scripts, `.\.venv\Scripts\python.exe` for backend, `npm.cmd` (npm.ps1 blocked by execution policy).
- Ruff line length 100; mypy strict needs annotations on every def; `# type: ignore` only when justified.
- Do not touch `/api/health/` (authenticated) or `/api/health/live/` (public); do not break `validate_user_token`/`touch_activity` contracts.
- zod is v3 (^3.25) — do NOT bump (v4 blocked on the vitest stack, AD-18).
- `useSearchParams` in client components requires `<Suspense>` wrapper (Next 14 static rendering) — only the LOGIN page change needs it (Suspense already present there); the password-reset pages do NOT use search params.
- The reset link in the email must NOT carry a `{locale}` path segment (2.2 review: localePrefix `'never'` 307s it away) — `{FRONTEND_PUBLIC_URL}/password-reset/{token}`; pass `user.locale` to the render endpoint only.
- `SingleUseToken` query in the email task must match ONLY `purpose='reset'` — a `verify` token must never be sent as a reset link.
- requirements.txt needs NO new dependency (djoser's reset endpoints are not available — custom views).
- Backend test gotcha: `logged_in_client` fixture marks users verified — NOT needed for reset tests (reset endpoints are AllowAny); use `api_client` + `create_user`.

### Project Structure Notes

- Backend app layout: `backend/apps/accounts/{models,views,serializers,urls,admin,auth,exceptions,tokens}.py`; tasks in `backend/tasks/email_tasks.py`.
- Frontend: new files under `frontend/src/app/[locale]/password-reset/` (two pages: `page.tsx` + `[token]/page.tsx`), `frontend/src/components/auth/PasswordResetForm.tsx` + `PasswordResetConfirm.tsx`, `frontend/emails/components/PasswordReset.tsx`.
- Email templates live in `frontend/emails/components/` (NOT `src/emails`); render route at `frontend/src/app/api/emails/render/route.ts` (TEMPLATES map to extend).
- No `/password-reset` page exists yet — LoginForm's "Forgot password?" link currently 404s there; this story lands it.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-04-password-reset-flow.md] Story spec (7 AC groups)
- [Source: _bmad-output/implementation-artifacts/2-3-login-session-management.md] Completed 2.3 (axios HttpClient + AuthService pattern, 401 routing, session_expired banner pattern, review conventions incl. deferred items)
- [Source: _bmad-output/implementation-artifacts/2-2-signup-free-credits.md] Completed 2.2 (SingleUseToken model, VerifyEmailView/ResendVerificationView patterns, send_verification_email task, exception codes, AD-18 form stack, review findings: consumed-vs-expired ordering, soft-delete guards, always-200 contract, locale-less email link, validate_password/max-128)
- [Source: docs/ARCHITECTURE-SPINE.md#L134-L147] users schema; #L280-L284 AD-13 auth (token_version on password change); #L313-L325 AD-18 form stack; #L329-L334 AD-19 HTTP client; #L441-L446 API table (djoser reset endpoints NOT available — deviation); #L762-L813 Email system
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L38,L184] Password-reset IA (`/password-reset` via email link, FR-22); forms AA floor (visible labels, autocomplete tokens, inline per-field errors, password requirements adjacent to field)
- [Source: backend/apps/accounts/views.py] VerifyEmailView / ResendVerificationView / SignupView patterns
- [Source: backend/apps/accounts/tokens.py] create_single_use_token (TTL to parameterize)
- [Source: backend/tasks/email_tasks.py] send_verification_email (task template)
- [Source: backend/apps/accounts/models.py] User.set_password token_version bump; SingleUseToken purpose choices (reset exists)
- [Source: backend/conftest.py] Fixtures + autouse render_email patch
- [Source: frontend/src/lib/api/auth-service.ts, http-client.ts] AD-19 service patterns
- [Source: frontend/src/lib/validation/auth.ts] Schema patterns (emailRule, code-point refine)
- [Source: frontend/src/components/auth/LoginForm.tsx] Banner pattern, RHF form pattern
- [Source: frontend/src/components/auth/VerifyLinkHandler.tsx] State-machine + 410-guard pattern
- [Source: frontend/src/app/[locale]/login/page.tsx] Page shell pattern (Suspense)
- [Source: frontend/src/app/api/emails/render/route.ts, frontend/emails/components/SignupConfirm.tsx] Email template + render map
- [Source: frontend/src/__tests__/login-form.test.tsx, validation-auth.test.ts, verify-link-handler.test.tsx] Test patterns (module mocks, async RHF)

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **mypy narrowing trap**: `_get_token_entry` annotated `SingleUseToken | None` exposed the ORM's `Any` returns (`no-any-return`) AND the reassignment `entry = ...select_for_update().get(...)` lost the None-narrowing inside the `with` block (2.2's VerifyEmailView compiled only because everything was `Any`). Fixed with the repo's `cast` pattern (`tokens.py` precedent) + a fresh `locked_entry` variable in the POST.
- **`save(update_fields=...)` would drop the token_version bump**: `User.set_password` mutates `token_version` in memory; `save(update_fields=['password'])` skips it → sessions would NOT be invalidated. Fixed by including `'token_version'` in update_fields (covered by the `/api/auth/me/` 401 test).
- **Email render-route latent 1.8 bug (significant)**: `@react-email/render` v2.1.0's `render()` is **async** (`Promise<string>`); the route never awaited it, so `NextResponse.json({html, plainText})` serialized promises as `{}` — every email (signup_confirm, payment_receipt, pack_receipt, low_credit) rendered as empty objects in production. The "prettier serializer errors" documented as story-1.8 noise in 2.2/2.3 existed ONLY because render was never awaited. Fixed in 2.4: `await render(...)`; dropped `{pretty: true}` (prettier's HTML parse crashes on the story-1.8 nested-`<p>` in PaymentReceipt/LowCredit — formatting-only option, output equivalent). Now: 129 tests green with zero unhandled errors; the signup-verification email path is fixed for real.
- Subject assertion test bug: fixture user locale is `'ar'` by default → the first reset-task subject test failed asserting English text; set `locale='en'` in the test (and asserted the Arabic-localized subject in the locale test).
- `npx` blocked by execution policy — `npm.cmd exec vitest ...` used for one-off debug runs.

### Completion Notes List

- Backend: `create_single_use_token(user, purpose, ttl=TOKEN_TTL)` — new `RESET_TOKEN_TTL = timedelta(hours=1)`; verify call sites unchanged (24h default).
- `PasswordResetRequestView` (POST `/api/auth/password-reset/`, AllowAny): always-200 anti-enumeration (mirrors ResendVerificationView incl. non-dict body guard); existing non-deleted users only → invalidate pending `reset` tokens, fresh 1h token, `send_password_reset_email.delay(user.pk)`; unverified users included (reset ≠ resend).
- `PasswordResetConfirmView` (AllowAny): GET `/api/auth/password-reset/<token>/` validates WITHOUT consuming (200 `token_valid` / 400 `token_expired` / 410 `token_used` / 404 `token_not_found`, soft-deleted → 404); POST re-validates under `transaction.atomic` + `select_for_update`, `validate_password` (min 8, max 128 guard), `set_password` + `save(update_fields=['password', 'token_version'])` (session invalidation, AC3), consumes token, 200 `password_reset`; replay → 410.
- `send_password_reset_email(user_id)`: copy of the verify task (deferred imports, AD-14 1-retry, latest pending `reset` token, locale-less link `{FRONTEND_PUBLIC_URL}/password-reset/{token}`, `password_reset` template with `{resetLink}`, trilingual subject by `user.locale`).
- Backend: 113 tests green (87 + 26: 20 `test_password_reset.py` + 6 reset-task tests), ruff 0, mypy strict 0. Commit `b7ba206`.
- Frontend: `AuthService` + `requestPasswordReset` / `validatePasswordResetToken` / `confirmPasswordReset` (AD-19, no interceptor changes); `passwordResetSchema` + `newPasswordSchema` (code-point min 8, max 128, confirm refine → `common.errors.password_mismatch`).
- `/password-reset` page + `PasswordResetForm` (single email field, AC1; always-200 → `sent_confirmation` anti-enumeration state + login link; network error root; double-submit guard).
- `/password-reset/[token]` page + `PasswordResetConfirm` (on-mount GET validate; valid → new-password+confirm form with requirement note + per-field aria; success → `reset_done` + Go-to-login → `/login?reason=password_reset`; expired/404 → expired screen with request-new-link; used → used screen; 410-after-success guard on both GET and POST paths; network → error).
- `LoginForm` `reason=password_reset` banner (`auth.login.password_reset` — "Password reset successfully — please log in", AC3).
- **Trilingual email (user decision, deviation from 2.2's English-only)**: `PasswordReset.tsx` with ar/fr/en copy + `lang`/`dir` per locale; render route now passes `locale` into template props and registers `password_reset`; Celery task localizes the subject.
- **Latent 1.8 bug fixed**: render route `await render(...)` (emails were `{}`); dropped `pretty` (1.8 nested-`<p>` prettier crash — the previously "documented noise").
- i18n: +11 keys ×3 locales (`auth.password_reset.*` ×9, `auth.login.password_reset`, `common.errors.password_mismatch`) — check:i18n parity green (347 keys).
- Frontend: 129 tests green (104 + 25: 6 form, 8 confirm, 8 schema, 2 login banner, 1 render route), lint 0, typecheck 0. Commit `0cc2b12`.

### File List

- `_bmad-output/implementation-artifacts/2-4-password-reset-flow.md` — NEW (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (2-4 → ready-for-dev → in-progress → review, last_updated)
- `backend/apps/accounts/tokens.py` — UPDATE (ttl param, RESET_TOKEN_TTL)
- `backend/apps/accounts/views.py` — UPDATE (PasswordResetRequestView, PasswordResetConfirmView)
- `backend/apps/accounts/urls.py` — UPDATE (2 new paths)
- `backend/apps/accounts/tests/test_password_reset.py` — NEW (20 tests)
- `backend/tasks/email_tasks.py` — UPDATE (send_password_reset_email + RESET_SUBJECTS)
- `backend/tests/test_email_tasks.py` — UPDATE (6 reset-task tests)
- `frontend/src/lib/api/auth-service.ts` — UPDATE (3 reset methods)
- `frontend/src/lib/validation/auth.ts` — UPDATE (passwordResetSchema, newPasswordSchema)
- `frontend/src/app/[locale]/password-reset/page.tsx` — NEW
- `frontend/src/app/[locale]/password-reset/[token]/page.tsx` — NEW
- `frontend/src/components/auth/PasswordResetForm.tsx` — NEW
- `frontend/src/components/auth/PasswordResetConfirm.tsx` — NEW
- `frontend/src/components/auth/LoginForm.tsx` — UPDATE (reason=password_reset banner)
- `frontend/emails/components/PasswordReset.tsx` — NEW (trilingual)
- `frontend/src/app/api/emails/render/route.ts` — UPDATE (locale pass-through, password_reset template, await render)
- `frontend/src/__tests__/password-reset-form.test.tsx` — NEW (6 tests)
- `frontend/src/__tests__/password-reset-confirm.test.tsx` — NEW (8 tests)
- `frontend/src/__tests__/validation-auth.test.ts` — UPDATE (8 schema tests)
- `frontend/src/__tests__/login-form.test.tsx` — UPDATE (2 banner tests)
- `frontend/src/__tests__/email-render-route.test.ts` — UPDATE (1 template test)
- `frontend/messages/en.json` — UPDATE (password_reset + login.password_reset + errors.password_mismatch)
- `frontend/messages/fr.json` — UPDATE (parallel keys)
- `frontend/messages/ar.json` — UPDATE (parallel keys)

## Change Log

- 2026-08-02: Story created (ready-for-dev) from epic 2.4 spec; user decisions resolved (TTL parameter, GET-validate+POST-set endpoints, `/login?reason=password_reset` + login banner, full trilingual reset email, always-200 anti-enumeration, soft-delete guard); validated against checklist.
- 2026-08-02: Implemented (TDD): backend reset views + task + 26 tests (113 green, commit `b7ba206`); frontend pages/forms/service/schemas/trilingual email + i18n + 25 tests (129 green, commit `0cc2b12`); fixed latent 1.8 render-route bug (`render()` async, emails were `{}`); ruff/mypy/lint/typecheck/i18n clean; status → review.
