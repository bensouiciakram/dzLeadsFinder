---
story_id: 3.6
epic: 3
title: Story 3.6 — Saved Searches
Status: review
frs: [FR-8, FR-7]
ads: [AD-3, AD-8, AD-9, AD-18, AD-20, AD-21]
ux_drs: [UX-DR20, UX-DR22, UX-DR24]
baseline_commit: ba0d54e
---

# Story 3.6: Saved Searches

Status: review

## Story

As a **user who runs the same searches repeatedly**,
I want **to save my current search (filters + keywords + sort) with a name, see it in a sidebar list, and re-run it with one click**,
So that **I don't have to re-enter the same filter combinations every time**.

## Acceptance Criteria

**Given** the saved searches feature
**When** a user has staged a search they want to save
**Then** there is a "Save search" affordance that opens a naming prompt
**And** the user enters a free-text name
**And** the current filter + keyword + sort state is serialized to JSONB
**And** a `POST /api/search/saved/` creates the saved search

**Given** the saved searches list
**When** the user opens the filter sidebar
**Then** a "Saved searches" section lists all saved searches by name
**And** clicking a saved search re-runs it (one click = one query = counted toward daily limit)

**Given** search management
**When** the user right-clicks or uses the action menu on a saved search
**Then** they can rename or delete the saved search
**And** renaming does not re-run the query

**Given** cap enforcement
**When** a free user has 5 saved searches
**Then** the "Save" affordance is disabled with a tooltip: "Free tier limit: 5 saved searches"
**And** for Starter users the limit is 25

**Given** persistence across sessions and locales
**When** the user logs out and back in
**Then** all saved searches are available
**And** when the user switches locale, saved searches persist (filters still work; display names don't localize)

**Given** the saved search API
**When** I inspect the endpoints
**Then** the following exist:
- `POST /api/search/saved/` — create
- `GET /api/search/saved/` — list
- `PUT /api/search/saved/{id}/` — update (rename, filters)
- `DELETE /api/search/saved/{id}/` — delete
**And** saved search data is stored in the `saved_searches` table with user_id, name, type (people/company), filters (JSONB), sort (JSONB), created_at, updated_at

**Given** empty state
**When** no saved searches exist
**Then** a one-line hint is shown: "Save a search to reuse it later"

## Tasks / Subtasks

- [x] **Task 1: Backend — `SavedSearch` model + migration** (AC: saved_searches table; AD-3)
  - [x] 1.1 RED: `backend/apps/search/tests/test_saved_search.py` — NEW — model tests: fields exist (`user`, `name`, `type`, `filters` default `{}`, `sort` null-able, `created_at`, `updated_at`); `type` choices exactly `people`/`company` (values, not the AC phrase "people/company" — the spine DDL CHECK and the epic AC agree on the singular values); `db_table == 'saved_searches'`; `updated_at` bumps on save; CASCADE delete when the user is deleted (mirror the DailyUsage pattern); `__str__` renders the name.
  - [x] 1.2 RED: `backend/apps/search/tests/test_migrations.py` — UPDATE — a `saved_searches` table exists in the applied schema (migration 0005) with columns `user_id, name, type, filters, sort, created_at, updated_at` (the 3.1 migration-test precedent).
  - [x] 1.3 GREEN: `backend/apps/search/models.py` — UPDATE — `SavedSearch` (UUID pk default `uuid.uuid4`, user FK `settings.AUTH_USER_MODEL` on_delete CASCADE related_name `saved_searches`, `name` TextField, `type` CharField with choices `[('people','people'),('company','company')]`, `filters` JSONField default dict, `sort` JSONField null/blank, `created_at` `auto_now_add`, `updated_at` `auto_now`; `Meta.db_table = 'saved_searches'`). Run `makemigrations search` → `0005_savedsearch.py` (verify no model drift in the migration test).
  - [x] 1.4 `backend/apps/search/admin.py` — UPDATE — register `SavedSearch` READ-ONLY for support (spine project-structure note: "SavedSearches (read-only for support)"): `readonly_fields` all, `list_display = ('user', 'name', 'type', 'created_at')`.
  - [x] 1.5 `backend/tasks/maintenance_tasks.py` — VERIFY — `('search', 'SavedSearch')` is ALREADY in `DEPENDENT_MODELS` (confirmed — no change needed; the hard-delete path now has its real model).
  - [x] 1.6 Run backend gates (pytest/ruff/mypy) — green.

- [x] **Task 2: Backend — saved-searches API endpoints + caps** (AC: 4 endpoints, user-scoping, 404 on foreign rows, cap enforcement)
  - [x] 2.1 RED: `backend/apps/search/tests/test_saved_search_api.py` — NEW — suite (all authenticated via the `search_session` fixture pattern from test_people_search — login + cookie; `pytestmark = pytest.mark.django_db`):
    - **create**: POST `/api/search/saved/` `{name, type: 'people', filters: {...}, sort: {field,dir}}` → 201 with the saved row (id, name, type, filters round-tripped EXACTLY, sort round-tripped EXACTLY); saved to the AUTHENTICATED user (`user_id` = request user).
    - **create validation**: missing name → 400 (code `invalid`/field error); blank/whitespace-only name → 400; name > 100 chars → 400; bad type → 400; missing filters → 400; non-object filters → 400; non-object sort → 400.
    - **cap enforcement**: free user with 5 rows → POST → 400 with `code == 'saved_search_limit_exceeded'` and a `limit` field = 5 (NO row created); starter user with 25 rows → 400 limit=25; starter with 24 rows → 201; free with 4 rows → 201 (boundary — exactly at cap fails, one below passes). Cap message localized via `_locale(request.user)` (mirror `_quota_error`).
    - **list**: GET `/api/search/saved/` → 200 array ordered `-created_at`; ONLY the authenticated user's rows (a second user's rows absent); rows include name/type/filters/sort/created_at.
    - **rename-without-re-run**: PUT `/api/search/saved/{id}/` `{name: 'new'}` → 200, name changed, filters/sort UNCHANGED, NO search-count increment (DailyUsage for today stays 0 — the AC's "renaming does not re-run the query" and the FR-7 interplay).
    - **update**: PUT with `filters`/`sort` also allowed (endpoint contract "update (rename, filters)"); partial update (only the sent fields change).
    - **404 on foreign rows**: user B PUT/DELETE on user A's saved search → 404 (not 403 — AC literal); unknown id → 404.
    - **delete**: DELETE → 204, row gone from the DB and from a follow-up GET.
    - **auth**: unauthenticated POST/GET/PUT/DELETE → 401 (default `IsAuthenticated` — the settings base.py default).
  - [x] 2.2 GREEN: `backend/apps/search/quota.py` — UPDATE — `SAVED_SEARCH_CAPS: dict[str, int] = {'free': 5, 'starter': 25}` + `saved_search_limit_for(user)` (tier→cap, unknown tier falls back to free — the daily-limit precedent) + `SAVED_SEARCH_LIMIT_MESSAGES` ×3 locales with `{limit}` (the AC literal "Free tier limit: 5 saved searches" — localized; Western digits in the interpolated `{limit}`).
  - [x] 2.3 GREEN: `backend/apps/search/serializers.py` — UPDATE — `SavedSearchSerializer` (ModelSerializer): `name` required, `max_length=100`, trimmed (strip, reject blank); `type` choices; `filters` JSONObject (required); `sort` JSONObject allow-null; read-only `id`, `user`, `created_at`, `updated_at`.
  - [x] 2.4 GREEN: `backend/apps/search/views.py` — UPDATE — `SavedSearchListView` (POST create: validate → cap check BEFORE create (`saved_search_limit_for(user)`; at/over cap → 400 `{'detail': <localized>, 'code': 'saved_search_limit_exceeded', 'limit': n}`); GET list `-created_at` user-scoped) + `SavedSearchDetailView` (PUT partial update name/filters/sort — `get_object_or_404` scoped to `user_id=request.user`; DELETE → 204). Both user-scoped by construction — no cross-user access paths.
  - [x] 2.5 GREEN: `backend/apps/search/urls.py` — UPDATE — `path('saved/', ...)`, `path('saved/<uuid:pk>/', ...)` (the /api prefix lives in config/urls.py — NEVER add it here — the c5f5709 double-prefix lesson applies to the FRONTEND service, but the same "prefix-relative only" rule holds).
  - [x] 2.6 Run backend gates (pytest/ruff/mypy) — green.

- [ ] **Task 3: Frontend — SavedSearchService + query key factory + validation schema** (AD-19, AD-21, AD-18)
  - [x] 3.1 RED: `frontend/src/__tests__/saved-search-service.test.ts` — NEW — service methods hit prefix-relative paths with the shared client (`baseURL` /api): `list()` → GET `/search/saved/`; `create(payload)` → POST `/search/saved/` with the body; `rename(id, name)` → PUT `/search/saved/{id}/`; `remove(id)` → DELETE. PLUS a real-URL guard (the c5f5709 precedent — a real axios adapter + getUri asserting the merged URL is `/api/search/saved/...` and never `/api/api/...`).
  - [x] 3.2 GREEN: `frontend/src/lib/api/saved-search-service.ts` — NEW — types: `SavedSearchType = 'people' | 'company'`; `SavedSearchSort = { field: string; dir: 'asc' | 'desc' | null }`; `SavedSearchRow = { id: string; name: string; type: SavedSearchType; filters: Record<string, unknown>; sort: SavedSearchSort | null; created_at: string; updated_at: string }`; `SavedSearchPayload = { name: string; type: SavedSearchType; filters: Record<string, unknown>; sort: SavedSearchSort | null }`; `SavedSearchService extends HttpClient` with `list()`, `create(payload)`, `rename(id, name)`, `remove(id)`; export a singleton `savedSearchService`.
  - [x] 3.3 GREEN: `frontend/src/lib/queryKeys/savedSearches.ts` — NEW — factory (the searchKeys pattern): `{ all: ['saved-searches'] as const, list: ['saved-searches', 'list'] as const, detail: (id: string) => ['saved-searches', id] as const }`. NEVER inline arrays (AD-21).
  - [x] 3.4 RED+GREEN: `frontend/src/lib/validation/saved-search.ts` — NEW — zod schema per AD-18: `name`: trimmed, min 1, max 100 (mirror the backend `max_length=100`); error messages are next-intl message KEYS (`common.errors.required` / `search.saved.name_too_long` — check existing key availability at dev time; add ×3 if missing); `z.infer` type export.
  - [x] 3.5 Frontend gates (test/lint/typecheck/check:i18n) — green.

- [ ] **Task 4: Frontend — useSavedSearches + useSavedSearchMutations hooks** (AD-21 — the FIRST real mutation consumers; the conventions section says "the first real mutation lands with Story 3.6")
  - [x] 4.1 RED: `frontend/src/__tests__/saved-search-hooks.test.tsx` — NEW — via `renderHook` inside `QueryClientProvider` (fresh client per test) with `savedSearchService` mocked:
    - **useSavedSearches**: list query fires on mount (enabled gating — `enabled: user !== null` where `user` comes from `useSession()`; when guest → NO fetch, phase `'idle'` NOT loading — the AD-21 "disabled queries must not read as loading" rule); success → `savedSearches` rows + phase `'success'`; error → phase `'error'` + a retry action (`refetch`); `fetching` surfaced for background refetches (all four states handled — loading/error/empty/fetching).
    - **useSavedSearchMutations**: `create` success → invalidates `savedSearchesKeys.list` (assert via a spy on `queryClient.invalidateQueries` or a re-render of a list consumer showing the new row); `rename` success → invalidates; `remove` success → invalidates; mutation error surfaces (400 `saved_search_limit_exceeded` maps to a typed result the caller can render — e.g. `{ ok: false, code, limit }` vs throw — decide at dev time, document the shape; the cap race (two tabs) is handled client-side by disabling at count ≥ cap AND server-side by the 400).
    - **cache tuning**: the list query carries an explicit `staleTime` (rationale recorded in the hook — see Dev Notes decision 8) and NO `placeholderData`.
  - [x] 4.2 GREEN: `frontend/src/hooks/useSavedSearches.ts` — NEW — `useSavedSearches({ user })`: `useQuery({ queryKey: savedSearchesKeys.list, queryFn: () => savedSearchService.list(), enabled: user !== null, staleTime: 60_000 })`; explicit return type `{ savedSearches: SavedSearchRow[]; phase: 'idle' | 'loading' | 'error' | 'success'; refetch: () => void }`; phase derivation must require `user !== null` (disabled-not-loading rule).
  - [x] 4.3 GREEN: `frontend/src/hooks/useSavedSearchMutations.ts` — NEW — `useSavedSearchMutations()`: `create`/`rename`/`remove` `useMutation`s, each with `onSuccess: () => void queryClient.invalidateQueries({ queryKey: savedSearchesKeys.list })` (factory keys ONLY — AD-21); `remove` also invalidates via the same list key (there is no per-detail query in V1); explicit return types; error narrowing: export a guard `isSavedSearchLimitError(error)` (response status 400 + `data.code === 'saved_search_limit_exceeded'`, mirrors `isRateLimitError`) so the consumer can render the cap message.
  - [x] 4.4 Frontend gates — green.

- [ ] **Task 5: Frontend — SavedSearchesList + name dialog + action menu — TDD** (ACs: list, re-run, rename/delete, cap tooltip, empty hint; D1–D5; UX-DR22)
  - [x] 5.1 RED: `frontend/src/__tests__/saved-searches-list.test.tsx` — NEW — render `<SavedSearchesList ...>` wrapped in QueryClientProvider + SessionProvider mocks; mock `savedSearchService` + `useSession` (`tier: 'free'`). Suite (assert i18n KEYS never values):
    - **section**: `search.saved.title` heading; list ordered as returned (server order preserved).
    - **rows**: one row per saved search — the NAME renders as a button (one-click re-run affordance — keyboard focusable); row `min-h-11 md:min-h-8` (44px touch target — UX-DR22).
    - **re-run**: click a row → `onRerun(savedSearch)` called with the FULL row (id/type/filters/sort) — SearchPage owns the actual re-run (thin-wrapper rule — AD-21 orchestration lives in the consumer).
    - **action menu**: per-row trigger (`aria-label` = `search.saved.actions` or per-item labels) opens the dropdown-menu; menu items Rename + Delete (labels via keys); keyboard: trigger focusable, menu items reachable via keyboard (Base UI Menu handles the model — assert the trigger opens the menu on Enter/Space).
    - **rename**: click Rename → `onRenameRequest(row)` (SearchPage-agnostic: the LIST renders the dialog — decide: dialog owned by the list component, rename mutation called there; test asserts the dialog opens prefilled with the current name and the mutation fires with the new name on confirm) — NO re-run side effect (no `onRerun` call, no searchService search call — rename does not re-run).
    - **delete**: click Delete → confirm dialog with `search.saved.delete_confirm` → confirm → `remove` mutation called; cancel → no call. Delete never fires a search.
    - **cap tooltip (disabled-but-actionable)**: 5 rows + tier free → Save affordance `aria-disabled` (still FOCUSABLE — keyboard reachable) + tooltip content = `search.saved.cap_tooltip` (interpolated with String(limit) — assert no raw-number interpolation, AD-8); 4 rows → enabled. Starter: 25 rows + tier starter → disabled; 24 → enabled. NO active search (`onSave` unavailable — `activeSearch === null`) → disabled WITHOUT the cap tooltip.
    - **empty state**: 0 rows → one-line hint `search.saved.empty` (amended AC literal value — asserted by KEY only per convention) + the Save affordance still visible (points at the save affordance per EXPERIENCE empty-saved-searches row).
    - **loading/error**: list loading → `common.states.loading` (or skeleton rows); error → inline error + retry (the AD-21 explicit-state rule); fetching (background) → no loading flash (fetching != loading).
    - **names not localized**: row text = the RAW stored name (a fixture name like "فقط في الجزائر" renders verbatim — no translation lookup; the test asserts the exact string).
    - **RTL smoke**: no physical-property classes in the list markup.
    - **a11y**: menu trigger + row buttons `min-h-11 md:min-h-8`; dialog (create + rename) traps focus and returns focus to the trigger on close (the 3.3 drawer focus-return precedent — Base UI Dialog handles the trap; assert focus lands back on the trigger after close).
  - [x] 5.2 RED: `frontend/src/__tests__/saved-search-name-dialog.test.tsx` — NEW — the naming prompt (create + rename modes): opens with `search.saved.name_label` + `name_placeholder`; empty/whitespace submit → inline validation error (`common.errors.required` key); > 100 chars → `search.saved.name_too_long`; valid submit → `onSubmit(name)` with the trimmed value; server 400 (cap race) → error rendered via RHF `setError` root (`search.saved.max_capacity` — the EXISTING key) — AD-18 server-error merge; cancel → `onClose` without submit; `aria-invalid`/`aria-describedby` wiring per AD-18.
  - [x] 5.3 GREEN: `frontend/src/components/search/SavedSearchNameDialog.tsx` — NEW — stock base-nova `dialog` (registry add Task 6) + RHF+zod (`zodResolver` + the `saved-search.ts` schema — AD-18); props `{ open, mode: 'create' | 'rename', initialName?, onClose, onSubmit }`; the CREATE dialog title = `search.saved.save`, rename = `search.saved.rename_title`; buttons `common.actions.cancel` / `common.actions.save`; `min-h-11 md:min-h-8` targets; logical CSS only; tokens only.
  - [x] 5.4 GREEN: `frontend/src/components/search/SavedSearchesList.tsx` — NEW — consumes `useSavedSearches({ user })` + `useSavedSearchMutations()`; props `{ tab, activeSearchId: string | null, onRerun: (row: SavedSearchRow) => void }`; section header: `search.saved.title` + Save affordance (`search.saved.save`) wired to the create dialog; Save disabled-but-actionable states: at cap (tooltip via the stock `tooltip` — already installed) / no active search (plain disabled, no tooltip — the user hasn't run a search yet, the affordance has nothing to save); rows: name button + dropdown-menu (stock base-nova `dropdown-menu` registry add Task 6) with Rename/Delete; rename → dialog prefilled; delete → confirm dialog (`search.saved.delete_confirm`) → remove mutation; the ACTIVE saved search (id === activeSearchId) carries `bg-muted` + `aria-current="true"`; empty → `search.saved.empty` hint. The component owns its dialogs (create/rename/delete) and mutations — SearchPage only supplies `tab`, `activeSearchId`, `onRerun` + the session user.
  - [x] 5.5 Frontend gates — green.

- [ ] **Task 6: Registry adds — stock base-nova `dialog` + `dropdown-menu`** (authorized; ZERO new npm packages — both are Base UI; @base-ui/react ^1.6.0 installed; registry-verified 2026-08-06)
  - [x] 6.1 From `frontend/`: `npx shadcn@latest add dialog dropdown-menu` (base-nova style — the 3.5 table/skeleton precedent). Verify: generated files compile; the registry `IconPlaceholder` resolves to lucide (`XIcon` → `XIcon` from lucide-react — the 3.5 CLI resolution precedent); `cn-menu-target`/`cn-*` tokens map to the project theme (3.5 registry-token precedent).
  - [x] 6.2 Do NOT hand-edit the registry files (3.4/3.5 rule — usage-site token overrides only). Dialog surface tokens come from the stock class list (`bg-popover rounded-xl ring-foreground/10 p-4 sm:max-w-sm` etc.); override at the usage site via `cn` if a token must change.
  - [x] 6.3 Frontend gates — green.

- [ ] **Task 7: SearchPage + FilterSidebar integration — TDD** (ACs: save affordance on the active search, sidebar list, re-run = one counted query, wilaya/sort restore, badge normalization verify; D3, D6; component tree FilterSidebar > SavedSearchesList)
  - [x] 7.1 RED: `frontend/src/__tests__/search-page-saved-searches.test.tsx` — NEW — SearchPage-level suite (the renderPage helper with a fresh QueryClient per test — the 3.5 precedent); mock `savedSearchService` + `searchService`:
    - **save captures the active search**: run a search (Apply) → the Save affordance is ENABLED and `create` is called with `{ name, type: 'people', filters: <the EXACT buildFiltersPayload JSON of the submitted filters incl. wilayas>, sort: <the current SortState or null> }` — the D6 shape contract.
    - **save before any search**: no Apply yet → Save disabled (no active search) and clicking it does nothing.
    - **re-run restores everything**: a saved row with filters `{industry: [2], wilaya: [31], keyword: 'textile'}` + sort `{field:'role', dir:'desc'}` — click the row → (a) `searchPeople` called exactly ONCE with `filters` JSON matching buildFiltersPayload(restored) + `sort='role:desc'` (one click = one query); (b) the wilaya combobox chips show `31` (SearchPage `wilayas` state restored) and the sidebar badge counts it ONCE (the 3.5 normalization: `countActiveFilters({...draft, wilayas: []}) + wilayaCount` — re-run must NOT double-count — verify with a test); (c) after success, `applied` carries stable identity and the results table renders the sort chevron + `aria-sort="descending"` on the role column; (d) chips row shows the restored filters.
    - **re-run payload identity**: `filtersPayloadToStaged(buildFiltersPayload(staged, tab))` deep-equals `staged` (both tabs) — the JSONB round-trip unit test; and re-running a stored payload produces a `searchPeople` call with the IDENTICAL filters JSON string (re-serialization is stable).
    - **re-run per-tab filtering**: only saved searches matching the CURRENT tab are listed (people tab shows people-type rows only); a companies-type row is NOT rendered on the people page.
    - **re-run does not re-run on rename**: rename a saved search → zero additional `searchPeople` calls.
    - **active indicator**: after a re-run succeeds, the re-run row carries `aria-current="true"` (activeSearchId wiring).
    - **type mismatch guard**: the current tab list filters by type — no cross-tab click path exists.
  - [x] 7.2 RED: `frontend/src/__tests__/filter-sidebar.test.tsx` — UPDATE — optional `savedSearchesSlot?: ReactNode` prop: renders the slot inside the aside (below the filter groups, above the Apply block) AND inside the drawer (below groups, above the footer) — dual-instance precedent (the wilayaField pattern); when unwired, nothing renders (backward compatible — existing tests untouched).
  - [x] 7.3 GREEN: `frontend/src/lib/api/search-service.ts` — UPDATE — NEW pure helper `filtersPayloadToStaged(payload: Record<string, unknown>, tab: SearchTab): StagedFilters` — the INVERSE of `buildFiltersPayload` (reads industry/wilaya/seniority/size/keyword/include_unknown_size per tab; unknown/missing keys → empty defaults — a defensive contract for forward-incompatible payloads); unit tests in `search-service.test.ts` (round-trip identity both tabs + empty payload).
  - [x] 7.4 GREEN: `frontend/src/components/search/FilterSidebar.tsx` — UPDATE — optional `savedSearchesSlot?: ReactNode` rendered in the aside + drawer (the wilayaField dual-mount precedent — same element, two mounts).
  - [x] 7.5 GREEN: `frontend/src/components/search/SearchPage.tsx` — UPDATE — derive `activeSearch` = the current submitted/applied state (`{ type: tab, filters: buildFiltersPayload(applied-with-wilayas, tab), sort }` — present only when `applied !== null`); `handleSaveSearch(name)` → `createSavedSearch({ name, type: tab, filters: activeSearch.filters, sort: activeSearch.sort })`; `handleRerun(row)` → `filtersPayloadToStaged(row.filters, row.type)` → `setWilayas(staged.wilayas)` + `setWilayaQuery('')` + `setSort(row.sort)` + `setChipRemove(null)` + `runSearch(staged)` (the EXISTING runSearch path — one counted query via useSearchResults, NEVER a direct searchService call — D3); `activeSearchId` = the row whose type+filters+sort match the current applied (or track the id in a state set on re-run success — decide at dev time, test the indicator). Renders `<SavedSearchesList tab={tab} activeSearchId={...} onRerun={handleRerun} />` and passes it to FilterSidebar via `savedSearchesSlot`; ALSO wire `onSaved` (create success) → if the saved search equals the active search, no page change (list refreshes via invalidation).
  - [x] 7.6 Frontend gates — green.

- [ ] **Task 8: i18n keys ×3 locales** (AC literals; AD-8 — Western digits ONLY via `String()` in interpolations)
  - [x] 8.1 `frontend/messages/en.json` — UPDATE — AMEND `search.saved.empty` value → "Save a search to reuse it later" (AC literal — the 3.5 empty-amend precedent). NEW keys:
    - `search.saved.cap_tooltip`: "Free tier limit: {limit} saved searches" — the AC literal; `{limit}` interpolated with `String(limit)` (AD-8); used for BOTH tiers via `{tier}` — decide ONE key with `{tier, limit}` vs two keys at dev time; if one key: "Free tier limit: {limit} saved searches" needs a Starter variant — prefer `search.saved.cap_tooltip_free` + `search.saved.cap_tooltip_starter` (exact AC literal for free; starter mirrors).
    - `search.saved.rename_title`: "Rename saved search" — rename dialog title
    - `search.saved.name_label`: "Name" — dialog input label
    - `search.saved.name_too_long`: "Name must be 100 characters or fewer" — zod max-length message
    - `search.saved.rename`: "Rename" — action-menu item (REUSE `common.actions.edit` if it fits — decide at dev time; prefer reuse)
    - `search.saved.delete`: "Delete" — action-menu item (REUSE `common.actions.delete` — exists — prefer reuse)
    - `search.saved.actions`: "Saved search actions" — menu trigger aria-label (or per-item labels)
    - `search.saved.no_active_search` (only if the disabled Save needs an explanation — optional; decide with the UX notes)
    - REUSE (no new keys): `search.saved.title` ("Saved Searches"), `search.saved.save` ("Save Current Search"), `search.saved.name_placeholder` ("Name this search..."), `search.saved.delete_confirm` ("Delete this saved search?"), `search.saved.max_capacity` ("You have reached the saved search limit"), `common.actions.save/cancel/confirm/close/delete/edit`.
  - [x] 8.2 Mirror ALL changes in `fr.json` + `ar.json` (Arabic: no uppercase transforms; Western digits in `{limit}` interpolation only — AD-8). `npm.cmd run check:i18n` must pass (en = source of truth; identical key counts ×3).
  - [x] 8.3 Verify the `i18n-shape.test.ts` suite still resolves every NEW key ×3.

- [ ] **Task 9: Verification gates + story sync** (all ACs)
  - [x] 9.1 Frontend (from `frontend/`): `npm.cmd test` all green (369 baseline + new), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (×3 locales).
  - [x] 9.2 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` green (359 baseline + new), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0.
  - [x] 9.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-6 → in-progress → review; epic-3 stays in-progress). Commit as `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.

## Dev Notes

### Decided constraints (confirmed with Sally — UX designer consultation 2026-08-06)

- **D1 — naming prompt surface**: STOCK base-nova `dialog` registry component (registry-verified 2026-08-06 — Base UI Dialog, registry dependency `button` only → ZERO new npm packages; built-in focus trap + focus return per the 3.3 drawer precedent). NO inline editing. **Form pattern: react-hook-form + zod per AD-18** (the stack is installed + proven in 2.x auth; AD-18 binds "every form in the product"; a one-field naming prompt with required/max-length validation is a form) — schema in `lib/validation/saved-search.ts` with next-intl-key messages; server 400s (the cap race) merge via RHF `setError` root. Decided over a plain controlled input: consistent validation UX + aria-invalid/describedby wiring + server-error merging for free.
- **D2 — sidebar list + action menu**: STOCK base-nova `dropdown-menu` registry component (registry-verified 2026-08-06 — Base UI Menu, no registry deps → ZERO new npm packages; keyboard model + focus management built in). Per-row: the NAME is a real button (one-click re-run — primary affordance) + a kebab trigger (MoreVertical icon, `aria-label` localized) opening Rename/Delete. Touch targets: rows + menu trigger `min-h-11 md:min-h-8` (UX-DR22 44px). Delete → confirm dialog (`search.saved.delete_confirm` — destructive action gets a confirm, never instant).
- **D3 — re-run semantics**: restore filters + wilayas + sort into SearchPage state and fire through the EXISTING `runSearch` path (one click = one query = counted — FR-7). NEVER a direct searchService call from the list. Concretely: `filtersPayloadToStaged(row.filters, row.type)` → `setWilayas(staged.wilayas)` (combobox chips + badge restore) + `setSort(row.sort)` (chevron + aria-sort restore) + `runSearch(staged)`. The 3.5 badge normalization (`countActiveFilters({...draft, wilayas: []}) + wilayaCount`) is ALREADY safe for restored `applied.wilayas` — verify with a dedicated test (Task 7.1(b)). The dirty-guard resync (3.5) is untouched: a re-run that lands while the user staged edits must not clobber them — the dirty-guard already covers it (re-run sets `applied` on success; draft resyncs only when untouched). Per-tab scoping: the list shows ONLY rows whose `type` matches the current tab — no cross-tab navigation surprise; re-run NEVER switches tabs.
- **D4 — cap enforcement UX**: Save affordance `aria-disabled` (stays FOCUSABLE + keyboard-reachable) with a tooltip at cap — the disabled-but-actionable pattern (reveal-button 0-credit precedent: "aria-disabled button (stays focusable) + explanatory tooltip"). Tooltip content = the tier-specific cap message (`search.saved.cap_tooltip_free` "Free tier limit: 5 saved searches" / starter variant; `{limit}` via `String(limit)` — AD-8). Two disable reasons: (a) AT CAP — aria-disabled + tooltip; (b) NO ACTIVE SEARCH (nothing applied yet — nothing to save) — plain native `disabled`, no tooltip. Frontend cap = `tier === 'starter' ? 25 : 5` from `SessionUser.tier`; the BACKEND enforces the same caps (400 `saved_search_limit_exceeded` + `limit`) — defense in depth, and the frontend disable is optimistic (a second tab can hit the cap first).
- **D5 — empty state + list behavior**: empty → the ONE-LINE hint per the AC literal ("Save a search to reuse it later" — AMEND the existing `search.saved.empty` value ×3, the 3.5 empty-amend precedent). Display names NEVER localized (raw free-text names render verbatim — locale switches don't touch them; filters/sort are DATA (codes + ids), not labels → re-runs work identically in every locale — FR-8 persistence AC). The ACTIVE saved search (the one whose results are on screen — `activeSearchId`) carries `bg-muted` + `aria-current="true"`; clicking it still re-runs (one counted query — the AC literal "clicking a saved search re-runs it" applies to the active one too). Mobile: the section renders in BOTH the aside AND the drawer (the `wilayaField` dual-mount precedent — same React element, two mounts; query cache dedupes the fetch; mutations invalidate the shared key) — saved searches must be reachable on mobile where the aside is hidden.
- **D6 — JSONB round-trip shape**: `filters` = EXACTLY the `buildFiltersPayload(filters, tab)` JSON (the same object the search endpoint receives as its `filters` param). Re-run = `filtersPayloadToStaged` (inverse helper) → `runSearch(staged)` → `buildFiltersPayload` re-serializes → byte-identical payload (unit-test the identity: payload→staged→payload, both tabs). `sort` = `{ field, dir: 'asc' | 'desc' | null }` or `null` when the user never sorted — re-run restores `SortState` → the 3.5 header chevron + `aria-sort` round-trip correctly (test (c) in Task 7.1). A `null` sort re-runs with the server default `name:asc` (the 3.5 default-sort contract — honest "no user sort" header state).
- **What "Save" captures**: the ACTIVE search = the last SUCCESSFULLY APPLIED filters (SearchPage `applied`, including the merged `wilayas`) + current `sort` + `tab`. NOT the staged draft (the draft may be mid-edit; "save current search" = the search that produced the visible results — EXPERIENCE save-affordance wording). Save disabled until the first successful Apply.

### PM consultation (John — 2026-08-06) — caps + naming product rules

- **Caps ASSUMPTION (PRD Open Q2) CONFIRMED**: 5 free / 25 Starter are the V1 limits — no product change. The frontend tier source is `SessionUser.tier`; the backend enforces `SAVED_SEARCH_CAPS = {'free': 5, 'starter': 25}` (unknown tiers fall back to free — the 3.2 daily-limit precedent).
- **Naming rules**: free-text, TRIMMED, non-empty, ≤ 100 chars; **duplicate names ALLOWED** (names are labels, not identifiers — no dedupe); names are never localized, never auto-translated; rename does not re-run (AC) and does not touch filters/sort.
- **Persistence**: saved searches are backend-owned rows — they survive logout/login and locale switches by construction. Locale switch never re-runs a query (EXPERIENCE locale-switcher rule) — the list just re-renders with the same raw names.

### Architect consultation (Winston — 2026-08-06) — backend API design

- **Model**: `SavedSearch` in `apps/search/models.py` per the spine DDL (saved_searches: UUID pk, user FK CASCADE, name TEXT NOT NULL, type TEXT CHECK IN ('people','company') — the SINGULAR values, matching the epic AC "type (people/company)" and the spine DDL; filters JSONB NOT NULL, sort JSONB NULL, created_at/updated_at). Migration `0005_savedsearch`. `maintenance_tasks.py` already lists `('search', 'SavedSearch')` — the hard-delete path works once the model exists (verify only). Admin registered READ-ONLY (spine structure note).
- **Endpoints** (user-scoped by construction — `get_object_or_404` filtered on `user_id=request.user` → foreign rows are 404, the AC literal; never 403):
  - `POST /api/search/saved/` — create; validate → cap check BEFORE insert (`saved_search_limit_for(user)`; at/over cap → 400 `{detail: <localized>, code: 'saved_search_limit_exceeded', limit}`) → 201.
  - `GET /api/search/saved/` — list, `-created_at`, user-scoped only.
  - `PUT /api/search/saved/{id}/` — partial update (name / filters / sort); rename = name-only update, NO search-count increment (the endpoint never touches `daily_usage` — re-runs count via the SEARCH views; failed queries still not counted, Q8 unchanged).
  - `DELETE /api/search/saved/{id}/` — 204.
  - JSONB serialization: `filters` stored as the request payload object verbatim (the search-endpoint `filters` param shape); `sort` as `{field, dir}` or null. No cap on `filters` size beyond DRF's default — the 3.2 `MAX_FILTERS_LENGTH` payload cap is a SEARCH-endpoint concern; a saved search stores what a user could already submit (same validation: serialize via the same `parse_filters` validation on RE-RUN — re-runs go through the search endpoint which re-validates; a forward-incompatible stored payload yields the search endpoint's normal 400 — the frontend defensive `filtersPayloadToStaged` defaults handle it).
  - Caps constants + localized messages in `quota.py` (the tier-limits home — mirrors `SEARCH_DAILY_LIMITS`).
- **No quota interplay changes**: saved-search CRUD never increments `daily_usage`; only re-runs (search views) count; 429 on re-run renders the EXISTING rate-limit UX (the search hook's `rate_limited` phase — nothing new to build).

### Existing patterns to follow (from 3-2/3-3/3-4/3-5 precedents)

- Component + test layout: client components in `frontend/src/components/search/`, tests in `frontend/src/__tests__/<name>.test.tsx`; pure helpers exported from the component module for unit tests.
- AD-21 structure (BINDING — 3.6 is the FIRST story with real `useMutation` consumers): feature query hook `hooks/useSavedSearches.ts` + mutation hook `hooks/useSavedSearchMutations.ts`; key factory `lib/queryKeys/savedSearches.ts`; components consume ONLY the hooks; strong typing everywhere; `enabled` gating (guest → no fetch, phase idle not loading); all four states explicit (loading/error/empty/fetching); NO `placeholderData`; cache tuning with rationale; invalidation ONLY via factory keys.
- Tests: vitest + jsdom; `src/test/setup.ts` imports `mocks.ts` (next-intl `useTranslations` returns the KEY, `useLocale` → 'en'; `useLocale` is a vi.fn — AR-locale render tests override it); assert message KEYS never values; `fireEvent`; jest-dom matchers; QueryClientProvider wrapper with a FRESH client per test (the 3.5 renderPage precedent); `renderHook` for hook tests (AD-21 checklist step 5).
- Backend tests: `pytest.mark.django_db`; the `search_session` fixture (login via `/api/auth/login/` — cookie auth — the test_people_search precedent); `api_client` from conftest.
- i18n (AD-8): Western Arabic numerals ONLY in interpolations — `String(limit)`, never a raw number (the 3.4 wilaya_more lesson). `check:i18n` = en source of truth, identical key counts ×3; `i18n-shape.test.ts` asserts every rendered key resolves ×3.
- Design tokens (AD-2/AD-9): `bg-card`/`bg-muted`/`border-border`/`text-title`/`text-small`/`text-caption`/`text-muted-foreground`/`text-primary`/`rounded-lg`/`rounded-full`; logical CSS ONLY in our components; `rtl:rotate-180` for direction-mirroring icons; 44px touch targets `<md` (UX-DR22): `min-h-11 md:min-h-8`; focus-visible rings on interactive elements; no code comments unless necessary.
- Registry: `npx shadcn@latest add dialog dropdown-menu` (base-nova); NEVER hand-edit registry files; usage-site token overrides only (twMerge).
- RTL (FR-2): visual flip via `dir` + logical CSS; DOM order never changes; test asserts no physical classes in our markup.
- Commit style: `Story 3.6: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push. Windows/PowerShell: no `&&`; chain with `;` / `if ($?) {}`; `npm.cmd`; backend venv `backend\.venv\Scripts\`.
- Checkboxes stay unchecked until dev executes them — tasks above are the live checklist.

### Implementation notes

- `filtersPayloadToStaged(payload, tab)`: reads `industry`/`wilaya`/`seniority`/`size`/`keyword`/`include_unknown_size` per tab (people: industry/wilaya/seniority/keyword; companies: industry/wilaya/size/keyword/include_unknown_size); coerce numbers (`Number(...)`), arrays (`Array.isArray` filter numbers), booleans, keyword string; MISSING/unknown keys → the EMPTY defaults (defensive — a stored payload is always well-formed, but a future schema change must degrade to an empty search, never a crash). Round-trip identity test: `filtersPayloadToStaged(buildFiltersPayload(s, tab), tab)` deep-equals `s` (both tabs, incl. wilayas + keyword).
- `SavedSearchesList` props: `{ tab, activeSearchId, onRerun }` — it pulls `useSession()` for `user` (enabled gating) + tier (cap disable). SearchPage supplies `onRerun` (thin wrapper: wilaya restore + sort restore + runSearch) — orchestration lives in the consumer (AD-21).
- The active-search id: SearchPage tracks `activeSavedId` — set to the row id when a re-run succeeds (or when a saved search's payload matches the applied state — decide the simpler match at dev time; the `aria-current` test is the contract).
- Dialog reuse: ONE `SavedSearchNameDialog` component with a `mode` prop ('create' | 'rename') — create is prefilled empty, rename prefilled with the current name; the confirm button label is shared (`common.actions.save`); the delete confirm can reuse the SAME dialog shell in a minimal variant or a plain second dialog — decide at dev time (one component, two modes, is the preferred shape).
- Cap race UX: if the backend 400s with `saved_search_limit_exceeded` on create (two tabs / stale list), render `search.saved.max_capacity` as the dialog's root error (RHF `setError` root) — the user sees "You have reached the saved search limit" instead of a silent failure.
- The list in the drawer: rendered below `renderGroups('drawer')` inside the scrollable area — the drawer may get tall; the list section stays compact (rows + hint only). No collapsible needed in V1 (≤25 rows).
- Session mocking in list tests: the existing mocks mock `@/lib/api/auth-service`; `useSession` must return a `{ user: { tier: 'free' | 'starter' } }`-shaped value — check the SessionProvider context shape at dev time and mock the hook or provider accordingly (the 3.5 providers-query test precedent).
- Backend PUT: partial update via the serializer's partial=True; name-only rename path must NOT touch filters/sort. Validate `type` is immutable on update (reject type changes with 400 or silently ignore — decide: REJECT, the type is the tab binding).
- `uuid` pk URLs: `<uuid:pk>` converter; a non-UUID id → 404 (DRF handles the converter; test the malformed-id case).

### Gotchas

- `aria-disabled` vs native `disabled`: at-cap Save stays FOCUSABLE (aria-disabled) so the tooltip is keyboard-reachable; no-active-search Save is natively disabled. The stock `tooltip` (Base UI) wraps the trigger — verify hover/focus-open behavior on an aria-disabled trigger in tests (or wrap the trigger in a span — the Base UI Tooltip docs pattern).
- Base UI Menu/Dialog in jsdom: the 3.3/3.4 popup tests prove Base UI works under the existing polyfills; the dialog portal mounts to document.body — container-scoped queries miss it (the 3.4 drawer lesson: query `document.body`).
- Dual-instance list (aside + drawer): TWO mounts of the same element — the query cache dedupes the fetch (same key); mutations from either mount invalidate the shared key; the drawer copy must NOT render its own dialogs twice — dialogs live INSIDE the shared element (both mounts share the same dialog state? NO — each mount has its own state; opening the drawer's dialog renders a portal — the aside dialog is closed by default. The a11y-tree rule: only the visible surface is interactive; `display:none` keeps the hidden mount out of the a11y tree — the 3.4 precedent). Verify the aside-hidden + drawer-open case doesn't double-render dialogs.
- The re-run click and the menu trigger must not conflict: the row button and the kebab are siblings inside a flex row — no nested buttons (HTML invalid). The row button spans the name; the kebab is a separate button.
- `search.results` keys are the search-area family; `search.saved.*` is the saved-searches family — don't cross-use.
- Names with Arabic/Latin mix: raw name renders as-is; the `MaybeArabic` per-fragment wrapper (3.5) applies if the name is pure-Arabic in an FR/EN UI — REUSE the exported `isArabic` helper if needed (decide at dev time; a saved name is user-typed free text, so mixed-script is likely — the wrapper rule from 3.5 applies).
- The drawer's focus-return effect (3.3) focuses `[data-slot="drawer-close"]` on open — unaffected by the new section.

### Project Structure Notes

- Frontend NEW: `frontend/src/components/search/SavedSearchesList.tsx`, `SavedSearchNameDialog.tsx`, `frontend/src/hooks/useSavedSearches.ts`, `useSavedSearchMutations.ts`, `frontend/src/lib/queryKeys/savedSearches.ts`, `frontend/src/lib/api/saved-search-service.ts`, `frontend/src/lib/validation/saved-search.ts`, `frontend/src/components/ui/dialog.tsx` + `dropdown-menu.tsx` (shadcn CLI), tests: `saved-searches-list.test.tsx`, `saved-search-name-dialog.test.tsx`, `saved-search-hooks.test.tsx`, `saved-search-service.test.ts`, `search-page-saved-searches.test.tsx`.
- Frontend UPDATE: `SearchPage.tsx` (activeSearch + save/rerun handlers + SavedSearchesList slot), `FilterSidebar.tsx` (optional `savedSearchesSlot` in aside + drawer), `search-service.ts` (`filtersPayloadToStaged`), `messages/{en,fr,ar}.json` (+~7 keys, amended `saved.empty` ×3), `__tests__/{filter-sidebar,search-service}.test.tsx`.
- Backend NEW: `apps/search/migrations/0005_savedsearch.py`, `apps/search/tests/test_saved_search.py`, `test_saved_search_api.py`.
- Backend UPDATE: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `quota.py`.
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-6 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 stays in-progress.
- Deferred-work: `_bmad-output/implementation-artifacts/deferred-work.md` — record any 3.6 review defers; the `/companies/:id` 404 defer stays open; NO new deferrals expected from this story's scope (the drawer/dialog registry class debt is a pre-existing 3.3/3.4 item — the new dialog/dropdown-menu registry files join it if physical classes appear: `dropdown-menu.tsx` ships `right-2`/`pr-8`/`pl-1.5` in stock registry code — DORMANT, document under the same "registry debt" umbrella defer, do NOT hand-edit).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-06-saved-searches.md] Story spec (all ACs verbatim)
- [Source: docs/ARCHITECTURE-SPINE.md#AD-21] React Query conventions (hooks + factories + cache tuning; "the first real mutation lands with Story 3.6"); #AD-18 (RHF+zod — schemas in `lib/validation/`, next-intl-key messages, server errors via setError); #AD-20 (QueryClientProvider, retry:false quota contract); #AD-19 (HttpClient — prefix-relative paths, /api baseURL); saved_searches DDL (#L201); API routes table (#L470-473); Component Tree (#L408 FilterSidebar > SavedSearchesList); project structure (#L515-516 SavedSearches read-only admin)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L129] Saved searches list row (free-text name, one-click re-run = one counted query, caps 5/25 ASSUMPTION, persists across sessions/locales); #L145 empty saved searches (one-line hint pointing at the save affordance); #L143 loading trigger (saved search re-run → results skeletons)
- [Source: _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L72] FR-8 (save filters+keywords+sort with free-text name, sidebar list, one-click re-run, 5/25 caps ASSUMPTION)
- [Source: _bmad-output/implementation-artifacts/3-5-results-table-stacked-row.md] COMPLETED 3.5 — SearchPage state model (submitted/applied/sort/wilayas/wilayaQuery/chipRemove/clearNonce), runSearch path, useSearchResults hook (beginSearch/cancelQueries/nonce), dirty-guard resync, badge normalization, sortParamFor, AD-21 refactor commit 25a59d4 + searchKeys factory pattern, table sort round-trip (SortState → sort param → aria-sort/chevron)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] 3.6-RELEVANT: applied re-sync + wilaya restore contract ("3.6 saved-search re-runs must restore applied.wilayas into the combobox via SearchPage"); badge normalization RESOLVED in 3.5 — verify with a test; AD-21 mutation conventions ("first real mutation lands with Story 3.6")
- [Source: backend/apps/search/] Current state — models (no SavedSearch), views (People/Company search + quota wiring), urls (people/companies at /api/search/), quota.py (daily limits + upsert), admin, maintenance_tasks.py ('search','SavedSearch' ALREADY listed), seed_demo_data command (3e6a3d2)
- [Source: frontend/src/] Current wiring — SearchService (searchKeys factory, buildFiltersPayload), SearchPage, FilterSidebar (applied/stagedPatch/clearNonce/onClearAllRequest + badge normalization + dirty-guard), useSearchResults, SessionUser.tier (auth-service.ts)
- [Source: commit c5f5709] /api double-prefix fix + real-URL guard test precedent (frontend service paths are prefix-relative; baseURL carries /api)
- [Source: https://ui.shadcn.com/r/styles/base-nova/dialog.json] base-nova `dialog` (Base UI Dialog; registry dep: button only) — verified 2026-08-06
- [Source: https://ui.shadcn.com/r/styles/base-nova/dropdown-menu.json] base-nova `dropdown-menu` (Base UI Menu; no registry deps) — verified 2026-08-06

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **type vs tab singular/plural trap**: the backend stores `type` values `people`/`company` (spine DDL CHECK + epic AC) while the frontend `SearchTab` is `people`/`companies` (URL route). The first per-tab filter compared `row.type === tab` → the companies tab never listed company rows. Fixed with exported pure helpers `savedTypeToTab`/`tabToSavedType` in saved-search-service.ts, used at every boundary (list filter, activeSearch snapshot, handleRerun payload).
- **`aria-disabled={false}` renders the attribute**: React renders `aria-disabled="false"` — `toHaveAttribute('aria-disabled')` matched it. The component now passes `atCap || undefined`; tests assert `.toHaveAttribute('aria-disabled', 'true')` / `not.toHaveAttribute('aria-disabled', 'true')`.
- **Save-button assertions raced the list query**: the button renders with the pre-fetch `savedSearches=[]` (atCap false); tests must await a row render (or waitFor) before asserting the cap state.
- **Base UI Tooltip does not open on `fireEvent.pointerEnter`** in jsdom — `userEvent.hover` (proper pointer sequence) opens it; the focus-based test was replaced.
- **Base UI `render` on DropdownMenuTrigger with a non-forwardRef Button** emits the "Function components cannot be given refs" warning — replaced with direct props on the trigger (it renders a native button; `aria-label` + className + icon children). The remaining warning in the suite comes from the REGISTRY dialog.tsx itself (`DialogPrimitive.Close render={<Button/>}`) — registry code, documented as noise (do not hand-edit).
- **Badge normalization timing**: the FilterSidebar draft-resync effect commits AFTER the count text render — the badge test needed `vi.waitFor` on the badge value.
- **`DropdownMenuTrigger` name for the filters trigger**: `/search\.filters\.title/` regex needed (the trigger label contains the title + badge number).
- **get_or_create with `defaults={'password': ...}` stores a RAW password** (no hashing) — the real-stack e2e login 400'd until `set_password` was run in the container shell.
- **PowerShell 5.1 curl.exe quoting**: inner double quotes in `-d '{"a":1}'` get stripped — use `--data-binary "@file.json"` body files.
- Registry-inherent: the base-nova `dialog`/`dropdown-menu` ship physical classes (`left-1/2`, `right-2`, `pr-8`, `pl-1.5`) — documented registry-debt (dormant; not hand-edited).

### Completion Notes List

- Backend: `SavedSearch` model (UUID pk, user FK CASCADE, name, type choices + CheckConstraint `saved_searches_type_check`, filters JSONField, sort JSONField, timestamps) + migration `0005_savedsearch_savedsearch_saved_searches_type_check` (applied to real PG — DDL verified: jsonb columns, CHECK, FK, index); read-only admin; `maintenance_tasks.py` entry verified (pre-existing). Endpoints: `SavedSearchListView` (GET list `-created_at` user-scoped; POST with cap check BEFORE create — 400 `saved_search_limit_exceeded` + localized detail + `limit`), `SavedSearchDetailView` (PUT partial: name/filters/sort, `type` immutable, rename never touches filters/sort nor increments daily_usage; DELETE 204); both 404 on foreign/malformed/unknown ids; caps in `quota.py` (`SAVED_SEARCH_CAPS {'free':5,'starter':25}` + `MAX_SAVED_SEARCH_NAME_LENGTH` 100 + ×3 localized messages). 45 new backend tests → 404 total; ruff 0; mypy strict 0.
- Frontend: `SavedSearchService` (+ real-URL guard tests), `savedSearchesKeys` factory, `saved-search.ts` zod schema (AD-18, next-intl-key messages), `useSavedSearches` (enabled gating on user, 4 states, 60s staleTime with rationale comment, NO placeholderData) + `useSavedSearchMutations` (create/rename/remove with factory-key invalidation — the FIRST real AD-21 mutation consumers), `SavedSearchNameDialog` (stock base-nova dialog + RHF+zod; cap-race 400 → root `search.saved.max_capacity`), `SavedSearchesList` (per-tab rows, one-click re-run row buttons, dropdown-menu action menu, aria-current active indicator, cap tooltip `aria-disabled`+keyboard-reachable, native-disabled when no active search, empty hint, loading/error/retry states), `filtersPayloadToStaged` (JSONB round-trip identity both tabs), FilterSidebar `savedSearchesSlot` (aside + drawer, backward compatible), SearchPage wiring (activeSearch snapshot from applied+wilayas+sort, handleRerun restores wilayas→combobox + sort→chevron/aria-sort + fires through the existing runSearch path with an explicit sort param, activeSavedId marked only on query success, sort-field whitelist guard for stored JSON). 63 new frontend tests → 432 total; lint 0; typecheck 0; check:i18n 413×3.
- i18n: +7 keys ×3 (`cap_tooltip_free/starter`, `name_label`, `name_too_long`, `rename`, `rename_title`, `actions`), amended `saved.empty` ×3 to the AC literal; shape tests for `{limit}` interpolation ×3.
- Real-stack E2E (docker stack up, PG16): `migrate search` applied; saved_searches DDL verified; HTTP login → POST 201 → GET list (JSONB round-trip exact) → PUT rename 200 (filters/sort untouched, updated_at bumped) → re-run through `GET /api/search/people/` with the stored filters (200, counted query) → DELETE 204 → empty list. Test user cleaned up.

### File List

- `_bmad-output/implementation-artifacts/3-6-saved-searches.md` — UPDATE (this story; status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (3-6 → in-progress → review)
- `backend/apps/search/models.py` — UPDATE (SavedSearch)
- `backend/apps/search/migrations/0005_savedsearch_savedsearch_saved_searches_type_check.py` — NEW
- `backend/apps/search/admin.py` — UPDATE (read-only SavedSearch admin)
- `backend/apps/search/quota.py` — UPDATE (SAVED_SEARCH_CAPS, MAX_SAVED_SEARCH_NAME_LENGTH, saved_search_limit_for, ×3 messages)
- `backend/apps/search/serializers.py` — UPDATE (SavedSearchSerializer)
- `backend/apps/search/views.py` — UPDATE (SavedSearchListView/DetailView)
- `backend/apps/search/urls.py` — UPDATE (saved/ + saved/<uuid:pk>/)
- `backend/apps/search/tests/test_saved_search.py` — NEW (model + schema)
- `backend/apps/search/tests/test_saved_search_api.py` — NEW (endpoints + caps + scoping)
- `backend/apps/search/tests/test_models.py` — UPDATE (six tables + db_table)
- `frontend/src/lib/api/saved-search-service.ts` — NEW (types + service + guards + type/tab helpers)
- `frontend/src/lib/queryKeys/savedSearches.ts` — NEW (factory)
- `frontend/src/lib/validation/saved-search.ts` — NEW (zod schema)
- `frontend/src/hooks/useSavedSearches.ts` — NEW (list query, AD-21)
- `frontend/src/hooks/useSavedSearchMutations.ts` — NEW (create/rename/remove, AD-21)
- `frontend/src/components/search/SavedSearchNameDialog.tsx` — NEW
- `frontend/src/components/search/SavedSearchesList.tsx` — NEW
- `frontend/src/components/search/FilterSidebar.tsx` — UPDATE (savedSearchesSlot in aside + drawer)
- `frontend/src/components/search/SearchPage.tsx` — UPDATE (activeSearch + handleRerun + slot wiring + sort-field guard)
- `frontend/src/components/search/ResultsTable.tsx` — no change (SortField reused)
- `frontend/src/lib/api/search-service.ts` — UPDATE (filtersPayloadToStaged)
- `frontend/src/components/ui/dialog.tsx`, `dropdown-menu.tsx` — NEW (shadcn CLI base-nova)
- `frontend/messages/{en,fr,ar}.json` — UPDATE (+7 keys, amended empty ×3)
- `frontend/src/__tests__/saved-search-service.test.ts` — NEW
- `frontend/src/__tests__/saved-search-hooks.test.tsx` — NEW
- `frontend/src/__tests__/saved-searches-list.test.tsx` — NEW
- `frontend/src/__tests__/saved-search-name-dialog.test.tsx` — NEW
- `frontend/src/__tests__/search-page-saved-searches.test.tsx` — NEW
- `frontend/src/__tests__/{filter-sidebar,search-service,i18n-shape}.test.tsx` — UPDATE
- `_bmad-output/implementation-artifacts/manual-review-notes.md` — (STEP 0 notes commit, prior commit)

## Change Log

- 2026-08-06: Story created (ready-for-dev) from epic 3.6 spec; Sally UX consultation resolved 6 design decisions (stock base-nova dialog for the naming prompt + RHF+zod per AD-18 — one-field schema with next-intl-key messages; stock base-nova dropdown-menu for the action menu; re-run through the existing runSearch path with wilaya/sort restore + per-tab list scoping; cap UX = aria-disabled + keyboard-reachable tooltip (free 5 / starter 25), plain disabled when no active search; empty hint amended to the AC literal + names never localized + active-search indicator; JSONB round-trip = buildFiltersPayload JSON + {field,dir} sort with payload identity tests). John PM consultation: caps 5/25 confirmed (PRD Open Q2 assumption stands), duplicate names allowed, names never localized, rename never re-runs. Winston architect consultation: SavedSearch model per the spine DDL, 4 user-scoped endpoints with 404-on-foreign-rows, cap enforcement + localized messages in quota.py, re-runs counted only via the search views, admin read-only, maintenance_tasks entry verified. Backend work confirmed in scope (model + migration + endpoints — the table does not exist yet). Registry items dialog + dropdown-menu verified zero-new-deps (Base UI). sprint-status 3-6 → ready-for-dev (epic-3 stays in-progress).
- 2026-08-06: Implemented (TDD): RED suites (model 11, API 27, service 5, hooks 7, list 18, dialog 9, integration 5) → backend SavedSearch model + 0005 migration + caps + 4 user-scoped endpoints + read-only admin → frontend service/factory/schema → AD-21 hooks (first real mutation consumers) → dialog + dropdown-menu registry adds (base-nova, zero new deps) → SavedSearchesList + SavedSearchNameDialog → filtersPayloadToStaged round-trip → FilterSidebar savedSearchesSlot (aside + drawer) → SearchPage wiring (activeSearch snapshot, handleRerun with wilaya/sort restore through the runSearch path, activeSavedId on success, sort-field whitelist guard) → i18n +7 keys ×3 + empty amend + shape tests. GREEN: frontend 432 tests (369 + 63), lint 0 / typecheck 0 / check:i18n 413×3 ✓; backend 404 pytest (359 + 45) / ruff 0 / mypy strict 0. Real-stack E2E verified on the docker stack (migrate applied to PG16, DDL + CREATE/LIST/PUT/DELETE/re-run through the search endpoint; test user cleaned). Dev-stage amendments: type/tab conversion helpers (singular 'company' vs plural 'companies'), aria-disabled=atCap||undefined, sort-field whitelist guard on stored JSON, badge assertion via waitFor (effect timing), userEvent.hover for the Base UI tooltip. Status → review; sprint 3-6 → review (epic-3 stays in-progress).
