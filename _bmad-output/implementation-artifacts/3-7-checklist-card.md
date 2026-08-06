---
story_id: 3.7
epic: 3
title: Story 3.7 — Checklist Card
Status: done
frs: [FR-5, FR-14, FR-17]
ads: [AD-3, AD-8, AD-9, AD-19, AD-20, AD-21]
ux_drs: [UX-DR16, UX-DR20, UX-DR21]
baseline_commit: ca46572
---

# Story 3.7: Checklist Card

Status: done

## Story

As a **new user with 15 free credits**,
I want **a first-run onboarding card on the search screen that guides me through Run first search → Reveal a contact → Export a CSV**,
So that **I understand the core workflow and can complete the value loop quickly**.

## Acceptance Criteria

**Given** the Checklist Card component
**When** a new authenticated user lands on `/search` for the first time
**Then** a card appears below the 15-credit banner with:
- {colors.card} fill, 1px {colors.border}, {rounded.lg}
- Three steps: Run first search / Reveal a contact / Export a CSV
- Each step has a circle-check icon
- Pending step: {colors.border} icon, {colors.foreground} label
- Complete step: {colors.success} check icon, label in {colors.muted-foreground} (no strikethrough)

**Given** live check-off behavior
**When** the user completes any of the three actions
**Then** the corresponding step updates to "complete" in real time
**And** the change is announced via `aria-live="polite"`

**Given** card dismissal
**When** all three steps are complete, OR the user clicks the dismiss `X`
**Then** the card vanishes and does not reappear
**And** the card also vanishes if dismissed mid-way (acknowledged but not completed)

**Given** card visibility
**When** the card is dismissed or completed
**Then** it is never shown again for that account

**Given** the 3-step flow references:
- Step 1: triggers the first search (FR-5)
- Step 2: triggers the first reveal (FR-14)
- Step 3: triggers the first export (FR-17)

## Tasks / Subtasks

- [x] **Task 1: Backend — `checklist_dismissed_at` column + admin** (AC: never shown again; Winston D6 decision a)
  - [x] 1.1 RED: `backend/apps/search/tests/test_checklist.py` — NEW — model/schema tests (the 3.6 `test_migrations.py` precedent): the `users` table in the applied schema has a nullable `checklist_dismissed_at` column; `User._meta.get_field('checklist_dismissed_at')` is a null-able DateTimeField (no default, blank allowed).
  - [x] 1.2 GREEN: `backend/apps/accounts/models.py` — UPDATE — `checklist_dismissed_at = models.DateTimeField(null=True, blank=True)` on `User` (the spine users-table shape; NULL = never dismissed, a timestamp = permanent — John PM3). Run `makemigrations accounts` → `000X_user_checklist_dismissed_at.py` (verify no model drift).
  - [x] 1.3 GREEN: `backend/apps/accounts/admin.py` — UPDATE — `checklist_dismissed_at` in `readonly_fields` + `list_display` on the User admin — this is the SUPPORT RE-ARM path (John PM3: no product resurface; ops clears the column in admin if ever needed).
  - [x] 1.4 Run backend gates (pytest/ruff/mypy) — green.

- [x] **Task 2: Backend — `GET/PUT /api/search/checklist/`** (Winston decision a: derived completion + single dismissal column; Epic-4 contract)
  - [x] 2.1 RED: `backend/apps/search/tests/test_checklist.py` — UPDATE — endpoint suite (authenticated via the `search_session` fixture pattern from test_saved_search_api — login + cookie; `pytestmark = pytest.mark.django_db`):
    - **GET fresh user** → 200 `{step_search: false, step_reveal: false, step_export: false, dismissed: false}`.
    - **GET after a search** → create a DailyUsage row for the user (`search_count=1`, any date) → `step_search: true`; `step_reveal`/`step_export` STILL `false` (the Epic-4 contract — the reveals/exports tables do not exist yet).
    - **CUMULATIVE semantics (John PM2)**: a DailyUsage row dated YESTERDAY with `search_count=1` and NO row today → `step_search: true` — first-EVER, never today-only. The per-day `daily_usage` row count is never the source; the EXISTS spans all rows.
    - **PUT dismiss** → `{dismissed: true}` → 200 with the same shape, `dismissed: true`; follow-up GET reflects it; the user row has `checklist_dismissed_at` set.
    - **PUT idempotent** → a second `{dismissed: true}` → 200 again (the column just re-sets).
    - **PUT validation (strict)**: `{dismissed: false}` → 400 `code == 'invalid_payload'` (dismissal is permanent — re-arm is admin's job); `{}` → 400; `{dismissed: true, extra: 1}` → 400 (unknown fields rejected).
    - **auth**: unauthenticated GET/PUT → 401 (the settings base.py default `IsAuthenticated`).
  - [x] 2.2 GREEN: `backend/apps/search/views.py` — UPDATE — `ChecklistView(APIView)`:
    - GET: `step_search = DailyUsage.objects.filter(user_id=request.user.id, search_count__gt=0).exists()` (cumulative across ALL rows — never today-filtered); `step_reveal = False`, `step_export = False` (hard-coded in 3.7 — see Dev Notes Epic-4 contract for the exact extension); `dismissed = request.user.checklist_dismissed_at is not None`. Return 200.
    - PUT: body must be exactly `{'dismissed': True}` (else 400 `{'detail': ..., 'code': 'invalid_payload'}` — the `_validation_response` precedent); write via `get_user_model().objects.filter(pk=request.user.id).update(checklist_dismissed_at=timezone.now())` (single-field idempotent write, no lock needed — nothing is counted); return 200 with the same shape as GET.
  - [x] 2.3 GREEN: `backend/apps/search/urls.py` — UPDATE — `path('checklist/', ChecklistView.as_view(), name='checklist')` (prefix-relative — the /api prefix lives in config/urls.py, NEVER here).
  - [x] 2.4 Run backend gates — green.
  - [x] 2.5 Real-stack verification (docker stack up, PG16): `migrate accounts` applied; curl login → `GET /api/search/checklist/` (all false) → run one search through `/api/search/people/` → GET again (`step_search: true`) → `PUT {"dismissed": true}` → 200 → GET (`dismissed: true`); test user cleaned (the 3.6 E2E precedent).

- [x] **Task 3: Frontend — ChecklistService + query key factory** (AD-19, AD-21)
  - [x] 3.1 RED: `frontend/src/__tests__/checklist-service.test.ts` — NEW — `get()` → GET `/search/checklist/`; `dismiss()` → PUT `/search/checklist/` with body `{dismissed: true}`; PLUS the real-URL guard (the c5f5709 precedent — real axios adapter + getUri asserting `/api/search/checklist/...`, never `/api/api/...`); PLUS `completedSteps(state)` unit tests (empty → [], all true → all three, mixed subsets; the pure derive helper).
  - [x] 3.2 GREEN: `frontend/src/lib/api/checklist-service.ts` — NEW — types: `ChecklistStep = 'search' | 'reveal' | 'export'`; `ChecklistState = { step_search: boolean; step_reveal: boolean; step_export: boolean; dismissed: boolean }`; `ChecklistService extends HttpClient` with `get(): Promise<ChecklistState>` and `dismiss(): Promise<ChecklistState>`; export singleton `checklistService`; export `completedSteps(state): ChecklistStep[]` (step_search → 'search', step_reveal → 'reveal', step_export → 'export').
  - [x] 3.3 GREEN: `frontend/src/lib/queryKeys/checklist.ts` — NEW — factory (the savedSearchesKeys pattern): `{ all: ['checklist'] as const, idle: ['checklist', 'idle'] as const, state: (userKey: string) => ['checklist', 'state', userKey] as const }`. NEVER inline arrays (AD-21). **The state key is USER-SCOPED by `user.email` — the 3.6 review lesson (cross-user cache exposure within staleTime) applies verbatim.**
  - [x] 3.4 Frontend gates — green.

- [x] **Task 4: Frontend — useChecklist + useChecklistMutations hooks** (AD-21 — the SECOND-generation consumer; follow the 3.6 useSavedSearches/useSavedSearchMutations pattern exactly)
  - [x] 4.1 RED: `frontend/src/__tests__/checklist-hooks.test.tsx` — NEW — via `renderHook` inside `QueryClientProvider` (fresh client per test) with `checklistService` mocked:
    - **useChecklist**: query fires on mount with a user (enabled gating — `enabled: user !== null`; guest → NO fetch, phase `'idle'` NOT loading — the AD-21 disabled-not-loading rule); success → `state` + `completed` derived; error → phase `'error'` + `refetch` action; `isFetching` surfaced (all four states).
    - **key scope**: the state key embeds `user.email` — two users in one session never share cache entries.
    - **no placeholderData** — assert the hook never sets it (state `undefined` while loading).
    - **useChecklistMutations**: `dismiss` success → invalidates `checklistKeys.all` (spy on `queryClient.invalidateQueries`); error surfaces.
  - [x] 4.2 GREEN: `frontend/src/hooks/useChecklist.ts` — NEW — `useChecklist({ user }: { user: SessionUser | null })`: `useQuery({ queryKey: user === null ? checklistKeys.idle : checklistKeys.state(user.email), queryFn: () => checklistService.get(), enabled: user !== null, staleTime: 60_000 })` — staleTime RATIONALE (write it in the hook): the checklist changes only via (a) the user's own dismiss mutation (invalidates) and (b) Epic-4 completion mutations (contract — they invalidate `checklistKeys.all`); the 60s staleTime only serves same-session remounts, and completions are ALWAYS driven by invalidation-triggered refetches, never stale data. Explicit return type `{ state: ChecklistState | null; phase: 'idle' | 'loading' | 'error' | 'success'; isFetching: boolean; refetch: () => void; completed: ChecklistStep[] }` (phase requires `user !== null`; `completed = completedSteps(state)` or `[]`).
  - [x] 4.3 GREEN: `frontend/src/hooks/useChecklistMutations.ts` — NEW — `useChecklistMutations()`: `dismiss` `useMutation` (`mutationFn: () => checklistService.dismiss()`, `onSuccess: () => void queryClient.invalidateQueries({ queryKey: checklistKeys.all })` — factory keys ONLY); explicit return type with `mutate`, `mutateAsync`, `isPending`.
  - [x] 4.4 Frontend gates — green.

- [x] **Task 5: Frontend — ChecklistCard component — TDD** (ACs: anatomy, live check-off, dismiss X, vanish rules; Sally D1–D4; component tree ResultsArea > ChecklistCard)
  - [x] 5.1 RED: `frontend/src/__tests__/checklist-card.test.tsx` — NEW — render `<ChecklistCard onStepComplete={...} />` wrapped in QueryClientProvider + SessionProvider mocks; mock `checklistService` + `useSession` (assert i18n KEYS never values). Suite:
    - **render gating**: checklist phase loading → NOTHING renders (no flash — Sally D6); guest → nothing.
    - **anatomy**: card `data-testid="checklist-card"` with `rounded-lg border border-border bg-card` classes (the AC literal — assert the classes or the token usage, no physical classes anywhere — RTL smoke); title `search.checklist.title`; THREE rows in AC order (search → reveal → export) with `search.checklist.step_search/step_reveal/step_export` labels; per-row icon: pending rows carry `text-border` + `Circle` icon (lucide `CircleIcon`), complete rows carry `text-success` + `CheckCircle2Icon`; pending labels `text-foreground`, complete labels `text-muted-foreground`; **NO `line-through`/strikethrough class ever** (assert absent — Arabic legibility, DESIGN.md #L337).
    - **sr-only state per row** (WCAG — state is never color/icon-only): pending rows render `search.checklist.pending` sr-only, complete rows `search.checklist.complete` sr-only; icons `aria-hidden="true"`.
    - **live check-off**: state flips step_search false→true after mount → step 1 row re-renders complete AND `onStepComplete('search')` fired; step reveal/export flips fire `onStepComplete('reveal'/'export')`.
    - **no announcement on mount**: a user whose state is ALREADY complete (returning user) → `onStepComplete` NEVER fires (only in-session transitions — the prev-completed ref init from first success).
    - **vanish rules**: `dismissed: true` → nothing renders; all three complete → nothing renders; dismissed mid-way (1 of 3 complete + dismissed) → nothing renders.
    - **dismiss X**: visible button with `aria-label` = `search.checklist.dismiss`; click → `dismiss` mutation called; after success (invalidated refetch returns dismissed) → card unmounts; X is `min-h-11 md:min-h-8` (44px touch — UX-DR22) + keyboard-reachable (native button, focus-visible ring); X disabled while dismiss is pending (double-click guard).
    - **pending dismiss**: while `dismiss.isPending`, the X is disabled and a second click does nothing.
  - [x] 5.2 GREEN: `frontend/src/components/search/ChecklistCard.tsx` — NEW — client; props `{ onStepComplete?: (step: ChecklistStep) => void }`; consumes `useSession()` (user for enabled gating), `useChecklist({ user })`, `useChecklistMutations()` (AD-21 — components consume ONLY the hooks). Render: phase !== 'success' OR `state.dismissed` OR `completed.length === 3` → `null`. Else `<section aria-labelledby="checklist-card-title" data-testid="checklist-card" className="rounded-lg border border-border bg-card p-gutter">` with a header row (`<h2 id="checklist-card-title" className="text-title">{t('search.checklist.title')}</h2>` + dismiss Button `ms-auto` variant ghost `aria-label={t('search.checklist.dismiss')}` `min-h-11 md:min-h-8`, `disabled={dismiss.isPending}`) + `<ul>` of three rows (AC order); row = icon (`CircleIcon` pending `text-border` / `CheckCircle2Icon` complete `text-success`, both `size-4` `aria-hidden="true"`) + label (`text-foreground` pending / `text-muted-foreground` complete; NEVER `line-through`) + `<span className="sr-only">` pending/complete state; step-flip detection: `prevCompletedRef` seeded on FIRST success render (no announcement on mount), effect on `completed` change fires `onStepComplete(newStep)` for the newly added step(s). Tokens + lucide only — hand-rolled shell (the 3.5 stacked-row card precedent), NO registry add, NO new npm packages.
  - [x] 5.3 Frontend gates — green.

- [x] **Task 6: SearchPage integration — slot relocation (THE critical fix) + step-1 wiring** (ACs: card below the banner position, stays visible after first search; Sally D2/D5; review-accessibility finding (b))
  - [x] 6.1 RED: `frontend/src/__tests__/search-page-checklist.test.tsx` — NEW — SearchPage-level suite (the renderPage helper with a fresh QueryClient per test — the 3.5 precedent); mock `checklistService` + `searchService`:
    - **card renders BEFORE any search** (pre-submit) — the regression test for the slot relocation: `data-testid="checklist-card"` present while `submitted === null`.
    - **card stays visible AFTER the first search** (the CRITICAL AC — the old slot inside the `submitted === null` block made the card vanish on first Apply): run a search → the card is STILL in the DOM (steps 2-3 pending); step 1 row now complete.
    - **step 1 completes + announces via the results-status region**: after a successful search, `step_search` flips (mock: checklist GET returns step_search false, then true after the search — assert `checklistService.get` called again post-search, i.e. the invalidation fired) and the results-status `aria-live="polite"` region contains the sr-only `role="status"` span with the `search.checklist.done_search` announcement; sort/page announcements still work (no regression — announcement slot shared).
    - **dismiss from the page**: click X → `dismiss` called; card unmounts after refetch.
    - **returning user**: checklist GET returns dismissed:true → card never renders, even pre-submit.
    - **card above the results**: card is the first child of `#results` (above the not-run box and the results-area) — assert DOM order (the banner handoff defer is documented, see Dev Notes).
  - [x] 6.2 GREEN: `frontend/src/components/search/SearchPage.tsx` — UPDATE:
    - **REMOVE** `<div data-testid="checklist-slot" />` from inside the `submitted === null` block (SearchPage.tsx:283 — the card would vanish after the first search, directly contradicting the steps-2-3-pending AC).
    - Render `<ChecklistCard onStepComplete={handleChecklistStepComplete} />` as the FIRST child of `<section id="results">` — above BOTH the `submitted === null` not-run block and the `submitted !== null` results-area (Sally D5; the card is visible in every search state).
    - `handleChecklistStepComplete(step)` → `setAnnouncement(t('search.checklist.done_search' | 'done_reveal' | 'done_export'))` — the EXISTING `announcement` state renders inside the `results-status` polite region via the sr-only `role="status"` span (the 3.5 sort-announcement precedent — ONE polite region per page, review-accessibility finding (b) literal).
    - Invalidation effect (the live check-off source): `useEffect(() => { if (query.isSuccess) void queryClient.invalidateQueries({ queryKey: checklistKeys.all }) }, [query.isSuccess])` — SearchPage consumes `useQueryClient()`; fires on fresh query success (isSuccess flips false→true per new key; sort/page changes re-invalidate — one cheap GET each, acceptable); the refetched state flips step 1 server-side → the card re-renders → the card's step-flip effect fires the announcement.
    - The `submitted === null` not-run box KEEPS its `search.results.not_run` message (only the checklist-slot placeholder is removed).
  - [x] 6.3 Frontend gates — green.

- [x] **Task 7: i18n keys ×3 locales** (AC literals; AD-8 — ZERO interpolations in this family, no numeral risk)
  - [x] 7.1 `frontend/messages/en.json` — UPDATE — NEW keys under `search.checklist.*`:
    - `title`: "Get started" — card heading (working draft pending native review, PRD Open Q4 convention)
    - `step_search`: "Run your first search" — the AC literal
    - `step_reveal`: "Reveal a contact" — the AC literal
    - `step_export`: "Export a CSV" — the AC literal
    - `complete`: "Complete" — sr-only per-row state for done steps
    - `pending`: "Not complete yet" — sr-only per-row state for pending steps
    - `dismiss`: "Dismiss checklist" — the X aria-label
    - `done_search`: "First search complete" — live-region announcement (step 1)
    - `done_reveal`: "First contact revealed" — live-region announcement (step 2)
    - `done_export`: "First export complete" — live-region announcement (step 3)
    - REUSE (no new keys): nothing cross-family — do NOT reuse `search.results.*` (the 3.6 cross-family key lesson).
  - [x] 7.2 Mirror ALL changes in `fr.json` + `ar.json` (Arabic: no uppercase transforms; the card must render cleanly in RTL — logical CSS does the mirroring). `npm.cmd run check:i18n` must pass (en = source of truth; identical key counts ×3).
  - [x] 7.3 Verify the `i18n-shape.test.ts` suite resolves every NEW key ×3.

- [x] **Task 8: Verification gates + story sync** (all ACs)
  - [x] 8.1 Frontend (from `frontend/`): `npm.cmd test` all green (438 baseline + new), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (×3 locales).
  - [x] 8.2 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` green (405 baseline + new), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0.
  - [x] 8.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-7 → in-progress → review; epic-3 stays in-progress). Commit as `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.

## Dev Notes

### Decided constraints (confirmed with Sally — UX designer consultation 2026-08-06)

- **D1 — card anatomy**: NO registry component. Verified 2026-08-06: the base-nova `card` registry item ships `rounded-xl` + `ring-1 ring-foreground/10` — the AC literal is `{colors.card}` fill, 1px `{colors.border}`, `{rounded.lg}`. Hand-rolled shell = `rounded-lg border border-border bg-card` (the 3.5 stacked-row card precedent, zero new deps). Steps in AC order — Run first search / Reveal a contact / Export a CSV. Icons: pending = lucide `CircleIcon` in `text-border`; complete = lucide `CheckCircle2Icon` in `text-success` (the `{colors.success}` check). Labels: pending `text-foreground`, complete `text-muted-foreground` — **NO strikethrough ever** (`line-through` degrades Arabic legibility — DESIGN.md checklist-card #L337). Icons `aria-hidden="true"` + an sr-only per-row state span (`search.checklist.pending`/`complete`) — state is never color/icon-only (WCAG 2.1). The card carries a real heading (`search.checklist.title` in `text-title`) with `aria-labelledby` — an anchor for the X and for SR users.
- **D2 — live check-off + announcement**: completion events are SERVER-derived (Winston D6) — step 1 = first successful search (SearchPage invalidates `checklistKeys.all` on query success → refetch flips `step_search`); steps 2/3 = the Epic-4 event contract (below). The step flip is detected in the CARD (prev-completed ref), which fires `onStepComplete(step)`; SearchPage maps it to a localized announcement rendered INSIDE the existing `results-status` polite region as an sr-only `role="status"` span (the 3.5 sort-announcement precedent — ONE polite region per page; review-accessibility finding (b) is literal: "announce checklist completions via the existing polite region, NOT visual-only"). Initial-mount completions NEVER announce (returning user with steps already done gets silence — only in-session transitions).
- **D3 — dismissal UX**: X at top-inline-end (header row, `ms-auto` — logical property), real `<button>` variant ghost, `aria-label` = `search.checklist.dismiss`, `min-h-11 md:min-h-8` (UX-DR22 44px touch), focus-visible ring, native tab order (keyboard-reachable by construction), `disabled` while the dismiss mutation is pending (double-click guard). No confirmation (a dismissible onboarding card needs none — the AC is literal).
- **D4 — step 2/3 sources before Epic 4**: inert-but-visible pending states NOW. The card reads BOTH steps from the same server state fields (`step_reveal`/`step_export` return false in 3.7); the Epic-4 EVENT CONTRACT (recorded — it must be honored by 4-2/4-5): (a) backend extends `ChecklistView.GET` with `EXISTS` clauses on `reveals`/`exports` replacing the literal False — no client-contract change; (b) the Epic-4 reveal/export frontend mutations MUST `invalidateQueries({ queryKey: checklistKeys.all })` on success — otherwise the card's live check-off for steps 2/3 silently stops working. This is the reveal-slot precedent pattern (3.5) at the state level: the UI is complete today; the sources arrive with Epic 4.
- **D5 — placement without the 15-credit banner**: the banner does not exist yet (credit surfaces land in Epic 4). The card renders as the FIRST child of `#results` — above the not-run box and the results-area — which is exactly where "below the 15-credit banner" resolves once the banner ships: the banner (Epic 4) slots immediately above the card. **Banner handoff defer** recorded (deferred-work.md) — 4.x must render the banner before `#results`'s first child. THE CRITICAL FIX: the 3.6-era `checklist-slot` placeholder sits INSIDE the `submitted === null` block (SearchPage.tsx:283) — the card would vanish after the first search, contradicting the steps-2-3-pending AC. Task 6 removes that placeholder and renders the card above the whole results region (every search state).
- **D6 — persistence surface**: server-side per-account (the AC "never shown again for that account" is server persistence — see Winston). The frontend renders NOTHING until the checklist query resolves (phase 'success') — a returning user never sees a flash of the card before `dismissed: true` arrives.

### PM consultation (John — 2026-08-06) — product rules

- **PM1 — all three steps render NOW, steps 2/3 pending-and-inert.** The UJ-1 journey (EXPERIENCE.md #L277-281) is the spec: the user lands, sees the 3-step card, each step checks off live. A 1-step card teaches half the workflow and would need a second card on Epic 4 landing — contradicting the one-card-vanishes AC. Pending rows read as "not done yet" (border icon + foreground label), never broken.
- **PM2 — "first" = FIRST-EVER per account, never per-day.** Onboarding semantics: a user who searched yesterday but not today must NOT see step 1 uncheck. The backend `step_search` is `EXISTS(daily_usage WHERE search_count > 0)` across ALL rows — cumulative; same logic extends to reveals/exports in Epic 4 (first-ever reveal/export).
- **PM3 — dismissal is PERMANENT; no auto-resurface.** The AC is literal ("never shown again"). No timer, no re-nudge, no support re-arm mechanism in V1 — the admin-visible `checklist_dismissed_at` column IS the ops re-arm path (support clears it in Django admin). A future re-nudge is a new story.
- **PM4 — the card is for every authenticated account** until dismissed/completed, regardless of tier ("new user with 15 free credits" — Starter users get it too; they were once new).

### Architect consultation (Winston — 2026-08-06) — persistence design

- **Option (c) frontend-local: REJECTED** — "never shown again for that account" is account-scoped; localStorage dies on logout/login, second device, incognito.
- **Option (b) explicit JSONB progress row: REJECTED** — duplicates derivable facts (daily_usage rows, future reveals/exports tables); two sources of truth = drift for three booleans.
- **Option (a) derived + single dismissal column: ADOPTED.** `checklist_dismissed_at TIMESTAMPTZ NULL` on `users` (accounts migration — spine users-table shape). Step 1 derived via cumulative `EXISTS` on `daily_usage` (John PM2 semantics). Steps 2/3 derived via `EXISTS` on `reveals`/`exports` once Epic 4 creates the tables (hard-coded False in 3.7 + documented contract). "All three complete → vanish" needs NO storage (derived). Completed AND dismissed collapse to the same frontend rule: don't render.
- **Endpoints**: `GET /api/search/checklist/` → `{step_search, step_reveal, step_export, dismissed}` (200); `PUT /api/search/checklist/` `{dismissed: true}` → idempotent `UPDATE users SET checklist_dismissed_at = NOW()` (200, same shape; `{dismissed: false}`/unknown fields → 400 `invalid_payload` — dismissal permanent). User-scoped by construction; `IsAuthenticated` default (401 unauthenticated). Endpoint lives in `apps/search` (the surface it serves) and writes the accounts user row — the 3.6 `select_for_update` precedent shows search views already touch the user model; no new pattern.
- **AD-21 consumer #2 (BINDING)**: `checklistKeys` factory + `useChecklist` (query) + `useChecklistMutations` (dismiss) — the 3.6 useSavedSearches/useSavedSearchMutations pattern exactly: user-scoped state key (`state(user.email)` — the 3.6 cross-user-cache review lesson verbatim), enabled gating (guest → idle, not loading), explicit states, NO placeholderData, `staleTime: 60_000` with the rationale written in the hook, invalidation ONLY via factory keys (`checklistKeys.all` prefix covers every user's key). Epic-4 contract: reveal/export mutations must ALSO invalidate `checklistKeys.all`.

### Existing patterns to follow (from 3-2/3-3/3-4/3-5/3-6 precedents)

- Component + test layout: client components in `frontend/src/components/search/`, tests in `frontend/src/__tests__/<name>.test.tsx`; pure helpers exported from the module for unit tests.
- AD-21 structure (BINDING — 3.7 is the SECOND-generation AD-21 consumer): feature query hook `hooks/useChecklist.ts` + mutation hook `hooks/useChecklistMutations.ts`; key factory `lib/queryKeys/checklist.ts`; components consume ONLY the hooks; strong typing; `enabled` gating; all states explicit; NO `placeholderData`; cache tuning with rationale; invalidation ONLY via factory keys.
- Tests: vitest + jsdom; `src/test/setup.ts` imports `mocks.ts` (next-intl `useTranslations` returns the KEY, `useLocale` → 'en'); assert message KEYS never values; `fireEvent`; jest-dom matchers; QueryClientProvider wrapper with a FRESH client per test (the 3.5 renderPage precedent); `renderHook` for hook tests (AD-21 checklist step 5).
- Backend tests: `pytest.mark.django_db`; the `search_session` fixture (login via `/api/auth/login/` — cookie auth — the test_people_search precedent); `api_client` from conftest.
- i18n (AD-8): this family has ZERO interpolations — no numeral risk at all. `check:i18n` = en source of truth, identical key counts ×3; `i18n-shape.test.ts` asserts every rendered key resolves ×3.
- Design tokens (AD-2/AD-9): `bg-card`/`border-border`/`text-border`/`text-success`/`text-foreground`/`text-muted-foreground`/`text-title`/`rounded-lg`/`size-4`/`p-gutter`; logical CSS ONLY in our components; NO physical classes (RTL smoke in tests); 44px touch targets `<md` (UX-DR22): `min-h-11 md:min-h-8`; focus-visible rings on the X; no code comments unless necessary (the staleTime rationale comment in the hook is necessary — the 3.6 precedent).
- Registry: NONE in this story (hand-rolled shell + stock `button` + lucide icons — verified: base-nova `card` ships `rounded-xl` + ring, not the AC's `{rounded.lg}` + 1px `{colors.border}`). ZERO new npm packages.
- RTL (FR-2): visual flip via `dir` + logical CSS; DOM order never changes.
- Commit style: `Story 3.7: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push. Windows/PowerShell: no `&&`; chain with `;` / `if ($?) {}`; `npm.cmd`; backend venv `backend\.venv\Scripts\`.
- Checkboxes stay unchecked until dev executes them — tasks above are the live checklist.

### Implementation notes

- `ChecklistCard` props: `{ onStepComplete?: (step: ChecklistStep) => void }` ONLY — it pulls `useSession()` for the user, `useChecklist({ user })` for state, `useChecklistMutations()` for dismiss (the 3.6 SavedSearchesList self-sourcing pattern). SearchPage supplies nothing but the announcement callback — orchestration lives in the consumer (AD-21).
- Step-flip detection: `prevCompletedRef` (a `Set<ChecklistStep>` or sorted string) seeded from the FIRST `phase === 'success'` render (seed silently — no event); a subsequent effect diff on `completed` fires `onStepComplete` per new step. Multiple steps completing in one refetch (e.g. a returning user's first fetch returning all true) NEVER fire — the seed covers it; the refetch path can only add steps one at a time in practice.
- The invalidation effect in SearchPage (`query.isSuccess` → invalidate `checklistKeys.all`) re-fires on sort/page changes (fresh keys flip isSuccess false→true) — each is one cheap GET; step_search stays true after the first completion, so no repeated announcements (the card's flip detection only fires on false→true transitions).
- The announcement span renders ONLY in the `phase === 'idle' && query.data !== undefined` branch of the results-status region — post-search states always satisfy this; a step-1 completion can never happen pre-search, so no announcement is ever lost.
- `completedSteps(state)` in checklist-service.ts is the single derive helper (unit-tested) — the card and the hook both use it.
- The dismiss flow is NON-optimistic (the 3.6 mutation pattern): X click → `dismiss.mutate()` → onSuccess invalidates → refetch returns `dismissed: true` → the card's render rule returns null. The X is `disabled` while pending. No rollback needed — the write is idempotent and can only fail on network/auth (both leave the card up).
- Admin: accounts `admin.py` — add `checklist_dismissed_at` to `readonly_fields` + `list_display` on the existing UserAdmin (the John PM3 ops re-arm path; do not create new admin machinery).
- The `submitted === null` not-run box keeps its message and its `rounded-lg border border-border bg-card p-6` shell — ONLY the empty `checklist-slot` placeholder div is removed (Task 6.2). Do not delete or restyle the box.
- Test mock shape: `checklistService.get` resolves `{step_search, step_reveal, step_export, dismissed}`; the search-page suite uses a mutable mock (get returns step_search false, then true after the search success) to exercise the invalidation + announcement path.
- `ChecklistState` field names mirror the backend response EXACTLY (`step_search`, `step_reveal`, `step_export`, `dismissed`) — no renaming at the boundary.

### Gotchas

- The base-nova `card` registry item is NOT used — do not add it. If a reviewer suggests it, the AC literal ({rounded.lg}, 1px {colors.border}) is the reason.
- The 3.6 lesson: the checklist state key MUST be user-scoped (`state(user.email)`) — an unscoped key would serve one account's dismissal to another within staleTime.
- `query.isSuccess` is stable across background refetches of the same key — the invalidation effect fires only on false→true flips (new query keys), which is the intended behavior; do not "optimize" it with extra deps that reintroduce stale closure bugs.
- The card must render as the FIRST child of `#results` — placing it after the results-area re-introduces a variant of the vanish bug (the results-area only renders when submitted !== null... it would not vanish, but it would jump below the status line; the DOM-order test pins it).
- `aria-disabled` vs `disabled` on the X: plain `disabled` while pending is correct (it is NOT a disabled-but-actionable conversion path — no tooltip needed; the reveal-button precedent does not apply to a dismiss button).
- The sr-only state spans must not be inside the live region — they are static state, not announcements (the live-region span is SearchPage's `role="status"` announcement, the 3.5 pattern).
- Base UI has no role here (no popups/dialogs in this story) — no registry/dialog gotchas. All interactions are native buttons.

### Project Structure Notes

- Frontend NEW: `frontend/src/components/search/ChecklistCard.tsx`, `frontend/src/hooks/useChecklist.ts`, `useChecklistMutations.ts`, `frontend/src/lib/queryKeys/checklist.ts`, `frontend/src/lib/api/checklist-service.ts`, tests: `checklist-card.test.tsx`, `checklist-hooks.test.tsx`, `checklist-service.test.ts`, `search-page-checklist.test.tsx`.
- Frontend UPDATE: `SearchPage.tsx` (slot relocation + ChecklistCard first-child + invalidation effect + handleChecklistStepComplete), `messages/{en,fr,ar}.json` (+10 keys ×3).
- Backend NEW: `apps/accounts/migrations/000X_user_checklist_dismissed_at.py`, `apps/search/tests/test_checklist.py`.
- Backend UPDATE: `apps/accounts/models.py` (+field), `apps/accounts/admin.py` (readonly + list_display), `apps/search/views.py` (ChecklistView), `apps/search/urls.py` (checklist/ route).
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-7 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 stays in-progress.
- Deferred-work: `_bmad-output/implementation-artifacts/deferred-work.md` — record: (1) the 15-credit-banner handoff (Epic 4 renders the banner immediately above the card); (2) the step-2/step-3 Epic-4 event contract (backend EXISTS extension + frontend invalidate contract); the `/companies/:id` 404 defer stays open.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-07-checklist-card.md] Story spec (all ACs verbatim)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md#L200] checklist-card token block (background/border/radius/check-color/step-complete-foreground); #L337 checklist-card component (below the 15-credit banner, three steps + circle-check icons, pending border icon + foreground label, complete success check + muted-foreground label, NO strikethrough — Arabic legibility, live check-off, dismiss X top-inline-end)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L128] checklist-card row ("Step completions announced via the polite live region, not visual-only"; appears after the 15-credit banner); #L277-281 UJ-1 journey (card below the 15-credit banner; step 1 checks off on the first search; step 2 on the first inline reveal; step 3 on the first export — card vanishes on completion); #L180 aria-live polite scoping; #L182 44px touch targets; #L189 per-fragment language
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/review-accessibility.md#L18] finding (b) — "Checklist 'live check-off' is visual-only — SR users never learn a step completed. Fix: announce checklist completions via the existing polite region" (LITERAL requirement for D2)
- [Source: docs/ARCHITECTURE-SPINE.md#AD-21] React Query conventions (hooks + factories + cache tuning; 3.6 = first mutation consumers, 3.7 = second-generation consumer); #AD-19 (HttpClient — prefix-relative paths, /api baseURL); #AD-20 (QueryClientProvider, retry:false quota contract); AD-8 (Western numerals — zero interpolations here); AD-9 (logical CSS); Component Tree #L408-411 (ResultsArea > ChecklistCard); users DDL #L135-147; daily_usage DDL #L238-244; API routes table #L459-487 (no checklist endpoint yet — this story adds it)
- [Source: _bmad-output/implementation-artifacts/3-6-saved-searches.md] COMPLETED 3.6 — the AD-21 first-generation pattern to mirror EXACTLY (useSavedSearches + useSavedSearchMutations + savedSearchesKeys, user-scoped key lesson, staleTime rationale, enabled gating, no placeholderData, factory-only invalidation); SearchPage state model + runSearch path; real-URL guard test precedent (c5f5709)
- [Source: _bmad-output/implementation-artifacts/3-5-results-table-stacked-row.md] COMPLETED 3.5 — the hand-rolled card precedent (`rounded-lg border border-border bg-card p-gutter` — the checklist shell copies it); the results-status polite region + sr-only `role="status"` announcement span (sort/page precedent — the checklist announcements reuse this exact surface); reveal-slot inert-placeholder precedent (the D4 pattern ancestor)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] 3.7-RELEVANT: the `/companies/:id` 404 defer stays open; the 3.5 resolved items (live region, AD-20 adoption, applied identity)
- [Source: backend/apps/search/] Current state — views.py (People/Company search + SavedSearch views; `_validation_response` precedent), urls.py (people/companies/saved), quota.py (daily limits), models.py (DailyUsage, SavedSearch — NO checklist state), DailyUsage exists (`search_count` — the step-1 source); accounts User has NO onboarding/dismissal fields (models.py:53-85 — the field is genuinely new)
- [Source: frontend/src/components/search/SearchPage.tsx] **THE CRITICAL LINE**: the `checklist-slot` placeholder at line 283 sits INSIDE the `submitted === null` block — the card would vanish after the first search, contradicting the steps-2-3-pending AC; the slot must relocate above the results region (Task 6); the `results-status` aria-live region (#L290) is the announcement surface; `announcement` state + sr-only `role="status"` span (#L319-323) is the announcement mechanism
- [Source: https://ui.shadcn.com/r/styles/base-nova/card.json] base-nova `card` registry item — VERIFIED 2026-08-06: ships `rounded-xl` + `ring-1 ring-foreground/10` — does NOT match the AC ({rounded.lg} + 1px {colors.border}) → NOT used; hand-rolled shell instead. ZERO registry adds, ZERO new npm packages this story.

## Review Findings

- [x] [Review][Patch] Step-1 announcement could be permanently lost if the mount checklist GET failed once: the card's `prevCompletedRef` seeds from its FIRST success, so after a transient mount failure the first success arrives with the step already flipped — the seed absorbs it silently and `onStepComplete` never fires (no retry UI existed). [ChecklistCard.tsx, SearchPage.tsx] — FIXED: SearchPage now consumes `useChecklist` itself (same cache key) and arms a `step1PendingRef` whenever a search succeeds while the checklist data was never seen; once the invalidation refetch lands with `step_search: true`, SearchPage announces `done_search` itself. Both paths can never double-announce (the supplementary path is armed only when the card has no pre-flip state to diff). Regression test added (mount GET rejects → search → announcement still fires).
- [x] [Review][Patch] A step-1 flip landing inside the first search's loading window clobbered a fresher sort/page announcement (background refetch vs user action race). [SearchPage.tsx] — FIXED: `handleChecklistStepComplete` now uses a functional update — step announcements never overwrite an announcement already pending from the user's own action (`current === null ? t(key) : current`); the freshest (user-action) announcement wins, the step flip stays visible on the card. Trade-off documented: in this ~100ms race the step announcement yields to the sort/page feedback; the step AC is met in every non-racing path.
- [x] [Review][Patch] The card could announce a completion for an INVISIBLE card: dismiss X clicked, then a first search in the same refetch window — the refetch returned `dismissed: true` AND `step_search: true`, and the flip effect (gated only on phase) fired `onStepComplete` for dead UI. [ChecklistCard.tsx] — FIXED: the effect now also returns when `state.dismissed === true`; the all-three-complete vanish still announces (the third step's flip fires before the render-null rule).
- [x] [Review][Patch] `search-page-saved-searches.test.tsx` (3.6-era) mocked the session but not the checklist service — every test fired one real, silently-failing checklist XHR in jsdom. [search-page-saved-searches.test.tsx] — FIXED: checklist service mock added (the 3.3-retrofit pattern); zero real XHRs.
- [x] [Review][Patch] Task 1.3 delivered only half its claim: `checklist_dismissed_at` went into `readonly_fields` + the Account State fieldset but NOT `list_display` — the ops visibility leg of the support re-arm path was missing. [backend/apps/accounts/admin.py] — FIXED: added to `list_display`. (Note: the story's own readonly mandate means ops clears the column via shell/admin-data migration rather than the admin UI — spec tension recorded, readonly kept per story.)
- [x] [Review][Patch] The promised deferred-work.md record for 3.7 was absent (the 15-credit-banner handoff + the step-2/step-3 Epic-4 event contract live only in the story file). [deferred-work.md] — FIXED: 3.7 section added with both records.
- [x] [Review][Patch] PUT accepted `{"dismissed": 1}` (and `1.0`) because Python `1 == True` — the strict `{'dismissed': True}` literal check was not literal. [backend/apps/search/views.py] — FIXED: `data.keys() != {'dismissed'} or data['dismissed'] is not True` → 400 `invalid_payload`; test added (numeric true rejected).
- [x] [Review][Patch] The "never applies strikethrough" test asserted `document.body.textContent` — class names never appear in textContent, so the assertion could not fail (the component itself was clean). [checklist-card.test.tsx] — FIXED: asserts the complete label's `className` contains `text-muted-foreground` and NOT `line-through`, plus a scoped class scan of the card's own elements.
- [x] [Review][Dismissed] Two steps flipping in one refetch drop the first announcement (React batches the two `setAnnouncement` calls — the last survives). Unreachable until Epic 4 (steps 2/3 flip only via their own mutations, one at a time); single-announcement-per-refetch is the live region's contract and the freshest completion is the one announced; both flips stay visible on the card. Documented, not patched.
- [x] [Review][Dismissed] Blind Hunter layer returned no findings (empty output) — noted; Edge Case Hunter (5 findings) + Acceptance Auditor (4 findings) covered the diff, all routed above.

Dismissed as by-design/noise: (1) the F4 dual-flip batching (see above); (2) the Blind Hunter layer failure (covered by the other two layers).

Post-review gates: frontend 480 tests (479 + 1), lint 0 / typecheck 0 / check:i18n ✓; backend 422 pytest (421 + 1) / ruff 0 / mypy strict 0. Status → done; sprint 3-7 → done (epic-3 stays in-progress).

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **The slot relocation (THE critical fix)**: SearchPage.tsx's `checklist-slot` placeholder sat INSIDE the `submitted === null` block — a card mounted there would unmount after the first Apply, contradicting the steps-2-3-pending AC. Fixed by rendering `<ChecklistCard>` as the FIRST child of `#results` and deleting the placeholder; the not-run box keeps its message with a `mt-4` for spacing.
- **jsdom SVG `className` is an object, not a string**: `svg.className` in jsdom returns an SVGAnimatedString-like value (printed as `[]`) — `toContain('text-border')` failed. Use `getAttribute('class')` for SVG class assertions (the icons assert classes, the labels use `className` — spans are HTMLElement, fine).
- **Registry button ships dormant physical classes**: the stock base-nova `button` has `has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-end]:pr-2` — the RTL smoke test must scope to OUR elements (exclude `[data-slot="button"]`), same as the documented 3.6 registry-debt rule.
- **Multiple-element text queries**: two pending rows render the same `search.checklist.pending` sr-only text — use `getAllByText` for the pending assertion (complete is unique).
- **The pre-existing `search-page.test.tsx` (3.3-era) needed three additions**: (1) mock `checklist-service` (the real axios call would error in jsdom); (2) mock `SessionProvider` (the card needs the session — previously absent, the page tests ran guest-mode); (3) mock `saved-search-service` (the authenticated session now activates the real saved-list query, whose pending state rendered `common.states.loading` and broke the global loading-cleared assertion — the same pattern the 3.6 page test used).
- **`field.default` is `NOT_PROVIDED`, not `None`**: the backend field test must assert `not field.has_default()` for the nullable DateTimeField.
- **DOM-order test timing**: `findByTestId('results')` resolves while the checklist query is still pending (card renders null) — await `findByTestId('checklist-card')` BEFORE asserting first-child order.
- **PowerShell 5.1 curl.exe quoting (3.6 lesson re-confirmed)**: login/dismiss bodies must go through `--data-binary "@file.json"` — inline `'{"a":1}'` gets stripped to `{a:1}` (JSON parse error 400).

### Completion Notes List

- Backend: `User.checklist_dismissed_at` (accounts migration `0003_user_checklist_dismissed_at`, applied to real PG16 via the docker stack) + read-only admin field (the support re-arm path) + `ChecklistView` at `/api/search/checklist/`: GET derives `step_search` cumulatively across ALL `daily_usage` rows (`search_count > 0` — first-ever semantics, never today-only), `step_reveal`/`step_export` hard-coded False with the Epic-4 extension contract documented in the view; PUT accepts EXACTLY `{'dismissed': True}` (else 400 `invalid_payload`) and idempotently writes `checklist_dismissed_at`. 16 new backend tests → 421 total; ruff 0; mypy strict 0. Real-stack E2E: login → GET all-false → search → `step_search:true` → PUT dismiss → 200 + GET reflects → test user cleaned.
- Frontend: `ChecklistService` (prefix-relative paths + real-URL guard), `checklistKeys` factory (user-scoped `state(user.email)` — the 3.6 cross-user lesson), `completedSteps` pure derive helper, `useChecklist` (enabled gating, 4 explicit states, 60s staleTime with written rationale, NO placeholderData) + `useChecklistMutations` (dismiss → invalidate via `checklistKeys.all`), `ChecklistCard` (hand-rolled token shell `rounded-lg border border-border bg-card` — NO registry add, zero new npm packages; Circle/CheckCircle2 lucide icons at `text-border`/`text-success`; labels `text-foreground`/`text-muted-foreground`, never `line-through`; sr-only per-row state; render-nothing while loading/dismissed/all-complete; step-flip detection seeded from first success (no mount announcements); X `ms-auto` top-inline-end, `min-h-11 md:min-h-8`, disabled while pending), SearchPage integration (card = first child of `#results` above the not-run box and the results-area; `query.isSuccess` → invalidate `checklistKeys.all` → refetch flips step 1; `handleChecklistStepComplete` announces via the EXISTING results-status polite region sr-only `role="status"` span — review-accessibility finding (b) literal, ONE live region). 41 new frontend tests → 479 total; lint 0; typecheck 0; check:i18n 424×3 (en source of truth).
- i18n: +10 keys ×3 (`search.checklist.*` — title, step_search/reveal/export, complete, pending, dismiss, done_search/reveal/export), ZERO interpolations (no AD-8 numeral risk), shape tests added ×3.
- Dev-stage amendments: `has_default()` vs `default is None`; conditional mock seeding in the card test helper (`state === null` → let the per-test `mockResolvedValueOnce` chain drive); `getAllByText` for dual pending rows; RTL smoke scoped to non-registry elements; 3.3-era page test retrofitted with checklist/session/saved mocks.
- Status → review; sprint 3-7 → in-progress → review (epic-3 stays in-progress).

### File List

- `_bmad-output/implementation-artifacts/3-7-checklist-card.md` — UPDATE (this story; status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (3-7 → in-progress → review)
- `backend/apps/accounts/models.py` — UPDATE (checklist_dismissed_at)
- `backend/apps/accounts/migrations/000X_user_checklist_dismissed_at.py` — NEW
- `backend/apps/accounts/admin.py` — UPDATE (readonly + list_display)
- `backend/apps/search/views.py` — UPDATE (ChecklistView)
- `backend/apps/search/urls.py` — UPDATE (checklist/ route)
- `backend/apps/search/tests/test_checklist.py` — NEW (schema + endpoint suite)
- `frontend/src/lib/api/checklist-service.ts` — NEW (types + service + completedSteps)
- `frontend/src/lib/queryKeys/checklist.ts` — NEW (factory)
- `frontend/src/hooks/useChecklist.ts` — NEW (query, AD-21)
- `frontend/src/hooks/useChecklistMutations.ts` — NEW (dismiss, AD-21)
- `frontend/src/components/search/ChecklistCard.tsx` — NEW
- `frontend/src/components/search/SearchPage.tsx` — UPDATE (slot relocation + wiring)
- `frontend/messages/{en,fr,ar}.json` — UPDATE (+10 keys ×3)
- `frontend/src/__tests__/checklist-service.test.ts` — NEW
- `frontend/src/__tests__/checklist-hooks.test.tsx` — NEW
- `frontend/src/__tests__/checklist-card.test.tsx` — NEW
- `frontend/src/__tests__/search-page-checklist.test.tsx` — NEW
- `_bmad-output/implementation-artifacts/manual-review-notes.md` — (STEP 0 notes commit, prior commit)

## Change Log

- 2026-08-06: Story created (ready-for-dev) from epic 3.7 spec; Sally UX consultation resolved 6 design decisions (hand-rolled token card shell — base-nova `card` registry verified rounded-xl+ring, NOT the AC's rounded.lg+border → zero registry adds; three steps visible with 2/3 pending-inert; live check-off via the existing results-status polite region with an sr-only role="status" span — the 3.5 sort-announcement precedent, review-accessibility finding (b) literal; dismiss X top-inline-end min-h-11 keyboard-reachable; step 2/3 sources = server state fields returning false until Epic 4 + a documented event contract (backend EXISTS extension + frontend invalidate contract); placement = first child of #results above the not-run block with the banner handoff deferred). John PM consultation: all three steps render now (UJ-1 spec), "first" = first-ever per account (never per-day), dismissal permanent with NO auto-resurface (admin column = ops re-arm). Winston architect consultation: (c) frontend-local REJECTED (account-scoped AC), (b) explicit JSONB progress REJECTED (duplicates derivable facts), (a) derived + `checklist_dismissed_at` column ADOPTED — cumulative EXISTS on daily_usage for step 1, hard-coded false + contract for steps 2/3, GET/PUT /api/search/checklist/ (idempotent dismiss, strict payload), AD-21 consumer #2 (checklistKeys factory + useChecklist + useChecklistMutations, user-scoped key). Backend work confirmed in scope (authorized — the column does not exist). THE CRITICAL: SearchPage's checklist-slot at line 283 sits inside the `submitted === null` block — Task 6 relocates the card above the results region so it stays visible with steps 2-3 pending after the first search. Registry + npm: zero adds / zero new packages. sprint-status 3-7 → ready-for-dev (epic-3 stays in-progress).
- 2026-08-06: Implemented (TDD): RED suites (backend schema+endpoint 16, service 7, hooks 6, card 19, page integration 7, i18n shape +2) → backend `checklist_dismissed_at` (accounts 0003 migration) + admin readonly + ChecklistView (cumulative first-ever `step_search` via daily_usage EXISTS; strict idempotent dismiss PUT) + real-stack E2E on the docker stack → frontend ChecklistService (+ real-URL guard) + checklistKeys factory (user-scoped) + useChecklist/useChecklistMutations (AD-21 second-generation: enabled gating, 4 states, 60s staleTime rationale, no placeholderData, factory-key invalidation) → ChecklistCard (hand-rolled token shell, pending/complete icon+label states, sr-only per-row state, step-flip detection with mount-seed, dismiss X keyboard-reachable) → SearchPage slot relocation (card = first child of #results, THE critical fix) + query.isSuccess checklist invalidation + announcement via the existing results-status region → i18n +10 keys ×3 + shape tests. GREEN: frontend 479 tests (438 + 41), lint 0 / typecheck 0 / check:i18n 424×3 ✓; backend 421 pytest (405 + 16) / ruff 0 / mypy strict 0. Dev-stage amendments: has_default() vs default is None, svg class assertions via getAttribute, RTL smoke scoped off the registry button, getAllByText for dual pending rows, 3.3-era search-page test retrofitted with checklist/session/saved mocks. Status → review; sprint 3-7 → in-progress → review (epic-3 stays in-progress).
