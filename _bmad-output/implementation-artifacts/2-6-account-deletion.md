---
story_id: 2.6
epic: 2
title: Story 2.6 — Account Deletion
status: done
frs: [FR-23]
ads: [AD-13]
ux_drs: [UX-DR19, UX-DR20, UX-DR21, UX-DR23]
---

# Story 2.6: Account Deletion

Status: ready-for-dev

## Story

As a **user who wants to leave DZLeads**,
I want **to delete my account with a clear multi-step confirmation, a 7-day grace period during which I can recover it, and full deletion after that**,
So that **I can exercise my data rights under Loi 18-07 without contacting support**.

## Acceptance Criteria

**AC1 — Settings Danger Zone.** Given the `/settings` page, when an authenticated user views it, then there is a "Delete account" section (Danger Zone), and clicking it triggers a multi-step destructive confirmation flow.

**AC2 — First confirmation step.** Given the first confirmation step, when the user clicks "Delete account", then a dialog states:
- "Your account will be frozen and recoverable for 7 days"
- "After 7 days, deletion is permanent and irreversible"
- "Unrevealed credit balance will be removed"
- "Anonymised ledger rows retained for 90 days (tax records)"
and there are two buttons: "Cancel" and "I understand — delete my account".

**AC3 — Confirmation.** Given the user confirms deletion, when they confirm, then `deleted_at` is set to now, `deletion_scheduled_at` is set to now + 7 days, the user is logged out immediately, and their account is frozen: login returns a frozen-account screen.

**AC4 — Grace period.** Given the 7-day grace period, when an account is in the grace period, then logging in shows a frozen-account screen with:
- "Your account deletion is scheduled for {date}"
- "You can recover your account within {n} days"
- A "Recover account" button
and clicking "Recover account" calls `POST /api/settings/undelete/`, sets `deleted_at = NULL`, `deletion_scheduled_at = NULL`, and restores full access.

**AC5 — Expiry.** Given the 7-day grace period expires, when Celery cron runs `hard_delete_expired`, then the user's personal data is hard-deleted, `email` is removed (not just nulled — no PII retained), `credit_ledger` rows are anonymised (user_id removed, amounts kept for 90 days), and reveals, exports, searches, saved_searches, subscriptions, payment_transactions are hard-deleted.

**AC6 — Privacy policy.** Given the privacy policy, when a user reads `/privacy`, then it documents the deletion process, the 7-day grace, and the data-subject request process, and commits to a 30-day response window for data-subject requests.

## Tasks / Subtasks

- [ ] **Task 1: Backend — `POST /api/settings/delete/`** (AC3)
  - [ ] 1.1 RED: `backend/apps/accounts/tests/test_settings_delete.py` — NEW — authenticated verified user: POST returns 200, `deleted_at ≈ now`, `deletion_scheduled_at ≈ now + 7d` (assert within a small tolerance), response carries ISO `deletion_scheduled_at`; ALREADY-FROZEN user → 401 `code: account_deleted` (auth gate blocks frozen users before the view — the endpoint is idempotent by construction); unauthenticated → 401; after delete, `/api/auth/me/` → 401 `code: account_deleted` (frozen immediately)
  - [ ] 1.2 GREEN: `backend/apps/accounts/settings_views.py` — NEW — `AccountDeleteView(APIView)` (DRF default `IsAuthenticated` + `CookieJWTAuthentication`, no explicit permission override): `now = timezone.now()`, set `deleted_at=now`, `deletion_scheduled_at=now + timedelta(days=7)`, save, 200 `{'deletion_scheduled_at': iso}`. NO `already_deleted` branch: a frozen user is rejected at authentication (`account_deleted`, auth.py:19-20) so the branch is unreachable — delete is idempotent (double-submit guard is the frontend's job)
  - [ ] 1.3 GREEN: `backend/apps/accounts/settings_urls.py` — NEW — `path('delete/', ...)`; register in `backend/config/urls.py`: `path('api/settings/', include('apps.accounts.settings_urls'))` (architecture routes are `/api/settings/*`, NOT under `/api/auth/`)
  - [ ] 1.4 NO token_version bump (documented decision — `validate_user_token` already 401s `account_deleted` on every app request, auth.py:19)

- [ ] **Task 2: Backend — `GET /api/settings/frozen-status/`** (AC4)
  - [ ] 2.1 RED: `test_settings_delete.py` — cookie of frozen user → 200 with ISO `deletion_scheduled_at` + integer `days_left` (7 at start; 0 once scheduled ≤ now); valid cookie of NON-frozen user → 404 `code: not_frozen`; no cookie → 401; garbage cookie → 401
  - [ ] 2.2 GREEN: `settings_views.py` — `FrozenStatusView(APIView)` with `permission_classes = [AllowAny]` and `authentication_classes: List[Any] = []` (public surface — explicit AllowAny per project convention): manual access-cookie read (`request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])`, TokenRefreshView precedent views.py:90-132); validate via `TokenWithVersionAccessToken(raw_token)` + `check_exp` + `token_version` equality → else `AuthenticationFailed(..., code='token_not_valid')`; missing cookie → `token_not_provided`; user must exist AND be frozen (`deleted_at is not None or deletion_scheduled_at is not None`) → else 404 `{'code': 'not_frozen'}`; `days_left = max(0, ceil((deletion_scheduled_at - now).total_seconds() / 86400))`
  - [ ] 2.3 shared helper `_frozen_user_from_cookie(request)` used by both cookie-based views (returns `(user, None)` or `(None, Response)`)

- [ ] **Task 3: Backend — `POST /api/settings/undelete/`** (AC4)
  - [ ] 3.1 RED: `test_settings_delete.py` — frozen user (grace active): POST → 200 `code: account_recovered`, both fields NULL, then `me()` → 200 (full access restored); grace expired (`deletion_scheduled_at ≤ now`) → 409 `code: irreversible` AND fields still set; non-frozen user → 409 `code: not_frozen`; no cookie → 401
  - [ ] 3.2 GREEN: `settings_views.py` — `AccountUndeleteView(APIView)`, AllowAny + `authentication_classes=[]`, cookie-read: not frozen → 409 `not_frozen`; `deletion_scheduled_at is None or <= now` → 409 `irreversible`; else clear both fields (`update_fields`), 200 `{'code': 'account_recovered'}`

- [ ] **Task 4: Backend — `hard_delete_expired` Celery task** (AC5)
  - [ ] 4.1 RED: `backend/tests/test_maintenance_tasks.py` — NEW — user with `deleted_at` + `deletion_scheduled_at ≤ now` (mock `timezone.now` via `django.utils.timezone` override or set schedule in the past) → after run: user row GONE, `SingleUseToken` rows for that user GONE (CASCADE via `user.delete()`); second run → no-op (idempotent, no error); user still IN grace (schedule in future) → untouched; user with `deleted_at` set but NO schedule → untouched; task returns cleanly with NO credit_ledger/dependent models present (guard path — apps not installed)
  - [ ] 4.2 GREEN: `backend/tasks/maintenance_tasks.py` — NEW — `@shared_task hard_delete_expired()`: query `User.objects.filter(deleted_at__isnull=False, deletion_scheduled_at__isnull=False, deletion_scheduled_at__lte=now)`; per user inside `transaction.atomic()`: anonymise ledger first (guarded), delete dependent rows (guarded), then `user.delete()`. Django imports deferred to runtime (celery.py loads this module pre-app-registry — email_tasks.py:28-41 precedent)
  - [ ] 4.3 Guarded dependent-model deletions via `django.apps.apps.get_model(label, name)` in try/except LookupError: `('credits','Reveal')`, `('exports','Export')`, `('search','Search')`, `('search','SavedSearch')`, `('billing','Subscription')`, `('billing','PaymentTransaction')` — none exist until Epics 3-5; `model.objects.filter(user_id=user_id).delete()`
  - [ ] 4.4 Guarded ledger anonymisation: `('credits','CreditLedger')` → `filter(user_id=user_id).update(user_id=None)` BEFORE user delete (FK), then purge anonymised rows older than 90 days: `filter(user_id__isnull=True, created_at__lt=now - timedelta(days=90)).delete()`. **Documented requirement for Epic 4:** `CreditLedger.user` FK must be `null=True, on_delete=SET_NULL`
  - [ ] 4.5 `backend/config/celery.py` — UPDATE — `import tasks.maintenance_tasks  # noqa: E402,F401` + beat entry `'hard-delete-expired-daily': {'task': 'tasks.maintenance_tasks.hard_delete_expired', 'schedule': crontab(hour=3, minute=0)}` (AD-14 daily cron; Africa/Algiers)
  - [ ] 4.6 `email_tasks.py` precedent: `# type: ignore[misc]` on `@shared_task` decorator line; mypy-strict annotations throughout

- [ ] **Task 5: Frontend — SettingsService + frozen panel** (AC4)
  - [ ] 5.1 RED: `frontend/src/__tests__/frozen-account-panel.test.tsx` — NEW — loading → status fetch → renders `auth.frozen.scheduled_on` with formatted date + `auth.frozen.days_left` (keys asserted, never values; `Intl.DateTimeFormat` mocked/stubbed or locale 'en' + fixed date); days_left ≤ 0 → `auth.frozen.irreversible`, NO recover button, `FrozenLogout` still rendered; recover click → `settingsService.undelete()` then session `refresh()` → push `/search`; recover failure → `auth.frozen.recover_error` (`role="alert"`) and button still available; status fetch failure → `auth.frozen.status_error` + retry button re-fetches; double-click guard on recover (in-flight flag)
  - [ ] 5.2 GREEN: `frontend/src/lib/api/settings-service.ts` — NEW — `SettingsService extends HttpClient` (AD-19): `deleteAccount(): Promise<{ deletion_scheduled_at: string }>` → POST `/settings/delete/`; `frozenStatus(): Promise<{ deletion_scheduled_at: string; days_left: number }>` → GET `/settings/frozen-status/`; `undelete(): Promise<void>` → POST `/settings/undelete/`; export singleton `settingsService`
  - [ ] 5.3 GREEN: `frontend/src/components/auth/FrozenAccountPanel.tsx` — NEW — client component; state machine `loading | ready(status) | irreversible | error`; `useLocale()` + `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })` for the date (AD-8 Western numerals); recover flow: `undelete()` → `refresh()` from `useSession()` → `authenticated` → `router.push('/search')`; errors via `isAxiosError`-agnostic catch → recoverError/statusError; `FrozenLogout` REUSED (do not duplicate logout); `role="alert"` for errors; logical-property tokens only; no hardcoded strings
  - [ ] 5.4 GREEN: `frontend/src/app/[locale]/frozen/page.tsx` — UPDATE — server shell stays (metadata + layout); replace static `FrozenLogout` usage with `<FrozenAccountPanel />`; static `grace_note` paragraph moves into the panel's ready/irreversible copy

- [ ] **Task 6: Frontend — `/settings` page + Danger Zone + multi-step dialog** (AC1, AC2, AC3)
  - [ ] 6.1 RED: `frontend/src/__tests__/settings-danger-zone.test.tsx` — NEW — authenticated session: renders `settings.dzone.title` + `settings.dzone.delete_button`; guest session: renders sign-in prompt (`settings.guest_title`, link href `/login`), NO delete button; clicking delete → step-1 dialog: all four AC2 consequences rendered + Continue; step 2: Cancel + `settings.dzone.confirm` ("I understand — delete my account"); Cancel closes dialog (Backdrop/dialog gone) and focus returns to the delete trigger; confirm → `deleteAccount()` called once (double-click guard) → confirmed state renders `settings.dzone.confirmed_body` with scheduled date + Log out button → `logout()` called → `router.push('/')`; delete failure → `settings.dzone.confirm_error` (`role="alert"`) + dialog stays usable; dialog is modal (`role="dialog"` + `aria-modal` present via Base UI) and initial focus lands on Cancel (safe control)
  - [ ] 6.2 GREEN: `frontend/src/components/settings/DangerZone.tsx` — NEW — client component; `useSession()`: `authenticated` → danger card (`danger-container` tonal tokens per DESIGN.md; `rounded-lg border border-border bg-danger-container text-danger-on-container`); `guest` → sign-in prompt card (Link → `/login`); two-step dialog built on `@base-ui/react/dialog` (already a dependency — button.tsx/select.tsx precedent): `Dialog.Root` (controlled `open` + `onOpenChange`), `Dialog.Trigger` (the delete button), `Dialog.Portal` + `Dialog.Backdrop` + `Dialog.Popup` (Base UI defaults: focus trap + scroll lock + initial focus first tabbable + finalFocus returns to trigger — UX floor dialogs rule EXPERIENCE.md), `Dialog.Title`, `Dialog.Description`, `Dialog.Close`; step 1 = consequences list (4 keys) + Continue; step 2 = Cancel (first in DOM → default initial focus = safe control) + confirm `Button variant="destructive"`; on confirm → `settingsService.deleteAccount()` → `confirmed` page-state (date from response, `aria-live="polite"` region) with Log out → `logout()` → `router.push('/')`; in-flight `isSubmitting`-style flag disables buttons
  - [ ] 6.3 GREEN: `frontend/src/app/[locale]/settings/page.tsx` — NEW — server shell (login-page pattern: `generateMetadata` + `setRequestLocale` + `getTranslations('settings')`); h1 `settings.title`; renders `<DangerZone />`
  - [ ] 6.4 `common.actions.continue` key for the Continue button (AC2 step-1 CTA); Cancel reuses `common.actions.cancel`

- [ ] **Task 7: `/privacy` — deletion process section** (AC6)
  - [ ] 7.1 RED/assert: privacy page renders the new deletion section keys in all three locales (add to existing page; i18n parity check covers key sets)
  - [ ] 7.2 `frontend/src/app/[locale]/privacy/page.tsx` — UPDATE — new section (Server Component, card pattern like the rights grid): `trust.privacy.deletion_title`, `deletion_intro`, `deletion_process` (settings → multi-step → 7-day frozen grace → recover or permanent), `deletion_ledger` (anonymised 90 days for tax records); existing `response_time` key already commits to the 30-day window (AC6) — reference it, do not duplicate
  - [ ] 7.3 No changes to `anpdp_note`/`law_reference` (Open Q8 wording rule — never claim a filing)

- [ ] **Task 8: i18n keys ×3 locales** (all ACs)
  - [ ] 8.1 `frontend/messages/en.json` — NEW keys: `settings.{title,meta_title,meta_description,dzone.title,dzone.description,dzone.delete_button,dzone.dialog_title,dzone.step1_intro,dzone.consequence_frozen,dzone.consequence_permanent,dzone.consequence_credits,dzone.consequence_ledger,dzone.step2_title,dzone.step2_intro,dzone.confirm,dzone.confirming,dzone.confirm_error,dzone.confirmed_title,dzone.confirmed_body,dzone.confirmed_logout,guest_title,guest_body,guest_cta}`; `auth.frozen.{scheduled_on,days_left,recover,recovering,recover_error,status_error,retry,irreversible}`; `trust.privacy.{deletion_title,deletion_intro,deletion_process,deletion_ledger}`; `common.actions.continue`; `auth.frozen.days_left` uses ICU plural: `"You can recover your account within {days, plural, one {1 day} other {# days}}"`; `settings.dzone.confirm` = AC-literal `"I understand — delete my account"` (em dash). REMOVED keys: `auth.frozen.grace_note` (dead after the panel replaced the static copy — removed per review, no longer referenced anywhere)
  - [ ] 8.2 Mirror in `fr.json` + `ar.json` (native translations; AR RTL-safe copy; `days_left` carries the Arabic dual form `two {يومان}`) — `npm.cmd run check:i18n` parity (349 → ~384 keys/locale)
  - [ ] 8.3 No hardcoded UI strings anywhere in changed components; `billing.dzone.*` keys stay untouched (Epic 5 /billing surface)

- [ ] **Task 9: Verification gates + story sync** (all ACs)
  - [ ] 9.1 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` (117 → ~127), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0
  - [ ] 9.2 Frontend (from `frontend/`): `npm.cmd test` (150 → ~160), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green
  - [ ] 9.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review (dev-story) → done (code-review); sprint-status.yaml synced (2-6 → in-progress → review → done; epic-2 → done once 2-6 done)

## Dev Notes

### Decided constraints (confirmed with user)

- **Recovery is session-cookie based (decision 1)**: login stays permissive for frozen users (shipped 2.3 behavior — `TokenCreateView` issues cookies; the `/me` probe 401s `account_deleted` and the AD-19 interceptor bounces to `/frozen`; covered by test_me.py:114-129 + http-client.test.ts:170-177 — DO NOT change login, the interceptor, or those tests). The frozen surface (status + undelete) is authenticated by the STILL-VALID access cookie read manually in two AllowAny views (TokenRefreshView precedent). The frozen screen has a "Recover account" button ONLY — no password field (AC4 literal; decision 1a confirmed with user over email+password and login-rejection alternatives).
- **hard_delete_expired deletes the user row entirely (decision 2)**: `user.delete()` — "personal data is hard-deleted" / "email is removed" most literally. credit_ledger anonymisation ships GUARDED (model arrives in Epic 4): `user_id → NULL`, amounts kept; 90-day ledger purge for anonymised rows. **Requirement documented for Epic 4: `CreditLedger.user` must be `null=True, on_delete=SET_NULL`.** Dependent models (reveals/exports/searches/saved_searches/subscriptions/payment_transactions) don't exist until Epics 3-5 — the task deletes them via guarded `apps.get_model` lookups so it activates automatically when they land.
- **Multi-step dialog = 2 steps (decision 3)**: step 1 = the AC2 consequences dialog (4 bullets + Continue); step 2 = final confirmation with Cancel + "I understand — delete my account" (AC2 literal — 2.4/2.5 decision-1 precedent: AC wording is the contract; note the em dash in `settings.dzone.confirm`).
- **Dialog primitive = `@base-ui/react/dialog`** (decision 4): already a dependency (button.tsx/select.tsx use @base-ui/react). Base UI gives focus trap + scroll lock (modal default), initial focus on first tabbable, finalFocus back to the trigger, `aria-modal`, `role="dialog"`, Title→h2 with automatic labelling. UX floor rule EXPERIENCE.md:187 (destructive flows: initial focus to the SAFE control) → Cancel renders FIRST in step-2 DOM order so default initial focus lands on it.
- **`settings.*` namespace is NEW** (decision 5): `billing.dzone.*` pre-seeded keys belong to the Epic 5 /billing danger zone — untouched. `auth.frozen.*` gains dynamic keys; the static `grace_note` key was REMOVED from all 3 locales (superseded by `scheduled_on`/`days_left`/`irreversible`; review finding — dead keys get deleted, not kept).
- **`/settings` and `/frozen` pages = server shell + client panel** (decision 6): `generateMetadata` stays on the server page; all interactivity lives in client components. `/frozen` page keeps `FrozenLogout` in use (reused by the panel — do not delete it).
- **URLs live at `/api/settings/*`** (decision 7): new `settings_urls.py` included at `api/settings/` in `config/urls.py` — matches the architecture route table (ARCHITECTURE-SPINE.md:462-464), NOT under `/api/auth/`.
- **Delete endpoint semantics**: sets both fields, returns 200 `{deletion_scheduled_at}` (ISO); idempotent by construction — a frozen user is already rejected at authentication (`account_deleted`, auth.py:19-20), so no `already_deleted` branch (removed after RED exposed it as unreachable); NO token_version bump (the user is already blocked app-wide). Immediate logout = frontend `logout()` after the confirmed state (AC3 "logged out immediately").
- **Undelete semantics**: grace active only — `deletion_scheduled_at > now` required; else 409 `{code: 'irreversible'}`. Non-frozen → 409 `{code: 'not_frozen'}`; inactive account (`is_active=False`) → 403 `{code: 'account_inactive'}` (review finding — an admin-deactivated frozen user must not recover into a lockout dead-end). After undelete, the same cookie works again (no token_version change) → the panel pushes `/search`, where the session probe restores access.
- **frozen-status semantics**: `days_left = max(0, ceil((deletion_scheduled_at - now).total_seconds() / 86400))` — server-computed (authoritative, timezone-safe). `days_left ≤ 0` still returns 200 (account still in DB pre-cron) — the PANEL renders the irreversible state and hides recover (the endpoint independently rejects with 409).
- **Password reset works during the deletion grace** (review finding — Med): a frozen user who forgot their password could not reset it (2.4 filtered blocked users), making the "recover within 7 days" promise a lockout. `PasswordResetRequestView` now issues reset links for users in active grace; `PasswordResetConfirmView._reject_user` rejects only blocked users NOT in active grace (`_account_blocked(user) and not _in_deletion_grace(user)` — mirror of auth.py's block predicate). Expired-grace / schedule-only users stay excluded.
- **`TokenRefreshView` returns 401 (not 500) for hard-deleted users** (review finding — Med): `User.objects.get` is wrapped in `DoesNotExist` → `AuthenticationFailed(code='token_not_valid')`; newly reachable because `hard_delete_expired` removes rows while refresh cookies remain valid for 30 days.
- **`hard_delete_expired` isolates per-user failures** (review finding — Med): each user's atomic block is try/except + `logger.exception` + continue, so one poisoned user cannot abort the whole run; the global 90-day anonymised-ledger purge is hoisted OUT of the per-user loop (`_purge_anonymised_ledger` runs once per run).
- **Frozen panel branches on machine codes** (review finding — Med): `404/409 not_frozen` (recovered elsewhere / stale tab) → push `/search`; `409 irreversible` → irreversible phase; undelete success → push `/search` directly (the `/search` session probe restores access — no `refresh()` dependency, which previously dead-ended on transient errors). Western numerals enforced via `numberingSystem: 'latn'` on both `DateTimeFormat` calls (AD-8).
- **DangerZone hides during the session probe** (review finding — Low): `sessionStatus === 'loading'` returns null — authenticated users no longer flash the guest sign-in card.
- **NO new dependencies**; zod stays v3 (^3.25); no TanStack Query (AD-20 deferred to Epic 3); no model changes (deleted_at/deletion_scheduled_at shipped in migration 0001 — `backend/apps/accounts/migrations/0001_initial.py:30-31`); no migration needed.

### Existing patterns to follow

- Backend views: APIView + DRF default IsAuthenticated; public endpoints declare `permission_classes = [permissions.AllowAny]` AND `authentication_classes: List[Any] = []` (views.py:90-92, 135-137 precedent — otherwise a stale session cookie 401s before the view runs).
- Manual cookie auth: `request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])` → `TokenWithVersionAccessToken(raw_token)` + `check_exp()` → `User.objects.get(pk=token['user_id'])` → compare `token.get('token_version', 0)` vs `user.token_version` → `AuthenticationFailed('...', code='token_not_valid')` (TokenRefreshView views.py:102-113 precedent).
- Error contract: DRF exception codes surface as `{'code': ...}` via `custom_exception_handler` (exceptions.py) — every response carries a machine `code` key; frontend `redirectTargetForError` only reacts to 401 codes (http-client.ts:27-34) — 409/404 never auto-redirect.
- Celery: deferred Django imports inside the task (app registry not ready at module import — email_tasks.py:28-41); `# type: ignore[misc]` on the `@shared_task` line; mypy-strict annotations; beat entries in `config/celery.py` (existing `check-low-credits-daily`).
- Frontend service layer: `HttpClient` subclass with `this.client.post/get` (auth-service.ts); singleton export; component tests mock the service module with `vi.mock('@/lib/api/settings-service')` (login-form.test.tsx:19-28 precedent).
- Vitest: `setup.ts` mocks next-intl (returns keys) + next/navigation; session-dependent components wrap in `<SessionProvider>` (login-form.test.tsx:52-57); `useSession` needs the provider OR mock the provider — for DangerZone tests wrap in SessionProvider with `authService.me` mocked via `@/lib/api/auth-service` (SessionProvider imports it directly — must mock `me` to resolve the probe); assertions on message KEYS, never values; async RHF/effects → `waitFor`/`findBy*`.
- Design tokens: `rounded-md border-border bg-card`, `text-small text-muted-foreground`, `text-destructive`, danger tonal `bg-danger-container text-danger-on-container` (DESIGN.md:41-42,197-198); logical properties only (`ms-*`/`me-*`/`text-start`), NO physical properties (AD-2/AD-9).
- No code comments unless necessary; repo commit style `Story 2.6: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push; user commits manually.
- Checkboxes `- [x]` stay unchecked until the dev story executes them — tasks above are the live checklist.

### Implementation notes

- `days_left` computed in the VIEW (server), never client-side arithmetic on the timestamp — single source of truth for "recoverable within {n} days".
- Date rendering: `new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })` with `useLocale()` — Western Arabic numerals (AD-8/FR-15).
- `FrozenAccountPanel` state machine: `loading → ready | irreversible | error`; recover sub-state `idle | busy | error`; `status_error` + Retry button re-runs the fetch (network/4xx failures are transient on /frozen).
- Recover success: `await settingsService.undelete()` then `router.push('/search')` — the `/search` session probe (`/me`) restores the session; no explicit `refresh()` dependency (a transient refresh failure previously dead-ended with the account already recovered — review finding). Machine-code branching: `409 irreversible` → irreversible phase; `404/409 not_frozen` → `/search` (recovered elsewhere / stale tab).
- DangerZone confirmed state: replace the danger card content with `confirmed_title` + `confirmed_body` (date interpolated, from the delete response) in an `aria-live="polite"` region (announcement, not alert) + Log out button.
- Dialog focus assertions: Base UI renders into a portal — scope queries via `screen` (works across portals) and assert `role="dialog"` + `aria-modal="true"`; initial focus on Cancel via `expect(cancelButton).toHaveFocus()`; after Cancel, `expect(deleteButton).toHaveFocus()` (finalFocus).
- Guest DangerZone: `useSession().status === 'authenticated'` gates the card; render `guest_title`/`guest_body` + `Link href="/login"` (guest CTA) — the /settings route itself is a public server page (no middleware guard exists for app routes yet).
- The delete endpoint is idempotent — a frozen user is rejected at authentication (401 `account_deleted`) before the view runs, so no re-entry guard is needed server-side; the frontend double-click guard covers the in-flight window (settings-danger-zone test asserts `deleteAccount` called once).
- Privacy section placement: after the rights grid, before `anpdp_note` — same `mt-10` spacing + card pattern; reuse `Shield` icon import (already imported in privacy page).

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd` (npm.ps1 blocked); `python3` unavailable — use `.\.venv\Scripts\python.exe` (backend) / `python` for scripts.
- Ruff line length 100; mypy strict — annotate `settings_views.py` fully (`List[Any]` for authentication_classes like views.py:92).
- `apps.get_model` returns `None`-able under mypy — handle with `cast`/`isinstance` guards; the try/except LookupError pattern must NOT swallow the `transaction.atomic` (keep guards INSIDE the per-user atomic block, exceptions only for missing models).
- Task idempotency: second run finds no expired users (rows deleted) — assert no exception and no rows touched.
- `User.objects.filter(...).iterator()` + per-user `transaction.atomic()` — do not hold one giant transaction.
- Base UI Dialog requires `<Dialog.Close>` inside the Popup for touch-screen-reader escape (modal=true) — the Cancel button can BE the Close for step 2; step 1's Continue is a plain button that advances step state inside the same dialog instance (one Dialog.Root, two step views — do NOT nest dialogs; "modal stacks deeper than one level" is banned, EXPERIENCE.md:169).
- i18n parity: `check:i18n` compares key SETS (en = source of truth) — every new key must exist in all 3 files; ICU plural syntax is one key (no `_one`/`_other` suffix files).
- `auth.frozen.days_left` ICU: `"{days, plural, one {You can recover your account within 1 day} other {You can recover your account within {days} days}}"` — days is an integer from the API.
- Em dash in `settings.dzone.confirm` is U+2014 (`—`), not a hyphen — AC literal.
- Do NOT touch: login view/interceptor/http-client.ts (frozen redirect already shipped + tested), `authService`, SessionProvider, migrations, `billing.dzone.*` keys. `FrozenLogout` received ONE behavior-neutral change: `useTranslations('auth.frozen')` → `useTranslations()` + full key `t('auth.frozen.logout')` (same resolved message in production; makes mocked-t key assertions uniform — reviewed and accepted).
- The `/settings` h1 metadata: `settings.meta_title`/`settings.meta_description` needed for `generateMetadata`.

### Project Structure Notes

- Backend NEW: `backend/apps/accounts/settings_views.py`, `backend/apps/accounts/settings_urls.py`, `backend/tasks/maintenance_tasks.py`, `backend/apps/accounts/tests/test_settings_delete.py`, `backend/tests/test_maintenance_tasks.py`.
- Backend UPDATE: `backend/config/urls.py` (settings include), `backend/config/celery.py` (import + beat entry).
- Frontend NEW: `frontend/src/lib/api/settings-service.ts`, `frontend/src/components/auth/FrozenAccountPanel.tsx`, `frontend/src/components/settings/DangerZone.tsx`, `frontend/src/app/[locale]/settings/page.tsx`, `frontend/src/__tests__/settings-danger-zone.test.tsx`, `frontend/src/__tests__/frozen-account-panel.test.tsx`.
- Frontend UPDATE: `frontend/src/app/[locale]/frozen/page.tsx`, `frontend/src/app/[locale]/privacy/page.tsx`, `frontend/src/components/auth/FrozenLogout.tsx` (behavior-neutral unnamespaced hook), `frontend/messages/{en,fr,ar}.json`.
- Backend UPDATE (auth app, review round): `backend/apps/accounts/views.py` (refresh 401 guard for hard-deleted users; password-reset grace for frozen users — `_account_blocked`/`_in_deletion_grace` helpers), `backend/apps/accounts/tests/test_password_reset.py` (5 new grace tests).
- No changes: models/migrations, auth.py (accounts), http-client.ts, auth-service.ts, LoginForm, SessionProvider.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-06-account-deletion.md] Story spec (AC1-AC6)
- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-03-login-session-management.md#L51-L53] Deletion-grace login AC (frozen screen + recover action instead of /search)
- [Source: _bmad-output/implementation-artifacts/2-5-auth-ui-components.md] Completed 2.5 — story format precedent, AC-literal copy decision, a11y floor patterns, test conventions, gates
- [Source: docs/ARCHITECTURE-SPINE.md#L462-L464] `/api/settings/delete/` + `/api/settings/undelete/` route rows; #L700 account-deletion security row; #L37 hard_delete_expired beat; #L290 AD-14 daily cron; #L286-291 AD-14 retry/idempotency; #L134-147 users schema + credit_ledger; #L329-334 AD-19 interceptor (account_deleted → /frozen)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L136] Account deletion flow component row (multi-step, 7-day grace, ledger 90 days); #L158 Deletion-grace state row; #L165 Destructive-action confirmation primitive; #L187 dialogs (focus trap, initial focus safe control, return focus); #L184 forms AA floor; #L104 delete-account confirmation microcopy
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md#L39-42,L197-198] danger tokens; #L317 rounded.xl dialogs
- [Source: backend/apps/accounts/views.py#L90-L132] TokenRefreshView — manual cookie-read auth precedent
- [Source: backend/apps/accounts/auth.py#L19-L20] account_deleted block (why no token_version bump needed)
- [Source: backend/tasks/email_tasks.py#L23-L41] Celery deferred-import + `# type: ignore[misc]` precedent
- [Source: backend/config/celery.py] Beat schedule location + explicit task import pattern
- [Source: backend/conftest.py] fixtures: api_client, user_data, create_user, logged_in_client; `_no_network_email` autouse
- [Source: frontend/src/lib/api/auth-service.ts, frontend/src/lib/api/http-client.ts] Service inheritance + error contract
- [Source: frontend/src/components/auth/FrozenLogout.tsx, frontend/src/app/[locale]/frozen/page.tsx] Current frozen surface (to extend)
- [Source: frontend/src/components/ui/button.tsx#L18-L19] `destructive` variant
- [Source: frontend/src/__tests__/login-form.test.tsx] vi.hoisted module mocks, SessionProvider wrap, key assertions, tab-order helper
- [Source: frontend/package.json] `@base-ui/react ^1.6.0` (Dialog primitives verified in node_modules — Root/Trigger/Portal/Backdrop/Popup/Title/Description/Close/Viewport)

## Review Findings

- [x] [Review][Patch] Frozen recovery dead-ended when the session refresh failed after a successful undelete (account already recovered → retry hit 409 `not_frozen` → permanent error). The panel now pushes `/search` directly on undelete success and branches on machine codes: `404/409 not_frozen` → `/search` (stale tab / recovered elsewhere), `409 irreversible` → irreversible phase. 3 new tests [FrozenAccountPanel.tsx]
- [x] [Review][Patch] "Recover within 7 days" was a lockout for password-forgotten users: password reset excluded frozen accounts AND the refresh endpoint 401ed them (60-min access cookie). `PasswordResetRequestView` now issues links for users in active grace; `PasswordResetConfirmView._reject_user` rejects only blocked users NOT in grace (new `_account_blocked`/`_in_deletion_grace` helpers, mirror of auth.py). 5 new tests [views.py, test_password_reset.py]
- [x] [Review][Patch] `TokenRefreshView` 500ed for hard-deleted users (row removed by the new task while the 30-day refresh cookie was still valid — pre-existing line, newly reachable). `User.objects.get` wrapped in `DoesNotExist` → 401 `token_not_valid`. 1 new test [views.py, test_settings_delete.py]
- [x] [Review][Patch] `hard_delete_expired` aborted the whole run on the first failing user (PII left undeleted, no log, no retry). Per-user `try/except` + `logger.exception` + continue; the global 90-day anonymised-ledger purge hoisted out of the per-user loop (`_purge_anonymised_ledger` runs once) [maintenance_tasks.py]
- [x] [Review][Patch] Undelete ignored `is_active`: a frozen account deactivated by admin recovered into an `account_inactive` lockout dead-end. Undelete now rejects with 403 `{code: 'account_inactive'}`. 1 new test [settings_views.py, test_settings_delete.py]
- [x] [Review][Patch] AD-8 violation: `Intl.DateTimeFormat` with `ar` renders Arabic-Indic numerals for the scheduled date. `numberingSystem: 'latn'` added to both DateTimeFormat calls; Arabic `days_left` gained the grammatically required dual form `two {يومان}` [FrozenAccountPanel.tsx, DangerZone.tsx, messages/ar.json]
- [x] [Review][Patch] DangerZone flashed the guest sign-in card while the session probe was in flight (`loading` ≠ `authenticated`). Early `return null` during `loading`; 1 new test [DangerZone.tsx, settings-danger-zone.test.tsx]
- [x] [Review][Patch] Dead key `auth.frozen.grace_note` (superseded by the panel) removed from all 3 locales [messages/{en,fr,ar}.json]
- [x] [Review][Patch] Double-click tests resolved promises after the test body (React `act` warnings — flakiness risk under React 19). Both resolved inside `await act(...)`; FrozenAccountPanel's `load` callback no longer depends on the `useRouter()` identity (mocked router is a fresh object per render → infinite effect loop; stable `routerRef` with `[]` deps) [2 test files]
- [x] [Review][Correction] Story Task 8.1 key list fixed to match the shipped key set (`dzone.step1_title` → `dzone.dialog_title`; `dzone.confirming` added; `grace_note` removal recorded); FrozenLogout's behavior-neutral unnamespaced-hook change recorded in Dev Notes (accepted deviation from "Do NOT touch")

Dismissed as by-design/documentation: 60-min access-cookie expiry on the frozen surface (self-heals via re-login — login stays permissive for frozen users; the panel's logout+retry exit exists), step-1 dialog Cancel button (matches AC2's button contract), cron-vs-undelete TOCTOU (mutually exclusive predicates `<= now` vs `> now`).

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **Namespaced `useTranslations` breaks key assertions**: components using `useTranslations('auth.frozen')` render `scheduled_on` under the mocked t (returns the key verbatim), while tests assert `auth.frozen.scheduled_on` — all new components + FrozenLogout use the unnamespaced hook with full keys (LoginForm precedent).
- **`useRouter()` identity loop**: `useCallback(load, [router])` re-created `load` every render because the vitest `useRouter` mock returns a fresh object per call → `useEffect([load])` re-fired infinitely. Fixed with a stable `routerRef` + `[]` deps.
- **Base UI Dialog lacks `aria-modal`** (uses the inert-background pattern) — set explicitly on `Dialog.Popup` for the WCAG contract.
- **In-flight label swaps break `getByText` second clicks**: the confirm/recover buttons relabel to `confirming`/`recovering` while busy; double-click tests query by role+name of the busy label.
- **409 `already_deleted` was unreachable**: a frozen user is rejected at authentication (`account_deleted`) before the delete view runs — removed the branch (idempotent delete), test documents the 401 contract.
- Review round (3 sequential layers: Blind Hunter → Edge Case Hunter → Acceptance Auditor): 19 raw findings → 10 fixed (9 patches above + story corrections), 2 dismissed with rationale, 2 duplicates merged. Post-review gates: 142 backend (135 + 7) / 171 frontend (167 + 4), lint/typecheck/ruff/mypy 0, i18n 384×3 ✓.

### Completion Notes List

- `settings_views.py` (NEW): `AccountDeleteView` (sets `deleted_at=now` + `deletion_scheduled_at=now+7d`, 200 ISO; idempotent — frozen users are blocked at auth), `FrozenStatusView` + `AccountUndeleteView` (AllowAny, manual access-cookie validation via shared `_frozen_user_from_cookie` — TokenRefreshView precedent; `days_left = max(0, ceil(...))` server-computed; undelete 409 `irreversible`/`not_frozen`, 403 `account_inactive`).
- `settings_urls.py` (NEW) + `config/urls.py`: `/api/settings/*` routes (architecture table).
- `maintenance_tasks.py` (NEW): `hard_delete_expired` — expired-frozen query, per-user atomic block with try/except + `logger.exception` isolation, guarded dependent-model deletes (6 models, Epics 3-5), guarded ledger anonymisation (`user_id → NULL`, pre-delete) + global 90-day purge hoisted out of the loop; beat entry `crontab(hour=3)` in `celery.py`. Epic-4 requirement documented: `CreditLedger.user` must be `null=True, on_delete=SET_NULL`.
- `views.py` (auth app, review): refresh 401 for hard-deleted users; password-reset request + confirm allow users in active deletion grace (`_account_blocked`/`_in_deletion_grace`).
- `settings-service.ts` (NEW): `deleteAccount`/`frozenStatus`/`undelete` (AD-19 inheritance).
- `/frozen`: page shell + `FrozenAccountPanel` (NEW) — status fetch → scheduled date (Intl `latn`) + days-left + Recover → `/search` on success/`not_frozen`; `irreversible` phase when days_left ≤ 0 or 409; `role="alert"` errors + retry; FrozenLogout reused.
- `/settings` (NEW): server shell + `DangerZone` (NEW) — guest prompt (no flash during probe), danger-tonal card, 2-step Base UI dialog (4 AC2 consequences → Cancel + "I understand — delete my account"), `aria-modal` + initial focus on Cancel + finalFocus to trigger, confirmed state (`aria-live="polite"`, date, Log out), error + double-click guards.
- `/privacy`: deletion-process section (4 keys; 30-day window via existing `response_time`).
- i18n: +35 keys, −1 (`grace_note`) ×3 locales → 384 keys/locale, parity green; AR dual form for days_left.
- Gates: backend 142 pytest / ruff 0 / mypy strict 0; frontend 171 tests / lint 0 / typecheck 0 / check:i18n 384×3 ✓.
- Review: 3 sequential layers, 10 fixes + 2 dismissals (documented above).

### File List

- `_bmad-output/implementation-artifacts/2-6-account-deletion.md` — NEW (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (2-6 → ready-for-dev → in-progress → review → done; epic-2 → done)
- `backend/apps/accounts/settings_views.py` — NEW (delete/undelete/frozen-status views + cookie helper)
- `backend/apps/accounts/settings_urls.py` — NEW (settings routes)
- (Post-story refactor 2026-08-03: account modules relocated into `views/` + `urls/` packages — `views/auth.py` (ex-views.py), `views/settings.py` (ex-settings_views.py), `urls/auth.py` (ex-urls.py), `urls/settings.py` (ex-settings_urls.py); `config/urls.py` includes updated accordingly; spine doc accounts block updated.)
- `backend/apps/accounts/views.py` — UPDATE (review: refresh 401 guard; password-reset grace helpers)
- `backend/apps/accounts/tests/test_settings_delete.py` — NEW (13 + 2 review tests)
- `backend/apps/accounts/tests/test_password_reset.py` — UPDATE (5 review grace tests)
- `backend/tasks/maintenance_tasks.py` — NEW (hard_delete_expired + guarded helpers)
- `backend/tests/test_maintenance_tasks.py` — NEW (5 tests)
- `backend/config/urls.py` — UPDATE (settings include)
- `backend/config/celery.py` — UPDATE (task import + daily beat)
- `frontend/src/lib/api/settings-service.ts` — NEW (SettingsService)
- `frontend/src/components/auth/FrozenAccountPanel.tsx` — NEW (status/recover/irreversible/error states)
- `frontend/src/components/auth/FrozenLogout.tsx` — UPDATE (behavior-neutral unnamespaced hook)
- `frontend/src/components/settings/DangerZone.tsx` — NEW (2-step destructive dialog + confirmed state)
- `frontend/src/app/[locale]/settings/page.tsx` — NEW (server shell)
- `frontend/src/app/[locale]/frozen/page.tsx` — UPDATE (panel instead of static copy)
- `frontend/src/app/[locale]/privacy/page.tsx` — UPDATE (deletion section)
- `frontend/src/__tests__/frozen-account-panel.test.tsx` — NEW (11 tests incl. review code-branch tests)
- `frontend/src/__tests__/settings-danger-zone.test.tsx` — NEW (11 tests incl. review loading test)
- `frontend/messages/en.json` / `fr.json` / `ar.json` — UPDATE (+35 keys, −grace_note, ×3)

## Change Log

- 2026-08-03: Story created (ready-for-dev) from epic 2.6 spec; decisions resolved (cookie-based frozen surface, hard-delete user row, 2-step dialog, settings.* namespace, Base UI dialog primitive, /api/settings/ URLs); validated against checklist.
- 2026-08-03: Implemented (TDD): RED 13 backend + 2 frontend suites → endpoints + task + beat + components + i18n → GREEN 135 backend / 167 frontend, lint/typecheck/ruff/mypy/i18n clean; status → review; sprint 2-6 → review. Commit `5ce56b5`.
- 2026-08-03: Code review (3 sequential layers: Blind Hunter → Edge Case Hunter → Acceptance Auditor — 19 raw findings, 10 fixed across 9 patches + story corrections, 2 dismissed, 2 merged). Patches: panel code-branching (404/409 not_frozen → /search, 409 irreversible → irreversible phase, direct /search on undelete success), password-reset during grace + refresh 401 for hard-deleted users, per-user task error isolation + hoisted ledger purge, undelete 403 account_inactive, `numberingSystem: 'latn'` (AD-8) + Arabic dual, DangerZone loading null, grace_note removal, act()-wrapped resolves + routerRef loop fix. 142 backend / 171 frontend tests green, all gates clean; status → done; sprint 2-6 → done, epic-2 → done. Commit `(review-fixes)`. NOTE: do NOT push; user commits/merges manually.
