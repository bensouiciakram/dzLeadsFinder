---
story_id: 3.5
epic: 3
title: Story 3.5 — Results Table + Stacked Row
status: ready-for-dev
frs: [FR-5, FR-6, FR-10]
ads: [AD-2, AD-8, AD-9, AD-20]
ux_drs: [UX-DR10, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
---

# Story 3.5: Results Table & Stacked Row

Status: ready-for-dev

## Story

As a **user viewing search results**,
I want **a sortable table on desktop with the correct columns for People or Company, collapsing to stacked cards on mobile, with column visual order flipping in RTL**,
So that **I can scan, sort, and act on results in my preferred layout**.

## Acceptance Criteria

**Given** the People search Results Table
**When** results load on desktop (≥md)
**Then** the table columns are: name, role, company, wilaya, and a reveal action column
**And** each column header is sortable with a chevron icon (in ascending/descending/none state)
**And** the active sort column carries `aria-sort`
**And** numeric columns (People count, wilaya code) use `tabular-nums`

**Given** the Company search Results Table
**When** results load
**Then** columns are: name, industry, wilaya, size, People count

**Given** RTL column flip
**When** the locale is Arabic (RTL)
**Then** column visual order flips (inline-start becomes inline-end)
**And** the underlying column order is stable for CSV export (FR-2)

**Given** Mobile results (Stacked Row variant)
**When** the viewport is <md
**Then** each result renders as a card:
- {colors.card} fill, 1px {colors.border}, {rounded.lg}, {spacing.gutter} padding
- Lead name in {typography.title}, meta in {typography.small} {colors.muted-foreground}
- Reveal action full-width at bottom
- Same data and order as the table — a responsive reflow, not a redesign

**Given** table styling
**When** the table renders
**Then** header row: {typography.small} at 600 weight, {colors.muted-foreground}
**And** rows: 48px height, 1px {colors.border} bottom borders (no vertical gridlines)
**And** row hover: {colors.muted}
**And** Company name renders as a real `<a>` link → `/companies/:id` (keyboard focusable, not clickable row)

**Given** pagination controls
**When** results exceed 100
**Then** pagination controls appear below the table (no infinite scroll)
**And** the current page is visually indicated

**Given** empty results
**When** a search returns 0 matches
**Then** a suggestion is shown: "Try broadening your wilaya or industry selection"
**And** a "Clear all filters" one-click action is available

**Given** cold load / loading state
**When** a search query is in flight
**Then** skeleton rows matching the results-table layout are shown
**And** the filter panel renders immediately from cached taxonomy

## Tasks / Subtasks

- [ ] **Task 1: Backend — `industry` sort whitelist extension** (AC: each column header sortable — the 3.2 companies whitelist lacks `industry`; D2)
  - [ ] 1.1 RED: `backend/apps/search/tests/test_company_search.py` — UPDATE — sort `industry:asc`/`industry:desc` orders by industry name (English name — stable, not locale-keyed; nulls LAST in both directions via the universal `nulls_last=True` contract); `industry` accepted by `parse_sort` for companies; REJECTED for people (endpoint-scoped whitelist precedent).
  - [ ] 1.2 GREEN: `backend/apps/search/filters.py` + `views.py` — UPDATE — add `industry` to the companies sort whitelist + ORM mapping (`F('industry__name_en')` with `nulls_last=True`, same `_order_by` pattern as the existing keys). Do NOT touch the people whitelist.
  - [ ] 1.3 Run backend gates (pytest/ruff/mypy) — green (352 + new).

- [ ] **Task 2: AD-20 adoption — QueryClientProvider + client config** (authorized; AD-20; gate PASSED in 3.4)
  - [ ] 2.1 RED: `frontend/src/__tests__/providers-query.test.tsx` — NEW — render `<Providers>` with a probe child calling `useQueryClient()` (non-null) + a `useQuery` resolving via the existing mocked `@/lib/api/auth-service` (or a direct fetch-free queryFn); assert the client exists and the query resolves. Mirrors the tanstack-query-gate smoke but through the REAL Providers tree.
  - [ ] 2.2 GREEN: `frontend/src/components/providers/Providers.tsx` — UPDATE — mount `QueryClientProvider` with a MODULE-SCOPED `QueryClient` (stable across renders; `defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }`) as the OUTERMOST provider. `retry: false` is a QUOTA contract: a transient error must never auto-retry a search (each retried success increments `daily_usage` again — Q8 double-burn); the 3.3 review's "stale-results-hidden-on-error" + one-query-per-Apply semantics stay.
  - [ ] 2.3 Keep `frontend/src/__tests__/tanstack-query-gate.test.tsx` untouched (smoke guard stays green).

- [ ] **Task 3: HTTP timeout/abort + typed result rows** (deferred-work 3.3 "axios timeout/abort" — 3.5-OWNED; AD-19/AD-20)
  - [ ] 3.1 RED: `frontend/src/__tests__/search-service.test.ts` — UPDATE — assert the shared axios instance carries a `timeout` (config-level, e.g. 20000); `searchPeople/searchCompanies` accept an optional `signal?: AbortSignal` and forward it in the axios config (`params` + `signal`); `SearchResult<T>` generic + `PeopleResultRow`/`CompanyResultRow` interfaces with EXACTLY the 3.2 row keys (people: `id, name, role, company_name, wilaya_code, wilaya_name, revealed`; companies: `id, name, industry, industry_id, wilaya_code, wilaya_name, size_band, people_count`).
  - [ ] 3.2 GREEN: `frontend/src/lib/api/http-client.ts` — UPDATE — add `timeout` to the default axios config (single shared value; all AD-19 services inherit). `frontend/src/lib/api/search-service.ts` — UPDATE — typed row interfaces, `SearchResult<T>` generic, optional `signal` param on both methods passed through to axios.

- [ ] **Task 4: i18n keys ×3 locales** (AC literals; AD-8)
  - [ ] 4.1 `frontend/messages/en.json` — UPDATE — AMEND `search.results.empty` value → "No leads match your filters. Try broadening your wilaya or industry selection." (AC literal). NEW keys:
    - `search.results.columns.role`: "Role" — role column header (sortable)
    - `search.results.columns.company`: "Company" — company column header (sortable)
    - `search.results.columns.people_count`: "People count" — companies People-count column header (sortable)
    - `search.results.columns.reveal`: "Reveal" — reveal action column header (NOT sortable — no chevron). NOTE: `common.actions.reveal` exists ("Reveal") — reuse it instead of a new key if it renders correctly in the header context; prefer reuse.
    - `search.results.sort_asc`: "Sorted by {column}, ascending" — polite announcement
    - `search.results.sort_desc`: "Sorted by {column}, descending" — polite announcement
    - `search.results.sort_default`: "Sorted by {column}, default order" — announcement when cycling back to none
    - `search.results.previous`: "Previous" — pagination button (`common.actions.next` EXISTS — reuse for Next)
    - `search.results.clear_all`: "Clear all filters" — empty-state one-click action
    - `search.results.chip_remove`: "Remove {name}" — chip remove aria-label (all chips incl. wilaya)
    - `search.results.aria_busy`: "Loading results" — sr-only loading announcement (or reuse `common.states.loading`)
    - REUSE (no new keys): `search.sort.name`, `search.sort.wilaya`, `search.filters.industry`, `search.filters.size` (company-size header), `search.results.pagination` ("Page {current} of {total}" — EXISTS), `search.results.truncated`, `search.results.count`, `search.results.not_run`, `common.states.loading`, `common.actions.next`, `common.actions.reveal`.
  - [ ] 4.2 Mirror ALL changes in `fr.json` + `ar.json` (Arabic: no uppercase transforms; Western Arabic numerals only in interpolations — AD-8). `npm.cmd run check:i18n` must pass (en = source of truth; identical key counts ×3).

- [ ] **Task 5: ResultsTable — TDD** (ACs 1–3, 8; D1, D2, D7, D8)
  - [ ] 5.1 RED: `frontend/src/__tests__/results-table.test.tsx` — NEW — pure presentational; props `{ tab, rows, sort, onSortChange }`. Suite (i18n KEYS via the mocked `useTranslations`, never values):
    - **columns/people**: headers in DOM order `search.sort.name, search.results.columns.role, search.results.columns.company, search.sort.wilaya, common.actions.reveal` (role/company via the NEW keys); **columns/companies**: `search.sort.name, search.filters.industry, search.sort.wilaya, search.filters.size, search.results.columns.people_count`.
    - **sortable headers**: each data column header is a `<button>` (role button); industry (companies) IS sortable (Task 1 whitelist); the reveal header is NOT a button (plain th, no chevron).
    - **sort cycle**: click name header → `onSortChange('name','asc')`; second → `('name','desc')`; third → `('name', null)` (none → server default `name:asc`); the cycle resets per column (sorting role while name active → `('role','asc')`).
    - **aria-sort**: only the active column's th carries `aria-sort="ascending"|"descending"`; others have NO aria-sort attribute.
    - **chevrons**: none → `ChevronsUpDown` (muted); asc → `ChevronUp`; desc → `ChevronDown` (assert by data-testid `sort-chevron` + the state class, not icon internals).
    - **rows**: 48px (`h-12` class), `border-b` only, hover `hover:bg-muted`; header `text-small font-semibold text-muted-foreground`.
    - **numeric columns**: wilaya code + people_count cells carry `tabular-nums` (class assertion); pagination numbers too.
    - **company link**: company cell renders a REAL `<a>` (`getByRole('link')`) with `href="/companies/42"` (next/link), keyboard-focusable; the `<tr>` has NO click handler (assert no `onClick` prop on tr / no cursor-pointer class); People tab company cell links too; company-less rows (null company_name) render a muted em-dash cell (NO link).
    - **wilaya cell**: `{wilaya_code} — {wilaya_name}` display; the code in `tabular-nums`; an Arabic-script name fragment (regex `[\u0600-\u06FF]`) carries `lang="ar" dir="rtl"` on its own span (per-fragment language rule).
    - **RTL smoke**: render in `dir="rtl"` — DOM column order UNCHANGED (people: name, role, company, wilaya, reveal — stable for CSV per FR-2); NO physical-property classes in the table's own markup (`left-`, `right-`, `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right` absent).
    - **null cells**: null role/industry/size → muted em-dash; `people_count: 0` renders "0" (Western numerals — the 0-contacts-company case, FR-6).
    - **size band display**: `size_band: '500+'` renders the localized label via `search.size.500_plus` key; band → key mapping pure helper (`'1-10' → '1_10'`, `'500+' → '500_plus'`).
  - [ ] 5.2 GREEN: `frontend/src/components/search/ResultsTable.tsx` — NEW — from `frontend/`: `npx shadcn@latest add table` (base-nova; zero new npm packages — pure token classes, no Base UI dep). Stock `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` with usage-site overrides ONLY (3.4 precedent — never hand-edit the registry file): th override `h-8 text-small font-semibold text-muted-foreground` (registry default h-10/medium/foreground), tr override `h-12 hover:bg-muted` (registry `hover:bg-muted/50` → AC literal `{colors.muted}` via twMerge), `border-b` per row (registry `[&_tr]:border-b` on thead + border-b on rows). Sortable header = real `<button>` inside th (aria-sort lives on the th; button text-small + focus-visible ring; `min-h-11 md:min-h-0` — the th is 48px, no extra inflation needed); lucide `ChevronUp/ChevronDown/ChevronsUpDown` at inline-end of the label; pure helpers exported (`sortCycle`, `bandLabelKey`). Table container `hidden md:block`; wrapper `data-testid="results-table"`. Logical CSS ONLY (AD-9); design tokens ONLY (AD-2); no comments unless necessary.

- [ ] **Task 6: ResultsTableStackedRow — TDD** (AC 4; D1)
  - [ ] 6.1 RED: `frontend/src/__tests__/results-table-stacked-row.test.tsx` — NEW — props `{ tab, rows }`; same row model as the table (one component, two layouts — reflow not redesign). Suite:
    - **card anatomy**: per-row card with `bg-card border border-border rounded-lg` + gutter padding (`p-gutter`); lead name `text-title`; meta lines `text-small text-muted-foreground` (people: role · company; companies: industry · size); wilaya line `{code} — {name}` with code `tabular-nums`; Arabic-script fragments `lang="ar" dir="rtl"`.
    - **reveal action**: full-width at the bottom — a button-styled slot `data-testid="reveal-slot"` with `w-full min-h-11 md:min-h-8` (touch target ≥44px — UX-DR22) carrying the reveal label; the slot is inert in 3.5 (Epic 4.2 fills RevealButton) — document the handoff.
    - **company link**: company name is the same real link to `/companies/:id`; the card is NOT a click target.
    - **same data/order**: rows render in the exact results order; every table field present; null cells → muted em-dash (same helper as the table).
    - **RTL smoke**: no physical-property classes in the card markup.
  - [ ] 6.2 GREEN: `frontend/src/components/search/ResultsTableStackedRow.tsx` — NEW — cards container `md:hidden` (table wrapper is `hidden md:block` — the responsive split lives at the SearchPage integration, not inside either component); per-record card as specced; tokens only; logical CSS only.

- [ ] **Task 7: SearchPage → useQuery + results area integration — TDD** (ACs 5–7; D3, D4, D5, D6; AD-20 consumption; deferred-work (b) live-region move)
  - [ ] 7.1 RED: `frontend/src/__tests__/search-page.test.tsx` — UPDATE — add a local `renderPage` helper that wraps `<SearchPage tab=... />` in `QueryClientProvider` with a FRESH QueryClient per test (needed once SearchPage consumes useQuery). Keep all 16 existing assertions semantically intact — they become the regression net for the AD-20 refactor:
    - one-query-per-Apply (query-key dedupe replaces the inFlightRef — double-click Apply still resolves to ONE `searchPeople` call);
    - loading/error/retry/429; stale-results-hidden-on-error (error state renders WITHOUT the previous table — no `placeholderData: keepPreviousData` anywhere);
    - rate-limited persistence (second Apply on the same key does NOT refetch — cached error, matches the current contract);
    - wilaya merges + badge; truncated notice; staged-filters-editable-during-flight (the applied-resync dirty-guard keeps staged edits — Task 8).
    NEW assertions:
    - **pagination**: total 105 → controls below the table (Previous/Next buttons + `search.results.pagination` "Page {current} of {total}" text with tabular-nums); Next click → `searchPeople` called with `page=2` and the SAME sort; `aria-current="page"` on the current-page indicator; total ≤ 100 → NO pagination controls; Previous disabled on page 1 (native `disabled`); page resets to 1 when a new Apply changes filters.
    - **sort re-query**: click the name header button → exactly one `searchPeople` call with `sort='name:asc'` (second param) + the sr-only announcement `search.results.sort_asc` renders; click again → `name:desc`; third → default `name:asc` + `search.results.sort_default`; sort change resets page to 1.
    - **live region**: `#results` section NO LONGER carries `aria-live`; the count/status line container DOES (`aria-live="polite"`, `data-testid="results-status"`); sort/page announcements render inside it as `role="status"` `sr-only` spans; the table itself is OUTSIDE the live region.
    - **skeletons**: while pending → `data-testid="skeleton-row"` rows with the real table header above them + `aria-busy="true"` on the results region + sr-only `common.states.loading`; filter panel still interactive during flight (existing test re-asserts); after resolve → skeleton rows gone.
    - **empty broaden**: total 0 → `search.results.empty` (amended value) + `search.results.clear_all` button; click → sidebar draft reset AND wilaya combobox cleared (no chips, badge count 0) AND NO new query fired (staged reset — FR-7) → area returns to `search.results.not_run`.
  - [ ] 7.2 GREEN: `frontend/src/components/search/SearchPage.tsx` — UPDATE — state model: `const [submitted, setSubmitted] = useState<{ filters: StagedFilters; filtersJson: string; page: number; sort: string } | null>(null)`; `const [applied, setApplied] = useState<StagedFilters | null>(null)` (set ONLY on query success — stable identity); `const [wilayas, setWilayas] = useState<number[]>([])`; `const [wilayaQuery, setWilayaQuery] = useState('')` (Task 8 shared combobox query); `const [clearNonce, setClearNonce] = useState(0)`; NO inFlightRef. Query: `useQuery({ queryKey: ['search', tab, filtersJson, page, sort], queryFn: ({ signal }) => tab === 'people' ? searchService.searchPeople(filtersJson, page, sort, signal) : searchService.searchCompanies(filtersJson, page, sort, signal), enabled: submitted !== null })` — `retry:false` + no refetchOnWindowFocus come from the client defaults. Phase mapping: `isPending → 'loading'`; `isError + status 429 → 'rate_limited'` (detail from `error.response.data.detail`); `isError → 'error'`; success → results. Handle: `runSearch(filters)` = setPage(1) + setSubmitted + setRateLimitMessage(undefined); `handleSort(field, dir)` = setSort + setPage(1) + submit; `handlePage(next)` = setPage; `handleRetry` = `refetch()`; `handleClearAll` (empty-state + sidebar callback) = bump clearNonce + `setWilayas([])`. Renders: skip link (unchanged, `#results`); FilterSidebar (+ new optional props `applied`, `clearNonce`, `onClearAllRequest`); results region `aria-busy` while pending; status line container (live region) with count/empty/truncated/rate-limit + sr-only sort/page announcements; `hidden md:block` table (or skeletons) + `md:hidden` stacked cards; pagination below (`result.total > 100`); `data-testid="results-slot"` CONTRACT PRESERVED — the table mounts inside the existing `results-slot` div (3.4 contract: the slot div stays, its children change). Existing wilaya merge `{ ...filters, wilayas }` unchanged.
  - [ ] 7.3 Announcement copy: sort/page changes announce via the sr-only span INSIDE the live region; the visible count line unchanged on sort (count is same) — the span carries the announcement (keys `search.results.sort_asc/sort_desc/sort_default`, `search.results.pagination`); truncation + empty + rate-limit render as the visible status text.

- [ ] **Task 8: ActiveFilterChips + applied contract + badge normalization + dual-instance combobox query — TDD** (deferred-work 3.3 "applied re-sync" + 3.4 badge landmine + 3.4 dual-instance; scope resolution: chips ARE 3.5's — the 3.3 defer names "3.5 (chips)")
  - [ ] 8.1 RED: `frontend/src/__tests__/active-filter-chips.test.tsx` — NEW — props `{ filters: StagedFilters, onPatch: (patch: Partial<StagedFilters>) => void }`. Suite:
    - **chips**: one chip per active value — industries (localized label), wilayas (`31 — Oran` via the wilayaDisplayLabel precedent, code tabular-nums), seniorities (`search.seniority.*`), sizes (`search.size.*`), keyword (raw value), includeUnknownSize (a `search.filters.include_unknown_size`-labeled chip); order: industries → wilayas → seniorities → sizes → keyword → unknown-size.
    - **removal stages**: chip remove button (`aria-label` = `search.results.chip_remove` + name) → `onPatch({ industries: [...] })` with the FULL remaining list (replace semantics); removing a wilaya chip → `onPatch({ wilayas: [...] })`.
    - **hidden when empty**: all-empty filters → nothing rendered.
    - **a11y**: remove buttons are real `<button>`s, keyboard-reachable, `min-h-11 md:min-h-4` (UX-DR22 touch targets); chips `rounded-full bg-muted` (filter-chip DESIGN); RTL smoke — no physical classes.
  - [ ] 8.2 RED+GREEN: `frontend/src/components/search/FilterSidebar.tsx` — UPDATE — (a) new OPTIONAL props: `stagedPatch?: Partial<StagedFilters>` (effect: `setDraft(current => ({ ...current, ...stagedPatch }))` — chip removal staging), `clearNonce?: number` (effect: `setDraft(EMPTY_FILTERS)` on change), `onClearAllRequest?: () => void` (the sidebar's own Clear All button calls it AFTER resetting the draft — page-level clear also clears SearchPage-owned wilayas; when unwired the 3.4 staged-only semantics are unchanged). (b) **badge normalization** (deferred-work 3.4 landmine — fires NOW because applied drives the draft re-sync): `badgeCount = countActiveFilters({ ...draft, wilayas: [] }) + wilayaCount` — `wilayaCount` is the SINGLE wilaya source while the combobox is wired; `countActiveFilters` itself unchanged (pure, other consumers unaffected). (c) **applied re-sync dirty-guard** (deferred-work 3.3 — "drive applied with stable object identity and re-verify the effect with tests"): the `useEffect([applied])` resync is now conditional — track edits via a `dirtyRef` (set on every `setDraft` from user actions); resync to `applied` only when `!dirtyRef.current` (draft untouched since the last resync) — staged edits made DURING a query flight are NEVER clobbered (the 3.3 "keeps staged filters editable" test becomes the verified regression). Tests in `frontend/src/__tests__/filter-sidebar.test.tsx`: badge with `applied={{...wilayas:[31]}}` + `wilayaCount:1` → badge "1" (not 2); stagedPatch merges; clearNonce resets; onClearAllRequest fires on Clear All.
  - [ ] 8.3 RED+GREEN: `frontend/src/components/search/WilayaCombobox.tsx` — UPDATE — OPTIONAL controlled query props `inputValue?: string` + `onInputValueChange?: (q: string) => void` (when provided, the internal query state is lifted — default unchanged, backward compatible). `SearchPage.tsx` — UPDATE — owns `wilayaQuery` + passes the SAME `inputValue`/`onInputValueChange` to the single `wilayaField` element (rendered in BOTH aside + drawer mounts → one shared query state — resolves the 3.4 deferred dual-instance item). Test: render SearchPage, type into the aside combobox input → the drawer instance's input (same React element, two mounts) carries the identical value; both `role="combobox"` inputs stay synchronized (a11y note: only the visible surface is in the a11y tree — `display:none`).
  - [ ] 8.4 `frontend/src/components/search/SearchPage.tsx` — UPDATE — renders `<ActiveFilterChips filters={applied} onPatch={setStagedPatch} />` in the ResultsArea (component tree: ResultsArea > ActiveFilterChips) above the table, only when `applied !== null`; `stagedPatch` state forwarded to FilterSidebar.

- [ ] **Task 9: Verification gates + story sync** (all ACs)
  - [ ] 9.1 Frontend (from `frontend/`): `npm.cmd test` all green (270 baseline + new), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (×3 locales).
  - [ ] 9.2 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` green (354 baseline + Task 1), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0.
  - [ ] 9.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-5 → in-progress → review; epic-3 stays in-progress). Commit as `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.

## Dev Notes

### Decided constraints (confirmed with Sally — UX designer consultation 2026-08-05)

- **Component mapping (decision 1 — D1)**: stock shadcn base-nova registry `table` + `skeleton` (registry-verified 2026-08-05: semantic `<table>` wrappers with token classes; skeleton = `animate-pulse rounded-md bg-muted`) — NO Base UI dep, ZERO new npm packages. NO stock pagination in the registry — hand-rolled with `Button` + tokens. Stacked row: ONE component per record + a shared row model; the responsive split is CSS-only at the integration point (cards container `md:hidden`, table wrapper `hidden md:block`). Usage-site token overrides ONLY (3.4 precedent — never hand-edit registry files; the registry th `h-10 text-left font-medium` → override `h-8 text-small font-semibold text-muted-foreground`; tr `hover:bg-muted/50` → `hover:bg-muted` via twMerge).
- **Sort model (decision 2 — D2)**: server-side per 3.2 (`sort=field:asc|desc`; people whitelist name/role/company_name/wilaya_code; companies name/size_band/wilaya_code/people_count). Per-column cycle none → asc → desc → none; `aria-sort` ONLY on the active column (valid values ascending/descending; others get NO attribute); chevrons: none = `ChevronsUpDown` (muted), asc = `ChevronUp`, desc = `ChevronDown`. Every sort transition fires ONE query — it counts toward the FR-7 daily limit like an Apply (announced via the live region); cycling to none re-queries with the server default `name:asc`. Sort changes reset page to 1. **Industry column**: the 3.2 whitelist lacks `industry` but the AC literal says every column is sortable → small backend extension (Task 1: whitelist + `F('industry__name_en')` nulls-last mapping + tests); product intent is unambiguous (no PM consultation needed — the constraint is technical, not product). The reveal column is an ACTION column — never sortable, no chevron.
- **Pagination (decision 3 — D3)**: server caps at 100/page; controls appear when `total > 100` (no infinite scroll — banned); Previous/Next + "Page {current} of {total}" (key exists) with the current page indicated; page change = new query (counts); page resets to 1 on filter/sort change; Prev/Next natively `disabled` at the edges (not metering-blocked — no aria-disabled needed); chevron icons `rtl:rotate-180` (direction-mirroring icons flip in RTL — EXPERIENCE rule); buttons `min-h-11 md:h-8` (44px touch targets on mobile — UX-DR22).
- **Live-region contract (decision 4 — D4)**: move `aria-live="polite"` from the `#results` section to the count/status line container (3.3 defer (b) — otherwise the whole table announces on every update); `#results` keeps its id (skip-link target) WITHOUT aria-live; the region contains the visible status line (count / empty / truncated / rate-limited) PLUS an sr-only `role="status"` span for sort + page announcements (the count line is unchanged by a sort — the span carries the announcement); the table markup is NEVER inside the live region.
- **Skeleton loading (decision 5 — D5)**: the REAL table header + N (`SKELETON_ROWS = 5`) registry `Skeleton` body rows (`h-12`, column widths matching the per-tab table) → zero layout shift; `aria-busy="true"` on the results region while pending + sr-only `common.states.loading`; the filter panel renders immediately from cached local taxonomy (already true — sidebar is static local data; existing test re-asserts it).
- **Empty state (decision 6 — D6)**: AMEND `search.results.empty` values ×3 to the AC literal ("Try broadening your wilaya or industry selection" / fr / ar). One-click `search.results.clear_all` in the results area = PAGE-LEVEL reset: clears the sidebar draft AND the SearchPage-owned wilayas (combobox) WITHOUT firing a query (FR-7 staged reset — never silently burn the cap; area returns to `not_run`). **Clear All unification**: the sidebar's own Clear All now ALSO clears wilayas via the new optional `onClearAllRequest` callback (SearchPage wires `setWilayas([])`); this AMENDS the 3.4 D6 "wilayas remain active after Clear All" behavior when wired (SearchPage-level test covers it; the standalone sidebar test keeps its 3.4 semantics — optional prop, unwired default unchanged). Badge normalization rides along (Task 8.2): `wilayaCount` is the single wilaya source.
- **/companies/:id link (decision 7 — D7)**: render the AC-literal real `next/link` NOW (`/companies/${id}`); NO stub page in 3.5 — CompanyDetailPage is a separate future story; the link temporarily 404s (accepted, forward-correct, documented as a known limitation + defer). No clickable rows (D8): the row itself is never a click target — only the link is focusable.
- **Reveal column/slot (decision 8)**: the reveal ACTION column exists as a header (`common.actions.reveal` — reuse) + per-row `data-testid="reveal-slot"` cell in the table; the stacked card carries a full-width button-styled slot (`w-full min-h-11`, reveal label) — INERT in 3.5; Epic 4.2 fills RevealButton (checklist-slot precedent from 3.3).
- **ActiveFilterChips scope (decision 9 — (d))**: chips ARE in 3.5's scope — the 3.3 deferred-work note explicitly names "3.5 (chips)" and 3.5 owns the applied state (their natural input). Minimal implementation: chips derive from `applied` (last successful query); removing a chip STAGES the removal via `onPatch` → FilterSidebar `stagedPatch` effect → the query re-runs only on the next Apply (FR-7, EXPERIENCE filter-chip rule). This story also delivers the deferred-work 3.3 obligation: `applied` driven with STABLE identity (set only on query success) + the resync effect re-verified with a dirty-guard (staged edits during flight are never clobbered).
- **Dual-instance combobox query (decision 10 — (e))**: RESOLVED in 3.5 — `WilayaCombobox` gains optional controlled `inputValue`/`onInputValueChange` (backward-compatible); SearchPage owns ONE shared query state fed to the single `wilayaField` element (rendered in both aside + drawer mounts) → one source of truth, no resurfaced stale query (3.4 deferred item closed).
- **AD-20 adoption (decision 11)**: APPROVED (authorized) — the 3.4 gate passed; QueryClientProvider mounts in Providers (module-scoped client, `retry: false` + `refetchOnWindowFocus: false` — QUOTA contract); the results query is a `useQuery` consumer via the AD-19 SearchService methods (queryFn receives `signal` → axios abort); SearchPage's phase states map onto query states (`isPending → loading`, 429 `isError → rate_limited`, `isError → error`); one-query-per-Apply preserved via query-key dedupe (double-Apply = one network call — inFlightRef REMOVED); NO `placeholderData: keepPreviousData` (keeps the 3.3 stale-results-hidden-on-error contract — a page/sort change shows skeletons, never stale rows); re-applying IDENTICAL filters returns the cached result (no network, no count — acceptable: results are identical by construction in V1).
- **Timeout/abort (decision 12 — (a))**: 3.5-OWNED from the 3.3 defer — shared `timeout: 20000` in the HttpClient default config (all AD-19 services inherit) + `signal` forwarding on search methods (query aborts on new submit; an aborted request is not counted by Q8).

### Existing patterns to follow (from 3-2/3-3/3-4 precedents)

- Component + test layout: client components in `frontend/src/components/search/`, tests in `frontend/src/__tests__/<name>.test.tsx`; pure helpers exported from the component module for unit tests.
- Tests: vitest + jsdom; `src/test/setup.ts` imports `mocks.ts` (next-intl `useTranslations` returns the KEY, `useLocale` → 'en'; `useLocale` is a vi.fn — AR-locale render tests override it); assert message KEYS never values; `fireEvent`; jest-dom matchers. **SearchPage tests need a `QueryClientProvider` wrapper** (fresh `QueryClient` per test — a shared `renderPage` helper; the 3.4 tanstack gate proves the stack works).
- i18n (AD-8): Western Arabic numerals ONLY in interpolations — pass `String(n)` for counts (the 3.4 `wilaya_more` review lesson); next-intl v4 formats `{count}` with the locale's numeral system → `String()` first. `check:i18n` = en source of truth, identical key counts ×3; the 3.4 `i18n-shape.test.ts` asserts every rendered key resolves in all 3 locales — NEW keys must land ×3 or the suite fails.
- Design tokens (AD-2/AD-9): `bg-card`, `border-border`, `rounded-lg` (stacked card), `rounded-full bg-muted` (chips), `text-title`/`text-small`/`text-caption`/`text-data`, `tabular-nums` (wilaya codes, people counts, pagination, count), `hover:bg-muted`, `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements; logical CSS ONLY (no physical properties in OUR components); `rtl:rotate-180` for direction-mirroring icons; 44px touch targets on `<md` (UX-DR22): `min-h-11 md:min-h-8`/`md:h-8` on buttons; per-fragment `lang="ar" dir="rtl"` on Arabic-script data (results cells with company names, wilaya names — regex `[\u0600-\u06FF]` check; in the AR root the page handles it, but FR/EN UI with Arabic-script data needs the wrapper — the wilaya cell code is always Western + `tabular-nums`).
- RTL (FR-2): visual flip via `dir` + logical CSS — DOM/column order NEVER changes (stable for CSV export); test asserts DOM order in an `rtl` render.
- No code comments unless necessary; commit style `Story 3.5: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.
- Checkboxes `- [x]` stay unchecked until dev executes them — tasks above are the live checklist.

### Implementation notes

- `SearchResult<T>` generic: `{ results: T[]; total: number; page: number; truncated: boolean; refine_prompt: string | null }`; `PeopleResultRow`/`CompanyResultRow` keys exactly per 3.2 (see Task 3.1). No zod (AD-18 blocked) — typed cast, 2.3 SessionUser-cast precedent.
- Query key: `['search', tab, filtersJson, page, sort]` — the filters JSON string IS the stable identity (built once per submit from the submitted object); `enabled: submitted !== null`. `applied` (FilterSidebar prop) = the submitted StagedFilters object stored on success — stable identity (setState on submit, no per-render object creation).
- FilterSidebar new optional props (all additive — no breaking change): `applied` (already in the 3.3 type, now actually driven), `stagedPatch?`, `clearNonce?`, `onClearAllRequest?`. Badge: `countActiveFilters({ ...draft, wilayas: [] }) + wilayaCount`.
- The dirty-guard resync effect: `dirtyRef` set by the user-action `setDraft` wrappers (NOT by the resync itself); effect: `if (applied !== lastAppliedRef.current && !dirtyRef.current) { setDraft(applied); lastAppliedRef.current = applied }` — adjust exact mechanics at dev time; the 3.3 "keeps staged filters editable while a query is in flight" test is the contract.
- `ResultsTable` props: `{ tab, rows, sort, onSortChange }`; `sort = { field, dir: 'asc' | 'desc' | null }`; SearchPage converts: `sortParam = dir ? \`${field}:${dir}\` : 'name:asc'`.
- Stacked card + table share the SAME row-rendering data (shared row model); wilaya line `{code} — {name}` (combobox label precedent — the 3.4 divider ` — `).
- The `#results` section: keep `id="results"` + remove `aria-live`; the status line container gets `aria-live="polite"` + `data-testid="results-status"`. The `data-testid="results-slot"` div stays as the table mount point (3.4 contract).
- Truncation (existing behavior preserved): count line + `search.results.truncated` notice — existing tests keep passing; `count_with_limit` key stays unused (or note if reused — don't break the truncated tests).
- Empty-state Clear-all + sidebar Clear All must NOT fire queries (staged reset — the existing "fires exactly one query" tests are the guard).
- Rate-limited: 429 → `isError` with `status === 429` → `rate_limited` phase; message from `error.response.data.detail`; sidebar message + `aria-describedby` wiring unchanged; re-applying the same filters hits the cached error (no refetch) — matches the existing contract test.
- Backend Task 1: only `filters.py` whitelist + `views.py` mapping + tests — no models/migrations.
- Registry adds: `npx shadcn@latest add table skeleton` (both pure-token, no Base UI dep — verify the generated files compile; skeleton may already exist via another dependency — check `frontend/src/components/ui/`).

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd`; backend venv `backend\.venv\Scripts\` (run from `backend/`); system python is 3.10 — use the venv python for backend gates.
- Do NOT hand-edit registry-generated `table.tsx`/`skeleton.tsx`; token overrides at the usage site (twMerge overrides work — 3.4 precedent).
- Do NOT hardcode px: 48px rows = `h-12`, header `text-small` (14px), `h-8`; card `rounded-lg` = --radius-lg (8px); gutter padding = `p-gutter`; NO `uppercase` anywhere.
- jsdom has no viewport — the md split is class-based (no matchMedia needed for the table itself; the drawer close-on-md precedent stays in FilterSidebar).
- The 3.4 "keeps staged filters editable" test + the badge test + the count tests are the contracts that could break with the applied-driving + badge normalization — they are INTENTIONALLY updated/verified in Tasks 7-8, not regressions.
- `common.actions.reveal` ("Reveal") exists — reuse for the reveal header; `common.actions.next` ("Next") exists — reuse for pagination Next; `common.actions.previous` does NOT exist — new key.
- Arabic in PowerShell output mangles — edit message JSON with the file tools, run `check:i18n` to validate.
- `role="combobox"` is ambiguous in SearchPage tests once the drawer + aside instances both render — use `getAllByRole('combobox')` for the dual-instance assertions.
- The tanstack-query-gate + providers-query tests prove the stack; if `Providers` renders cause auth-probe interference, mock `@/lib/api/auth-service` per the existing mocks (SessionProvider precedent).

### Project Structure Notes

- Frontend NEW: `frontend/src/components/search/ResultsTable.tsx`, `ResultsTableStackedRow.tsx`, `ActiveFilterChips.tsx`, `frontend/src/__tests__/results-table.test.tsx`, `results-table-stacked-row.test.tsx`, `active-filter-chips.test.tsx`, `providers-query.test.tsx`, `frontend/src/components/ui/table.tsx` + `skeleton.tsx` (shadcn CLI).
- Frontend UPDATE: `SearchPage.tsx` (useQuery + results area + clear-all + applied + shared wilaya query), `FilterSidebar.tsx` (stagedPatch/clearNonce/onClearAllRequest + badge normalization + dirty-guard resync), `WilayaCombobox.tsx` (optional controlled inputValue), `Providers.tsx` (QueryClientProvider), `http-client.ts` (timeout), `search-service.ts` (typed rows + signal + SearchResult<T>), `messages/{en,fr,ar}.json` (+11 −0 ×3), `__tests__/{search-page,filter-sidebar,search-service}.test.tsx` (updates).
- Backend UPDATE: `apps/search/filters.py` + `views.py` (companies `industry` sort), `apps/search/tests/test_company_search.py` (+sort tests).
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-5 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 stays in-progress.
- Deferred-work: `_bmad-output/implementation-artifacts/deferred-work.md` — RESOLVED by 3.5: axios timeout/abort, aria-live move, AD-20 adoption (from gate to consumer), applied re-sync + chips drive, badge landmine, dual-instance combobox query; NEW defer: the `/companies/:id` target (404 until the company-detail story lands).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-05-results-table-stacked-row.md] Story spec (all ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/index.md] Epic 3 story table (3.5 deliverable line)
- [Source: docs/ARCHITECTURE-SPINE.md] AD-20 (first real consumer; QueryClientProvider in Providers; queryFn via AD-19 services; session stays SessionProvider-owned; retry/polling semantics); Component Tree (ResultsArea > ActiveFilterChips/ResultsTable/ResultsTableStackedRow/RevealButton; CompanyDetailPage = separate surface); §AD-19 HttpClient; GET /api/search/people sort contract (#L667)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L124] Results-table row — aria-sort + sort-change announcements via the polite live region, per-tab columns, 100/page pagination, >1,000 truncation notice, RTL flip with stable CSV order, stacked-row collapse, company-name-as-real-link; #L142 Cold load (skeleton rows + cached-taxonomy filter panel); #L144 Empty results (broaden suggestion + one-click clear-all); #L147 Truncated; #L189 Per-fragment language; #L198 <md touch targets
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md#L147-L157] results-table tokens (header small/600/muted-foreground, 48px rows, border-b, hover muted, tabular-nums) + results-table-stacked-row tokens (card fill, 1px border, rounded.lg, gutter padding; title lead + small muted meta; full-width reveal); #L330 results-table spec (columns per tab, chevron at inline-end, RTL flip + stable order, tabular-nums on People-count + wilaya code); #L331 stacked-row spec
- [Source: _bmad-output/implementation-artifacts/3-2-search-api-endpoints.md] Sort contract (whitelists decision 7; parse_sort; `sort=field:asc|desc`; default name:asc; NULLS LAST universal); response shapes (people/company row keys); 100/page + truncation
- [Source: _bmad-output/implementation-artifacts/3-3-filter-sidebar-component.md] Draft-vs-applied model (D1), applied-effect deferral note, one-call-per-Apply, aria-disabled busy/rate-limited, count/truncated placeholder region, `#results` aria-live placement
- [Source: _bmad-output/implementation-artifacts/3-4-wilaya-combobox.md] COMPLETED 3.4 — `data-testid="results-slot"` contract + `#results` aria-live region, `SearchResult` shape, `wilayaDisplayName`/`wilayaDisplayLabel` precedent (`31 — Oran`), wilayaCount badge semantics, AD-20 gate PASSED record, i18n-shape test, Western-digit lesson
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] 3.5-OWNED: axios timeout/abort, aria-live move, AD-20 adoption record, applied re-sync + chips ("3.5 (chips) and 3.6 must drive applied with stable object identity"), dual-instance combobox query, badge 2×N landmine
- [Source: https://ui.shadcn.com/r/styles/base-nova/table.json] base-nova `table` registry item (semantic `<table>` wrappers, token classes, no Base UI dep) — verified 2026-08-05
- [Source: https://ui.shadcn.com/r/styles/base-nova/skeleton.json] base-nova `skeleton` registry item (`animate-pulse rounded-md bg-muted`) — verified 2026-08-05
- [Source: frontend/src/components/search/SearchPage.tsx, FilterSidebar.tsx, WilayaCombobox.tsx, frontend/src/components/providers/Providers.tsx, frontend/src/lib/api/{http-client,search-service}.ts, frontend/src/__tests__/search-page.test.tsx] Current wiring to preserve (results-slot, phases, in-flight ref, badge math, applied effect, sort/page params, mocks)

## Review Findings

(No review yet — dev in progress. Stage 3 fills this section.)

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

(Stage 2 fills this section.)

### Completion Notes List

(Stage 2 fills this section.)

### File List

- `_bmad-output/implementation-artifacts/3-5-results-table-stacked-row.md` — UPDATE (this story; status → review → done)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (3-5 → ready-for-dev → in-progress → review → done)
- `_bmad-output/implementation-artifacts/deferred-work.md` — UPDATE (3.5-resolved items closed; /companies/:id defer recorded)
- `frontend/src/components/search/ResultsTable.tsx` — NEW (sortable table + pure sort helpers)
- `frontend/src/components/search/ResultsTableStackedRow.tsx` — NEW (mobile cards)
- `frontend/src/components/search/ActiveFilterChips.tsx` — NEW (applied-filter chips)
- `frontend/src/components/ui/table.tsx`, `skeleton.tsx` — NEW (shadcn CLI registry)
- `frontend/src/components/search/SearchPage.tsx` — UPDATE (useQuery consumer, results area, pagination, clear-all, applied, shared wilaya query)
- `frontend/src/components/search/FilterSidebar.tsx` — UPDATE (stagedPatch/clearNonce/onClearAllRequest, badge normalization, dirty-guard resync)
- `frontend/src/components/search/WilayaCombobox.tsx` — UPDATE (optional controlled inputValue)
- `frontend/src/components/providers/Providers.tsx` — UPDATE (QueryClientProvider)
- `frontend/src/lib/api/http-client.ts` — UPDATE (timeout)
- `frontend/src/lib/api/search-service.ts` — UPDATE (typed rows, SearchResult<T>, signal)
- `frontend/messages/{en,fr,ar}.json` — UPDATE (+11 −0 keys; amended empty value)
- `frontend/src/__tests__/{results-table,results-table-stacked-row,active-filter-chips,providers-query}.test.tsx` — NEW
- `frontend/src/__tests__/{search-page,filter-sidebar,search-service}.test.tsx` — UPDATE
- `backend/apps/search/filters.py` + `views.py` — UPDATE (companies industry sort)
- `backend/apps/search/tests/test_company_search.py` — UPDATE (industry sort tests)

## Change Log

- 2026-08-05: Story created (ready-for-dev) from epic 3.5 spec; Sally UX consultation resolved 12 design decisions (stock base-nova table + skeleton registry components — registry-verified, zero new deps; no stock pagination — hand-rolled Button + tokens; sort cycle none→asc→desc→none with server whitelists + industry whitelist backend extension for the AC-literal all-columns-sortable; pagination 100/page + current-page indication + page-reset-on-filter-change; live region moved to the count/status line with sr-only sort/page announcements; real-header skeleton rows with aria-busy and zero layout shift; empty broaden amend + page-level Clear all (draft + wilayas, staged — no query) + sidebar Clear All unification via optional onClearAllRequest; /companies/:id rendered as the AC-literal real link with NO stub (documented temporary 404); reveal column = inert slot for Epic 4.2; ActiveFilterChips in scope per the 3.3 deferred note + applied stable-identity drive + dirty-guard resync + badge normalization (wilayaCount single source); dual-instance combobox query lifted via optional controlled inputValue; AD-20 adoption approved — QueryClientProvider in Providers (retry:false quota contract) + useQuery consumer + inFlightRef removed; axios timeout + abort signal wiring (3.5-OWNED)). No John consultation — the only AC tension (industry sortability) is technical, not product; resolved via the 3.2 whitelist extension. Validated against checklist; sprint-status 3-5 → ready-for-dev.
