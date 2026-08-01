---
story_id: 2.3
epic: 2
title: Story 2.3 — Login & Session Management
status: ready-for-dev
frs: [FR-22]
baseline_commit: c75f64a
---

# Story 2.3: Login & Session Management

Status: done

## Story

As a **registered user**,
I want **to log in with my email and password, stay logged in for up to 30 days, and log out securely**,
So that **I can access my account without repeatedly re-entering credentials**.

## Acceptance Criteria

1. **AC1: Login page** — the `/login` page shows a form with email and password fields, a "Forgot password?" link, and a "Don't have an account? Sign up" link.

2. **AC2: Login submission** — valid email + password via `POST /api/auth/login/` → server sets httpOnly JWT cookies (30-day inactivity expiry) → user is redirected to `/` (AC says `/search`, Epic 3 backlog — deviation recorded) → **no JWT is ever stored in localStorage**.

3. **AC3: Invalid credentials** — login failure shows localized "Invalid email or password" (`auth.login.error_invalid`); no session cookie set.

4. **AC4: Authenticated requests** — Django validates the JWT on every `/api/*` request and updates `last_active_at` (2.1 `CookieJWTAuthentication` + `touch_activity` — already done, DO NOT re-implement; verify via `/api/auth/me/`).

5. **AC5: Logout** — "Log out" in the Header → `POST /api/auth/logout/` clears httpOnly cookies → user is redirected to `/` as a guest; JWT immediately invalid.

6. **AC6: Session expiry** — inactive 30+ days → next authenticated request returns 401 `session_expired` → client redirects to `/login?reason=session_expired` with a "Session expired" message.

7. **AC7: Frozen account** — a user in the 7-day deletion grace lands on a frozen-account screen (recover action deferred to 2.6 — deviation recorded).

## Tasks / Subtasks

- [x] **Task 1: Session probe endpoint** (AC4, AC6, AC7)
  - [x] 1.1 `MeView` (APIView, NO `AllowAny` — global `IsAuthenticated` default applies) in `backend/apps/accounts/views.py` — GET `api/auth/me/` returns 200 `{email, locale, tier, credits_balance, email_verified_at}` (`email_verified_at` ISO string or `null`). Runs through `CookieJWTAuthentication` automatically: unverified → 401 `email_not_verified`; soft-deleted → 401 `account_deleted`; stale → 401 `session_expired`; no cookie → 401 `not_authenticated`
  - [x] 1.2 URL `me/` in `backend/apps/accounts/urls.py`
  - [x] 1.3 Tests `backend/apps/accounts/tests/test_me.py` (TDD-first — write red, confirm, then implement): (a) verified logged-in user → 200 + all 5 fields correct; (b) no cookie → 401 `not_authenticated`; (c) unverified logged-in user → 401 `email_not_verified`; (d) verified user + password change (`set_password` bumps `token_version`) → 401 `token_not_valid`; (e) verified user + `last_active_at` set 31 days back AFTER login → 401 `session_expired`; (f) verified user + `deletion_scheduled_at` set → 401 `account_deleted`

- [x] **Task 2: HTTP client layer (axios)** (AC4, AC6, AC7 — decided architecture)
  - [x] 2.1 Add `axios` (^1.x) to `frontend/package.json` (`npm.cmd install axios` — NOT `npm.ps1`)
  - [x] 2.2 `frontend/src/lib/api/http-client.ts` — NEW: base `HttpClient` class wrapping an axios instance (`baseURL: '/api'`, `withCredentials: true`, JSON headers); response interceptor maps 401 codes → client redirects (see 2.3); export pure helper `authRedirectFor(code: string): string | null` for unit tests
  - [x] 2.3 401 routing (lands here — deferred from 2.2 review): `email_not_verified` → `/verify-email`; `session_expired` → `/login?reason=session_expired`; `account_deleted` → `/frozen`; `token_not_valid` / `account_inactive` → `/login`; `not_authenticated` → `null` (guest — NO redirect, prevents probe loop). Redirect via `window.location.assign(path)` (full reload re-derives session); skip redirect when already on the target path
  - [x] 2.4 `frontend/src/lib/api/auth-service.ts` — NEW: `AuthService extends HttpClient`: `login(email, password)` → POST `/auth/login/`; `logout()` → POST `/auth/logout/`; `me()` → GET `/auth/me/` (typed `SessionUser`); `refresh()` → POST `/auth/jwt/refresh/`

- [x] **Task 3: Real session state — SessionProvider** (AC4, AC5, AC6)
  - [x] 3.1 Rework `frontend/src/components/providers/SessionProvider.tsx`: status `'loading' | 'authenticated' | 'guest'`, `user: SessionUser | null`, `isAuthenticated` derived; on mount `authService.me()` → authenticated+user / guest (401 `not_authenticated` or network error degrade to guest — NO loop, NO redirect for guests); expose `refresh()` (re-probe) and `logout()` (POST `/auth/logout/` ignoring errors — server is idempotent, then guest state + `router.push('/')`)
  - [x] 3.2 `frontend/src/components/layout/Header.tsx` — UPDATE: while `status === 'loading'` render only the LocaleSwitcher (no flash of wrong nav state); authed view gains a "Log out" button (`common.nav.logout` key — already exists in all locales) calling `useSession().logout()`; keep guest login/signup links and authed nav links as-is

- [x] **Task 4: Login page + form** (AC1, AC2, AC3, AC6)
  - [x] 4.1 `loginSchema` in `frontend/src/lib/validation/auth.ts` — email (same `emailRule` as signup) + password: required, max 128, `[...value].length >= 8` refine → `common.errors.invalid_password` (mirror backend: min 8 code points / max 128)
  - [x] 4.2 `frontend/src/components/auth/LoginForm.tsx` — NEW (client): RHF + `zodResolver(loginSchema)`; email (`autoComplete="email"`) + password (`autoComplete="current-password"`) fields; per-field errors with `aria-invalid` + `aria-describedby` (`login-email-error`, `login-password-error`); submit → `authService.login(...)` → on success `const s = await session.refresh(); if (s.isAuthenticated) router.push('/')` (push ONLY when the probe confirms the session — an unverified/deleted user gets 401 `email_not_verified`/`account_deleted` on the probe and the interceptor's `window.location.assign` owns navigation, preventing a redirect race; deviation: AC says `/search`); 400 → `setError('root', { message: 'auth.login.error_invalid' })`; network failure → `common.errors.network`; double-submit guard (`if (isSubmitting) return`); non-JSON 400 body guard; "Forgot password?" → `/password-reset` (404 until 2.4 — same precedent as 2.2's `/login` link); "Don't have an account? Sign up" → `/signup`; NEVER touches localStorage
  - [x] 4.3 Session-expired banner: read `useSearchParams().get('reason') === 'session_expired'` → show `auth.login.session_expired` in a `role="alert"` container above the form; `useSearchParams` requires the page to wrap the form in `<Suspense>` (Next 14)
  - [x] 4.4 `frontend/src/app/[locale]/login/page.tsx` — NEW (server component shell + metadata from `auth.login.*`, card layout mirroring `signup/page.tsx`, `<Suspense>` fallback from `common.states.loading`)

- [x] **Task 5: Frozen-account screen** (AC7)
  - [x] 5.1 `frontend/src/app/[locale]/frozen/page.tsx` — NEW (server component + metadata `auth.frozen.*`): frozen title, description (account frozen for 7 days, recoverable during grace, then permanently deleted), grace note, "Log out" action via `session.logout()` (clears the stuck cookies that keep 401-redirecting to `/frozen`), support note. NO recover button — `/api/settings/undelete/` is Epic 2.6 backend (deviation recorded)
  - [x] 5.2 No route guard needed server-side — the 401 interceptor is the only entry point (`account_deleted` → `/frozen`)

- [x] **Task 6: i18n keys in all three locales** (AC1, AC3, AC6, AC7)
  - [x] 6.1 `frontend/messages/en.json` — add `auth.login.session_expired` ("Your session has expired. Please log in again."), `auth.frozen.title/description/grace_note/logout/support_note`; `common.nav.logout` already exists
  - [x] 6.2 Mirror in `fr.json` + `ar.json` (Arabic for AR, French for FR) — `npm.cmd run check:i18n` must pass

- [x] **Task 7: Frontend tests (TDD-first)** (all ACs)
  - [x] 7.1 `frontend/src/__tests__/validation-auth.test.ts` — UPDATE: loginSchema cases (required email, invalid email, short password, emoji password = 8 code points passes, 128+ rejected)
  - [x] 7.2 `frontend/src/__tests__/login-form.test.tsx` — NEW (mock `@/lib/api/auth-service` module — NOT fetch): renders 2 fields + forgot/signup links; required/invalid/short errors with aria attributes (`waitFor`/`findBy*` — RHF async); 400 → `auth.login.error_invalid`; success → `session.refresh()` + `router.push('/')`; network error; double-submit; `reason=session_expired` banner renders
  - [x] 7.3 `frontend/src/__tests__/session-provider.test.tsx` — NEW: loading → authenticated (user populated); loading → guest on 401 `not_authenticated`; `logout()` POSTs `/auth/logout/` + flips guest + pushes `/`; `refresh()` re-probes
  - [x] 7.4 `frontend/src/__tests__/http-client.test.ts` — NEW: `authRedirectFor` mapping table (all 6 codes); already-on-path no-op guard

- [x] **Task 8: Verification gates + story sync**
  - [x] 8.1 Backend: `.\.venv\Scripts\python.exe -m pytest` (80 existing + new green), `.\.venv\Scripts\ruff.exe check .` 0 errors, `.\.venv\Scripts\mypy.exe .` strict 0 errors (from `backend/`)
  - [x] 8.2 Frontend: `npm.cmd run lint`, `npm.cmd run test` (60 existing + new green), `npm.cmd run typecheck`, `node scripts/check-i18n.mjs`
  - [x] 8.3 Story file updated: tasks checked, File List complete, deviations + completion notes; status → review (dev-story) → done (code-review)

## Dev Notes

### Decided constraints (confirmed with user)

- **HTTP client architecture (user decision)**: base `HttpClient` built on **axios** (add dependency — not currently installed) with a response interceptor for 401 code routing; `AuthService` **inherits** it (login/logout/me/refresh). Interceptor redirects: `email_not_verified` → `/verify-email`, `session_expired` → `/login?reason=session_expired`, `account_deleted` → `/frozen`, `token_not_valid`/`account_inactive` → `/login`, `not_authenticated` → no redirect (guest). This lands the 2.2-review deferral ("no client handling of 401 email_not_verified").
- **Post-login redirect (user decision)**: `/` (homepage) — works today, Header flips to authenticated nav live. AC says `/search` (Epic 3 backlog) → record as documented deviation.
- **Frozen screen (user decision)**: minimal `/frozen` page, `account_deleted` 401 routes there. Recover action DEFERRED to 2.6 (owns `/api/settings/undelete/` backend) — no dead buttons; Logout + support note instead.
- **Logout (user decision)**: SessionProvider exposes `logout()`; Header renders the button.
- **Refresh keep-minting for unverified users**: KEEP AS-IS (2.2 review item) — the verify-email gate needs a live session; `TokenRefreshView` keeps `authentication_classes=[]`. Do NOT add a verification check to refresh.
- **Session probe**: `GET /api/auth/me/` (authenticated) is the source of truth for client session state — httpOnly cookies are invisible to JS, so the client must probe.

### Existing patterns to follow (from stories 2.1/2.2)

- User model: `backend/apps/accounts/models.py` — email USERNAME_FIELD, `locale`/`tier`/`credits_balance`/`email_verified_at`/`last_active_at`/`deleted_at`/`deletion_scheduled_at`/`token_version`.
- Views: class-based `APIView` in `backend/apps/accounts/views.py`; global DRF default is `IsAuthenticated` — public endpoints declare `AllowAny` explicitly; **MeView must NOT declare `AllowAny`**.
- Auth: `backend/apps/accounts/auth.py` — `validate_user_token` (token_version/is_active/soft-delete/30-day inactivity), `touch_activity`, `check_email_verified`. Do NOT modify — 2.4 reuses them.
- Exception codes: `apps/accounts/exceptions.py` custom handler adds `code` to every APIException response; frontend maps machine codes, never English strings.
- Tests: pytest + pytest-django from `backend/` (`.\.venv\Scripts\python.exe -m pytest`); fixtures `api_client`, `user_data`, `create_user`, `logged_in_client` (marks verified) from `backend/conftest.py`; `_verify_user` helper pattern in `test_auth.py`. **TDD mandatory** (retro action item #8): write failing tests, confirm red, implement, confirm green.
- Frontend pages: server component shell with `generateMetadata` + `setRequestLocale` + `getTranslations` (see `signup/page.tsx`); client forms RHF+zod per AD-18 with schemas in `frontend/src/lib/validation/auth.ts`, full i18n keys as messages, unnamespaced `useTranslations()`.
- Vitest: `setup.ts` imports `mocks.ts` (next-intl returns keys, next/navigation stubs); jsdom; **existing tests stub `fetch` — this story's tests mock the `@/lib/api/auth-service` / `@/lib/api/http-client` modules instead (axios is module-mocked, never real)**.
- RHF+zod validation is ASYNC — vitest assertions need `waitFor`/`findBy*`.
- Design tokens: `px-gutter`, `max-w-content-max-marketing`, `rounded-lg border-border bg-card`, `text-title`, `text-small text-muted-foreground`, `text-destructive`; logical properties only (`ms-*`/`me-*`/`text-start`), NO `margin-left` etc.
- No code comments unless necessary; repo commit style `Story 2.3: ...` with author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push. One commit per logical unit (e.g., backend, frontend).
- Checkbox `- [x]` items stay unchecked until the dev story executes them — the story file's tasks above are the live checklist.

### Backend implementation notes

- `MeView` response: `{'email': user.email, 'locale': user.locale, 'tier': user.tier, 'credits_balance': user.credits_balance, 'email_verified_at': user.email_verified_at.isoformat() if user.email_verified_at else None}`.
- The gate already rejects unverified/deleted/stale users inside `CookieJWTAuthentication.authenticate` — MeView inherits this by simply using DRF auth; no extra checks in the view body.
- Login/logout/refresh views are 2.1's contract — DO NOT modify unless a review finding demands it.
- Test gotcha: `TokenCreateView` stamps `last_active_at = now` on login, so the `session_expired` test must set `last_active_at` 31 days back AFTER the login POST.

### Frontend implementation notes

- axios instance: `axios.create({ baseURL: '/api', withCredentials: true })`; interceptor reads `error.response?.status === 401` and `error.response?.data?.code` (string for AuthenticationFailed).
- `authRedirectFor` must be a pure exported function so the mapping is unit-testable without axios.
- Redirect via `window.location.assign(...)` (full reload — session re-derives; avoids router-in-interceptor coupling). Guard against redirecting to the current path.
- `SessionUser` type: `{ email: string; locale: string; tier: string; credits_balance: number; email_verified_at: string | null }` — export from `auth-service.ts`.
- SessionProvider `me()` failure policy: 401 `not_authenticated` → guest (silent); 401 with a redirect code → let the interceptor handle navigation (do NOT setState after); network error → guest (degrade gracefully, no loop, no error screen).
- LoginForm success: `await session.refresh()` (so the Header flips to authenticated immediately) then `router.push('/')`.
- Header `status === 'loading'` renders LocaleSwitcher only — no `isAuthenticated` flash.
- Vitest: `vi.mock('@/lib/api/auth-service')` returns a stub with `login/logout/me/refresh` as `vi.fn()`s; assert via `expect(sessionRefreshMock).toHaveBeenCalled()` style.

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`. `python3`/`uv` NOT available — use `python` for scripts, `.\.venv\Scripts\python.exe` for backend, `npm.cmd` (npm.ps1 blocked).
- Ruff line length 100; mypy strict needs annotations on every def; `# type: ignore` only when justified.
- Do not touch `/api/health/` (authenticated) or `/api/health/live/` (public); do not break `validate_user_token`/`touch_activity` contracts.
- zod is v3 (^3.25) — do NOT bump (v4 blocked on vitest stack, AD-18).
- `useSearchParams` in client components requires `<Suspense>` wrapper (Next 14 static rendering).
- axios ^1.x — verify vitest passes with it (CJS-compatible; no zod-v4-style ESM issue expected).
- mypy: `MeView` method annotations + return types must satisfy strict mode.

### Project Structure Notes

- Backend app layout: `backend/apps/accounts/{models,views,serializers,urls,admin,auth,exceptions,tokens}.py`.
- Frontend api layer is NEW: `frontend/src/lib/api/` (http-client.ts, auth-service.ts).
- No `/login` or `/frozen` page exists yet — create under `frontend/src/app/[locale]/`.
- `common.nav.logout` key already exists in all locales — reuse for the Header logout button.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-03-login-session-management.md] Story spec (7 AC groups)
- [Source: _bmad-output/implementation-artifacts/2-2-signup-free-credits.md] Completed 2.2 (form stack AD-18, exception codes, review deferrals incl. 401 `email_not_verified` → 2.3)
- [Source: _bmad-output/implementation-artifacts/2-1-django-auth-setup.md] Auth foundation (login/logout/refresh views, CookieJWTAuthentication, codes)
- [Source: docs/ARCHITECTURE-SPINE.md#L280-L284] AD-13 auth; #L313-L325 AD-18 form stack; #L134-L147 users schema; #L419-L451 API routes; #L329-L351 component tree (SessionProvider placement); #L680-L684 security (token_version, account deletion grace)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L35,L46-L48,L116,L158] Login IA, header chrome (logout), deletion-grace state row (frozen screen + recover action)
- [Source: backend/apps/accounts/views.py] Existing view patterns (TokenCreateView etc.)
- [Source: backend/apps/accounts/auth.py] validate_user_token/touch_activity/check_email_verified (contracts)
- [Source: backend/conftest.py, backend/apps/accounts/tests/test_auth.py] Fixtures + _verify_user pattern
- [Source: frontend/src/app/[locale]/signup/page.tsx, frontend/src/components/auth/SignupForm.tsx] Page + form patterns
- [Source: frontend/src/components/providers/SessionProvider.tsx] Stub to replace
- [Source: frontend/src/components/layout/Header.tsx] useSession consumer to extend
- [Source: frontend/src/lib/validation/auth.ts] Schema patterns (emailRule, code-point refine)
- [Source: frontend/src/test/mocks.ts, frontend/vitest.config.ts] Test setup
- [Source: frontend/messages/en.json] auth.login.* keys (exist), auth.password_reset.* (2.4), common.errors.*, common.nav.logout

## Review Findings

- [x] [Review][Patch] 30-day session dead on arrival: 60-min access token is never refreshed — `AuthService.refresh()` has zero call sites; users are hard-kicked to `/login` after ≤60 min; `session_expired` (30-day inactivity) is unreachable in production. Wire sliding-session refresh into the interceptor: on 401 `token_not_valid` (non-refresh request), single-flight `POST /api/auth/jwt/refresh/` once, replay the original request; only redirect when refresh itself fails (refresh errors flow through the existing code mapping — `session_expired`/`account_deleted`/`email_not_verified` become reachable) [frontend/src/lib/api/auth-service.ts:19, frontend/src/lib/api/http-client.ts:14]
- [x] [Review][Patch] LoginForm labels every response-bearing axios error as "Invalid email or password" — 429/5xx mislabeled, `auth.login.error_rate_limited` dead key; branch on status: 400 → `error_invalid`, 429 → `error_rate_limited`, other ≥500 → generic server error [frontend/src/components/auth/LoginForm.tsx:39]
- [x] [Review][Patch] SessionProvider probe swallows every failure as guest: silent post-login stall on network error (no redirect, no feedback); `refresh()` can return the stale in-flight mount probe (pre-login result); a probe resolving after `logout()` flips state back to authenticated. Fix: probe generation counter (ignore stale results), `refresh()` issues a fresh probe and returns tri-state `'authenticated' | 'guest' | 'error'`, LoginForm surfaces `common.errors.network` on `'error'` [frontend/src/components/providers/SessionProvider.tsx:44]
- [x] [Review][Patch] Interceptor never integration-tested (tests bypass it; provider tests reject with plain `Error`, not AxiosError). Add a real-axios custom-adapter test asserting: token_not_valid → refresh replay succeeds; refresh failure → `window.location.assign('/login')`; `session_expired` on refresh → `/login?reason=session_expired`; spy on `location.assign` in `applyAuthRedirect` tests [frontend/src/__tests__/http-client.test.ts]
- [x] [Review][Patch] `token_not_provided` 401 code unmapped (refresh path) — add to `authRedirectFor` → `/login` [frontend/src/lib/api/http-client.ts:6]
- [x] [Review][Patch] `/login` metadata `description` uses the `title` key; card lacks subtitle. Add `auth.login.subtitle` in all three locales, use for meta description + card (mirroring signup page) [frontend/src/app/[locale]/login/page.tsx:15]
- [x] [Review][Patch] Header logout has no in-flight guard and no test — disable while pending, add Header test asserting click calls `useSession().logout()` [frontend/src/components/layout/Header.tsx:33]

- [x] [Review][Defer] "7 days" grace hardcoded in frozen copy; backend has no shared grace constant [frontend/messages/en.json] — deferred: story 2.6 owns the deletion-grace flow (recover action + constant)
- [x] [Review][Defer] `SessionUser` cast blindly from `/api/auth/me/` response; a backend field change silently corrupts the Header [frontend/src/lib/api/auth-service.ts:22] — deferred: adopt zod response parsing (AD-18 pattern) in a later story touching session data
- [x] [Review][Defer] `/frozen` renders the guest header (Login/Sign up links) since the probe degrades to guest there [frontend/src/components/layout/Header.tsx:18] — deferred: story 2.6 refines the frozen surface

Dismissed as noise/handled: unverified → `/verify-email` 404 (pages exist from 2.2 — reviewer glob treated `[locale]` as a character class), axios 1.19.0 supply-chain claim (legitimate published release; `npm audit` flags only 13 pre-existing dev-toolchain vulns — vitest/vite/esbuild, eslint-config-next, hono/mcp — unrelated to axios; vitest upgrade blocked per AD-18), loginSchema min-8 at login (mission-mandated; every account-creation path enforces ≥8 server-side, so no legal short-password account exists), `applyAuthRedirect` localePrefix coupling (localePrefix is `'never'` by design — middleware 307s prefixed URLs, browser pathnames are always bare), `token_not_valid` → plain `/login` without reason (design: `session_expired` carries the reason param; refresh flow now covers the rest).

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- `resolve_customization.py` requires Python 3.11+ (tomllib) — machine venv is Python 3.10; manual fallback applied (no custom overrides exist; defaults from `customize.toml` used — verified `_bmad/custom/` holds only config.toml/config.user.toml).
- **Test design correction (backend)**: `test_me_returns_null_email_verified_at_when_unverified_field` was invalid by construction — `email_verified_at=None` IS the unverified state, so the gate 401s before the serializer can render null. Replaced with an ISO-format assertion on the verified path; the view keeps the `None` guard for type safety (mypy strict).
- **Vitest false-failure**: `redirectTargetForError` test passed plain objects to a function using `axios.isAxiosError` — plain objects are never AxiosErrors, so the full suite failed 1 test (isolated runs masked it). Fixed with real `new AxiosError(..., response)` construction typed as `AxiosResponse` (also satisfies tsc strict).
- **TS strict on test fixtures**: AxiosError 5th arg requires full `InternalAxiosRequestConfig` (incl. `headers`) — fixtures typed `as AxiosResponse` with `config: { headers: {} }`.
- The 3 prettier serializer errors in `email-render-route.test.ts` are the documented story-1.8 pre-existing noise (exit 0, present at baseline — verified via git stash).
- **Review-phase gotchas**: (a) jsdom's `window.location.assign` is non-configurable — `Object.defineProperty` spy throws "Cannot redefine property"; vitest module-mocks do NOT intercept a module's internal self-references; fixed with an exported `navigator.assign` seam patched via `vi.spyOn`. (b) A hand-built `AxiosError` must receive the request `config` as its 3rd constructor arg, or `error.config` is undefined and the interceptor misclassifies the refresh request → infinite refresh loop (test timeout). (c) PowerShell `Set-Content -NoNewline` on a `-replace`d line array collapsed the test file to one line (transform error) — rewrote the file instead.
- `npm audit`: 13 pre-existing dev-toolchain vulns (vitest/vite/esbuild, eslint-config-next/glob, hono/mcp) — unrelated to axios 1.19.0 (legitimate release, not flagged); vitest upgrade blocked per AD-18.

### Completion Notes List

- Backend: `MeView` (GET `/api/auth/me/`, authenticated — no `AllowAny`): returns `{email, locale, tier, credits_balance, email_verified_at}` (ISO or null); inherits all gate codes from `CookieJWTAuthentication` (email_not_verified / account_deleted / session_expired / token_not_valid / not_authenticated). URL `me/` added. 7 TDD tests in `test_me.py`. Login/logout/refresh views untouched (2.1 contract).
- Frontend HTTP layer (AD-19): axios ^1.19 added; `HttpClient` base class (baseURL `/api`, `withCredentials`, JSON header) with 401-code interceptor (`email_not_verified` → `/verify-email`, `session_expired` → `/login?reason=session_expired`, `account_deleted` → `/frozen`, `token_not_valid`/`account_inactive` → `/login`, `not_authenticated` → none); pure `authRedirectFor`/`redirectTargetForError`/`applyAuthRedirect` exported for unit tests; `AuthService extends HttpClient` (`login`/`logout`/`me`/`refresh`) + `SessionUser` type.
- SessionProvider: real session via `/api/auth/me/` probe (loading/authenticated/guest), in-flight probe dedup, `refresh()` re-probe, `logout()` (POST `/auth/logout/` error-tolerant → guest → `router.push('/')`); Header renders only LocaleSwitcher while loading, gains Logout button (`common.nav.logout`).
- Login: `/login` page (Suspense wrapper) + `LoginForm` (RHF + zodResolver(loginSchema)); per-field aria errors; 400 → `auth.login.error_invalid` (code-free — any 400 is invalid creds); network → `common.errors.network`; success → `refresh()` probe then `router.push('/')` only when authenticated (interceptor owns unverified/deleted redirects, no race); `reason=session_expired` banner in `role="alert"`; forgot-password → `/password-reset` (404 until 2.4), signup link; NO localStorage ever.
- Frozen screen: `/frozen` page + `FrozenLogout` (clears stuck cookies that keep 401-redirecting); recover action deferred to 2.6.
- i18n: `auth.login.session_expired` + `auth.frozen.*` (5 keys) in en/fr/ar — 335 keys parity.
- **Deviation (recorded)**: post-login redirects to `/` (homepage), not AC's `/search` (Epic 3 backlog) — user decision.
- **Deviation (recorded)**: frozen screen has Logout + support note, no recover action — `/api/settings/undelete/` is Epic 2.6 backend — user decision.
- **Deviation (recorded)**: refresh keeps minting tokens for unverified users (2.2 review deferral) — kept as-is per user decision; verify-email gate needs a live session.
- Backend: 87 pytest green (80 + 7), ruff 0, mypy strict 0. Frontend: 95 vitest green (60 + 35), lint 0, typecheck 0, check:i18n parity. Commits: `90a611c` (backend), `697a0e0` (frontend + AD-19).

### File List

- `_bmad-output/implementation-artifacts/2-3-login-session-management.md` — NEW (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (2-3 → ready-for-dev → in-progress → review, last_updated)
- `backend/apps/accounts/views.py` — UPDATE (MeView)
- `backend/apps/accounts/urls.py` — UPDATE (me/ path)
- `backend/apps/accounts/tests/test_me.py` — NEW (7 tests)
- `frontend/package.json` + `frontend/package-lock.json` — UPDATE (axios ^1.19.0)
- `frontend/src/lib/api/http-client.ts` — NEW (HttpClient base, 401 interceptor, authRedirectFor/redirectTargetForError/applyAuthRedirect)
- `frontend/src/lib/api/auth-service.ts` — NEW (AuthService extends HttpClient, SessionUser)
- `frontend/src/lib/validation/auth.ts` — UPDATE (loginSchema, LoginValues)
- `frontend/src/components/auth/LoginForm.tsx` — NEW
- `frontend/src/components/auth/FrozenLogout.tsx` — NEW
- `frontend/src/components/providers/SessionProvider.tsx` — UPDATE (real session state)
- `frontend/src/components/layout/Header.tsx` — UPDATE (loading state, logout button)
- `frontend/src/app/[locale]/login/page.tsx` — NEW
- `frontend/src/app/[locale]/frozen/page.tsx` — NEW
- `frontend/src/__tests__/http-client.test.ts` — NEW (11 tests)
- `frontend/src/__tests__/login-form.test.tsx` — NEW (11 tests)
- `frontend/src/__tests__/session-provider.test.tsx` — NEW (6 tests)
- `frontend/src/__tests__/validation-auth.test.ts` — UPDATE (7 loginSchema tests)
- `frontend/messages/en.json` — UPDATE (auth.login.session_expired, auth.frozen.*)
- `frontend/messages/fr.json` — UPDATE (parallel keys)
- `frontend/messages/ar.json` — UPDATE (parallel keys)
- `docs/ARCHITECTURE-SPINE.md` — UPDATE (AD-19 + AD Index row)

## Change Log

- 2026-08-01: Story created (ready-for-dev) from epic 2.3 spec; user decisions resolved (axios HttpClient + AuthService inheritance, post-login redirect `/`, minimal `/frozen` screen, SessionProvider-owned logout, keep refresh minting for unverified users); validated against checklist.
- 2026-08-01: Implemented (TDD): backend MeView + 7 tests (87 green); frontend axios client + 401 routing, SessionProvider, LoginForm, /login + /frozen pages, i18n, AD-19 (95 tests green); ruff/mypy/lint/typecheck/i18n clean; 2 commits (backend `90a611c`, frontend `697a0e0`); status → review.
- 2026-08-01: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor — 33 raw findings, 0 decision-needed, 7 patches applied, 3 deferred, 5 dismissed). Review patches: sliding-session refresh wired into the interceptor (single-flight + replay, AC2/AC6 reachable), LoginForm status branching (400/429/5xx/network), SessionProvider generation counter + tri-state refresh (stale-probe and logout races), real-axios adapter integration tests for the interceptor (incl. `token_not_provided` mapping), `auth.login.subtitle` key ×3 locales, Header logout guard + tests. `navigateTo` replaced by exported `navigator.assign` seam (jsdom location non-configurable). 104 frontend tests green, backend 87 untouched, ruff/mypy/lint/typecheck/i18n clean; commit `68ea19f`; status → done.
