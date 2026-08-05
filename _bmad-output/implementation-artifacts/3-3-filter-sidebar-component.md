---
story_id: 3.3
epic: 3
title: Story 3.3 — Filter Sidebar Component
status: ready-for-dev
frs: [FR-5, FR-6, FR-7, FR-9, FR-11, FR-12, FR-13]
ads: [AD-2, AD-9, AD-19]
ux_drs: [UX-DR8, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
---

# Story 3.3: Filter Sidebar Component

Status: ready-for-dev

## Story

As a **user searching for B2B contacts**,
I want **a filter sidebar on the search page where I can stage my filter selections and then explicitly click Apply**,
So that **I control when my daily search quota is consumed**.

## Acceptance Criteria

**Given** the Filter Sidebar component on desktop (≥md)
**When** the search page renders
**Then** a persistent inline-start sidebar is shown at {spacing.sidebar-width} wide
**And** it has {colors.card} fill with `border-inline-end: 1px solid {colors.border}`

**Given** the filter groups in the sidebar
**When** I inspect the sidebar
**Then** it contains in order:
- **Industry**: multi-select checkboxes, "Select all" / "Clear"
- **Wilaya**: Wilaya Combobox (Story 3.4)
- **Seniority** (People tab only): checkboxes — Owner/Founder, C-level, Director, Manager, Individual Contributor
- **Company Size** (Companies tab only): checkboxes — 1–10, 11–50, 51–200, 201–500, 500+, "Include unknown size" toggle (off by default)
- **Keyword**: free-text input with diacritic-insensitive matching
- Group labels in {typography.caption} — no uppercase (Arabic has no case)
- Controls are stock shadcn (Select, Command, Checkbox, Input)

**Given** the Apply button
**When** I inspect the bottom of the sidebar
**Then** a full-width Apply button is pinned at the bottom
**And** it uses {colors.primary} / {colors.primary-foreground}, {rounded.md}
**And** clicking it fires exactly one query = one search counted (FR-7)

**Given** the staged editing model
**When** I change filter values
**Then** changes are staged locally — nothing re-queries on individual changes
**And** only clicking Apply triggers the search

**Given** the mobile Filter Sidebar (<md)
**When** on a mobile viewport
**Then** the sidebar becomes a bottom-sheet drawer triggered by a "Filters (n)" badge button
**And** the badge shows the count of staged + active filters
**And** the bottom-sheet has: visible close button, scrim tap dismiss, swipe-down dismiss, Esc key dismiss
**And** focus returns to the trigger on close

**Given** empty state
**When** no filters are active and search hasn't been run
**Then** the results area shows the Checklist Card (Story 3.7) and empty state prompt

## Tasks / Subtasks

- [ ] **Task 1: UI controls + data prerequisite** (AC: stock shadcn controls; group order)
  - [ ] 1.1 RED-probe: `frontend/src/components/ui/` currently ships only `button.tsx` + `select.tsx` (base-nova style, `@base-ui/react` ^1.6.0 — no Radix, no cmdk). Add the stock shadcn wrappers this story needs via the project's shadcn CLI from `frontend/`: `npx shadcn@latest add checkbox input drawer badge tooltip label separator scroll-area` (components.json style `base-nova`; Base UI registry). If any component is unavailable from the registry, fall back to the raw `@base-ui/react` primitive in a `frontend/src/components/ui/<name>.tsx` wrapper (DangerZone dialog precedent — primitives with Base UI API, e.g. Checkbox uses `checked`/`onCheckedChange`). NO new npm packages beyond `@base-ui/react` subpaths; `@radix-ui/*` must NOT be added (project is base-nova; AD-2).
  - [ ] 1.2 `frontend/src/data/industries.ts` — NEW — mirror `backend/apps/search/data/industries.py` EXACTLY (35 entries, same order, same trilingual names): `{ id: number; name_ar: string; name_fr: string; name_en: string }`, `id` = 1-based seed index (migration 0004 inserts in list order → serial ids 1..35). Export `INDUSTRIES` + `Industry` type. Test: `frontend/src/__tests__/industries-data.test.ts` — NEW — asserts 35 entries, ids 1..35 contiguous, every entry has all 3 names non-empty, and `name_en` values equal the backend `backend/apps/search/data/industries.py` list order (import both; no cross-package test infra exists — the parity check is a dev-run comparison documented in this story + deferred-work.md, plus the shape test above).

- [ ] **Task 2: i18n keys ×3 locales** (AC: group labels caption; D7)
  - [ ] 2.1 `frontend/messages/en.json` — UPDATE — reuse EXISTING keys for group labels (values already sentence-case): `search.filters.industry`, `search.filters.wilaya`, `search.filters.seniority`, `search.filters.size`, `search.filters.keyword`, `search.filters.apply` ("Apply Filters"), `search.filters.clear` ("Clear All"), `search.filters.wilaya_placeholder`, `search.placeholder` (keyword input placeholder), `search.seniority.*` (5 bands), `search.size.*` (5 bands), `common.actions.close`, `common.states.loading`/`rate_limited`/`error`, `search.results.count`/`empty`/`truncated`. NEW keys (values are working drafts — native-speaker review is a pre-launch item, PRD Open Q7):
    - `search.filters.badge`: "Filters ({count})" — mobile trigger + sr-only announcement
    - `search.filters.select_all`: "Select all"
    - `search.filters.clear_group`: "Clear"
    - `search.filters.include_unknown_size`: "Include unknown size"
    - `search.filters.wilaya_soon`: "Wilaya picker coming soon" — caption under the disabled placeholder trigger
    - `search.results.not_run`: "Apply your filters and run a search to see results"
    - `search.results.retry`: "Retry"
    - `search.skip_to_results`: "Skip to results"
  - [ ] 2.2 Mirror all keys in `fr.json` + `ar.json` (Arabic for AR — no uppercase transforms apply; Western Arabic numerals only in interpolations). `npm.cmd run check:i18n` must pass (en = source of truth; counts identical across the 3 files).

- [ ] **Task 3: Shared filter model + service** (AC: staged model, one query per Apply; D5)
  - [ ] 3.1 RED: `frontend/src/__tests__/search-service.test.ts` — NEW — `countActiveFilters`: empty → 0; {industries:[1,2], keyword:''} → 2; {wilayas:[31], seniorities:['director']} → 2; keyword non-empty +1; includeUnknownSize true +1; all empty → 0. `buildFiltersPayload(f, 'people')` → keys EXACTLY `industry, wilaya, seniority, keyword` (no `size`, no `include_unknown_size`); `buildFiltersPayload(f, 'companies')` → `industry, wilaya, size, keyword, include_unknown_size` (include_unknown_size ALWAYS present for companies, false default — 3.2 serializer contract); empty lists serialized as `[]`; unknown keys never present. `SearchService.searchPeople/searchCompanies` — mock `HttpClient` get: asserts URL `/api/search/people/` + `/api/search/companies/`, `filters` param is JSON-encoded (3.2 contract: `filters` = JSON-encoded query param), page/sort params defaulted `1`/`name:asc`; response shape `{results, total, page, truncated, refine_prompt}` typed.
  - [ ] 3.2 GREEN: `frontend/src/lib/api/search-service.ts` — NEW — `SearchTab = 'people' | 'companies'`; `StagedFilters { industries: number[]; wilayas: number[]; seniorities: string[]; sizes: string[]; includeUnknownSize: boolean; keyword: string }`; `EMPTY_FILTERS`; `countActiveFilters(f)` (pure); `buildFiltersPayload(f, tab)` (pure, people/companies key sets per 3.2 — never emits `size`/`include_unknown_size` for people); `SearchResult { results: unknown[]; total: number; page: number; truncated: boolean; refine_prompt: string | null }`; `class SearchService extends HttpClient` with `searchPeople(filtersJson: string, page = 1, sort = 'name:asc')` and `searchCompanies(...)` (axios get via `this.client.get`, JSON.stringify'd filters); `export const searchService = new SearchService()` (AuthService precedent). mypy-style strict TS annotations; no code comments unless necessary.

- [ ] **Task 4: CheckboxGroup + keyword field** (AC: industry/seniority/size groups; D1)
  - [ ] 4.1 RED: `frontend/src/__tests__/checkbox-group.test.tsx` — NEW — renders label (i18n key) in `text-caption`; one checkbox per option with visible label (checkbox + label pair, NOT placeholder); checked state from `selected`; toggling calls `onToggle(value)`; "Select all" appears only when partial (checks all — calls `onSelectAll`), label switches to "Clear" when all selected (calls `onClear`) — resolved semantics: group header shows Select all / Clear dual affordance per AC; 44px touch target on mobile (`min-h-11 md:min-h-0` class present); group container has `role="group"` + `aria-labelledby` → heading id.
  - [ ] 4.2 GREEN: `frontend/src/components/search/CheckboxGroup.tsx` — NEW — client; props `{ id, labelKey, options: {value,labelKey}[], selected: string[], onToggle(value), onSelectAll(), onClear(), disabled? }`; shadcn Checkbox (Base UI: `checked`/`onCheckedChange`) + visible `<label>` per option; heading `<h3 id={id}>` in `text-caption text-muted-foreground` (NO `uppercase` — D7); Select all/Clear toggle button row in `text-caption text-primary`; logical properties only; `min-h-11 md:min-h-0` on rows (UX-DR22 touch inflation).
  - [ ] 4.3 RED+GREEN: keyword field — `frontend/src/components/search/KeywordField.tsx` — NEW — `<label htmlFor>` visible (search.filters.keyword) + shadcn Input (placeholder `search.placeholder`), `aria-describedby` on the field's helper note: "Diacritic-insensitive — 'café' finds 'cafe'" is server-side (3.2) so NO client normalization — the note is a static hint key `search.filters.keyword_hint` (add to Task 2 key list). Test in `filter-sidebar` suite: input reflects draft.keyword, typing updates draft without firing the service.

- [ ] **Task 5: FilterSidebar — groups, staged state, Apply, badge** (AC: all sidebar ACs; D1, D3, D5)
  - [ ] 5.1 RED: `frontend/src/__tests__/filter-sidebar.test.tsx` — NEW — desktop container: renders at `w-sidebar-width` (assert class `w-sidebar-width` — token, never hardcoded px), `bg-card`, `border-inline-end border-border`; group ORDER assertion via `querySelectorAll('h3')` → Industry, Wilaya, Seniority (tab=people) OR Company Size (tab=companies), Keyword; seniority group ABSENT for companies, size group ABSENT for people; group labels render i18n KEYS (mocked) and no uppercase class (`uppercase` class absent); industry group lists 35 localized options from INDUSTRIES; **staged-not-instant**: toggling an industry + typing keyword + flipping include_unknown_size → `onSubmit` NOT called (mock), zero service calls; **Apply fires exactly once**: click Apply → `onSubmit` called exactly once with the full staged draft; busy → Apply `aria-disabled` (still focusable, not `disabled`); rateLimited → Apply `aria-disabled` + rate-limit message rendered adjacent with `aria-describedby` wiring; wilaya placeholder: disabled Select trigger renders `search.filters.wilaya_placeholder` + `search.filters.wilaya_soon` caption referenced via `aria-describedby`; `wilayaCount` prop feeds the badge count; Clear All resets draft to empty (badge 0) without firing; per-group Clear empties only that group.
  - [ ] 5.2 GREEN: `frontend/src/components/search/FilterSidebar.tsx` — NEW — client; props `{ tab, applied?, busy?, rateLimited?, rateLimitMessage?, wilayaField?, wilayaCount?, onSubmit }` (see Dev Notes for the exact contract); internal `draft` state initialized from `applied` (useState lazy init); `useEffect` re-syncs draft when `applied` changes (documented for 3.6 saved-search re-runs; no clobber while editing since parent only updates applied on submit); groups in AC order; seniority/size groups gated by `tab`; keyword via KeywordField; Apply pinned at bottom (sidebar `flex flex-col`, groups scrollable `overflow-y-auto` + `grow`, Apply in a footer zone with `border-inline-end` container styling per AC); Apply click → `onSubmit(structuredClone(draft))` exactly once; `aria-disabled` when busy||rateLimited; clear-all button (`search.filters.clear`) resets draft; **mobile trigger**: badge button `md:hidden min-h-11` with `search.filters.badge` count = `countActiveFilters(draft)` + sr-only `aria-live="polite"` span announcing count changes (LocaleSwitcher precedent); badge count includes `wilayaCount` when no wilayaField (placeholder counts 0).
  - [ ] 5.3 RED+GREEN: mobile drawer — same suite: trigger opens the drawer; sheet labelled by `search.filters.title`; visible close button; scrim tap closes; Esc closes; swipe-down (fireEvent.touchStart/move/end on the sheet) closes past threshold; on close focus returns to the trigger button (`document.activeElement` assertion); drawer reuses the SAME group tree (assert groups inside sheet). GREEN: mobile shell in `FilterSidebar.tsx` — Base UI `Drawer` (project primitives; `DangerZone.tsx` dialog precedent — `@base-ui/react/drawer`), backdrop scrim, close button (`common.actions.close`), Esc + scrim = drawer defaults, swipe-down via touch handlers on the sheet (threshold ≈30% of sheet height, `overscroll-behavior: contain` on the sheet), focus restore default + test-asserted; `role="dialog"` `aria-modal` labelled by the title.
  - [ ] 5.4 RTL smoke: same suite — render in `dir="rtl"` container: group ORDER in DOM unchanged (logical flex flow), `border-inline-end` class present (flips automatically), no physical-property classes anywhere in the rendered tree (`margin-left`, `left-` classes absent).

- [ ] **Task 6: SearchPage + minimal /search routes + empty state** (AC: search page renders; empty state; D2, D6)
  - [ ] 6.1 RED: `frontend/src/__tests__/search-page.test.tsx` — NEW — renders tab links (`search.people_tab`/`search.companies_tab`) with correct active styling per `tab` prop; renders FilterSidebar with `tab`; **empty state**: before any search → `search.results.not_run` prompt + checklist slot region (`data-testid="checklist-slot"`, empty) + NO count line; sidebar present; skip-to-results link (`search.skip_to_results`) targets `#results`; **Apply → exactly one service call**: mock `@/lib/api/search-service` (`searchService.searchPeople`/`searchCompanies` via vi.hoisted) → click Apply → `searchPeople` called ONCE with `buildFiltersPayload`-encoded filters; count line `search.results.count` renders `{count}`; truncated → `search.results.truncated` notice; **429** → rate-limited state: Apply `aria-disabled`, `search.results.rate_limited` message (or server detail when present) rendered; **error** → `common.states.error` + Retry button (`search.results.retry`) re-fires the same query (exactly one more call); results area carries `id="results"` + `aria-live="polite"`.
  - [ ] 6.2 GREEN: `frontend/src/app/[locale]/search/page.tsx` — NEW — server page (setRequestLocale + generateMetadata, login page precedent; `search.title` meta); renders `<SearchPage tab="people" />`. `frontend/src/app/[locale]/search/companies/page.tsx` — NEW — same, `tab="companies"`. `frontend/src/components/search/SearchPage.tsx` — NEW — client; holds `result: SearchResult | null`, `phase: 'idle'|'loading'|'error'|'rate_limited'`, `rateLimitMessage`; `handleApply(draft)` → build payload → single `searchService.searchPeople|searchCompanies` call → success sets result (loading→idle), 429 (axios error with `response.data.code === 'search_limit_exceeded'`) → rate_limited (+ detail message), other → error; `handleRetry` re-fires the last payload; renders: skip link, tab bar (people/companies links via `@/i18n/navigation` `Link` — tab order People, Companies), layout `flex` with FilterSidebar (`wilayaField` = disabled Select placeholder — Task 5.2 slot; `wilayaCount=0`), results region (`id="results"`, `aria-live="polite"`): idle → empty state (not_run prompt + `data-testid="checklist-slot"` region where 3.7 mounts the Checklist Card — renders nothing today, documented) + Clear-all only when draft non-empty (passes through sidebar's own Clear All — no duplicate control); success → count line (`search.results.count`, `tabular-nums` per AD-8) + truncated notice + placeholder region (results table lands in 3.5 — the region renders an empty bordered slot with no user-visible "coming soon" copy); zero matches → `search.results.empty`.
  - [ ] 6.3 Header dead links: `/search` + `/search/companies` now resolve — no Header change needed (links already exist); verify nothing else references a missing route.

- [ ] **Task 7: Verification gates + story sync** (all ACs)
  - [ ] 7.1 Frontend (from `frontend/`): `npm.cmd test` all green (171 baseline + new), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (×3 locales).
  - [ ] 7.2 Backend regression (no backend changes — 3.3 is a UI story; from `backend/`): `.\.venv\Scripts\python.exe -m pytest` green (352 baseline), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0.
  - [ ] 7.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-3 → ready-for-dev → in-progress → review; epic-3 stays in-progress). Commit as `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.

## Dev Notes

### Decided constraints (confirmed with Sally — UX designer consultation 2026-08-05)

- **Staged-editing state model (decision 1 — D1)**: `draft` (working) vs `applied` (last committed). Draft = the union of carried-over applied values + newly staged ones — the "Filters (n)" badge counts `countActiveFilters(draft)` (industries + wilayas + seniorities + sizes + keyword-nonempty + include-unknown-size-on). AC's "staged + active" resolves to this single number (it IS what Apply would run). Reset semantics: per-group "Clear" empties that group's draft; "Clear All" empties the draft; NEITHER fires a query — only Apply triggers the search (FR-7: never silently burn the daily cap; EXPERIENCE §Interaction Primitives Apply-not-instant + filter-chip "removing a chip stages the removal"). Badge count changes announced via sr-only `aria-live="polite"` (LocaleSwitcher precedent, EXPERIENCE §Component Patterns).
- **Component home (decision 2 — D2, user-approved 2026-08-05)**: minimal `/search` (People) + `/search/companies` (Companies) server pages rendering the client `SearchPage` (sidebar + tab links + placeholder results region). The results TABLE is Story 3.5; 3.3's post-search region shows the count + truncated notice only. IA routes per EXPERIENCE §Information Architecture (/search People default, /search/companies Companies).
- **Wilaya wiring contract (decision 3 — D3)**: `FilterSidebar` takes `wilayaField?: ReactNode` + `wilayaCount?: number` (default 0); the placeholder (disabled stock Select trigger, `search.filters.wilaya_placeholder` + `wilaya_soon` caption via `aria-describedby`) ships in 3.3; Story 3.4 passes `<WilayaCombobox>` + real count with ZERO sidebar changes — documented contract for 3.4. The AC-literal combobox is 3.4's deliverable; the placeholder keeps the group visible, in-order, non-interactive (informational, not a dead-end — AD-24 spirit).
- **Mobile bottom-sheet (decision 4 — D4)**: Base UI `Drawer` (project primitive — `@base-ui/react/drawer`; DangerZone dialog precedent). Trigger: badge button `md:hidden` + `min-h-11` (44px touch target, UX-DR22). Dismiss: visible close button, scrim tap, Esc (drawer defaults) + swipe-down via touch handlers (threshold ≈30% sheet height, `overscroll-behavior: contain`). Focus: drawer traps focus, initial focus on close button, focus RETURNS to the trigger on close (asserted). Sheet labelled by `search.filters.title`, `role="dialog"` `aria-modal`. One component tree, responsive container swap — logical props only (RTL free).
- **Apply semantics (decision 5 — D5)**: one click → `onSubmit(draft)` → EXACTLY ONE `searchService.searchPeople|searchCompanies` call (page-level; ref guard while in-flight; test asserts invocation count 1). Busy → `aria-disabled` (focusable — AD-24 disabled-but-actionable). 429 → `aria-disabled` + inline message (server `detail` when present, else `common.states.rate_limited`) adjacent to Apply, `aria-describedby`; filters stay staged for tomorrow (EXPERIENCE §State Patterns rate-limited row). Zero-filter Apply is a legal query (all records; counts once — 3.2 decision 11 / Q8). **TanStack Query (AD-20) NOT adopted in 3.3**: the sidebar is a local-state component; the single-shot Apply is not a caching consumer — AD-20's "first real consumer" is the 3.5 results table (adoption gate: verify v5 under vitest 2.x/Vite-CJS). Recorded in deferred-work.md.
- **Empty state (decision 6 — D6)**: pre-first-search → `search.results.not_run` prompt + `data-testid="checklist-slot"` region (3.7 mounts the Checklist Card there; 3.3 renders nothing — no half-built 3.7). Post-search: count line + truncated notice; zero matches → existing `search.results.empty`. Skip-to-results link (EXPERIENCE §Accessibility Floor bypass blocks).
- **i18n key naming (decision 7 — D7)**: group labels REUSE existing keys (`search.filters.*`); NO `text-transform: uppercase` anywhere (Arabic has no case — AC literal); new keys enumerated in Task 2 with working-draft translations (PRD Open Q7 native review pending). Values use Western Arabic numerals in interpolations only (AD-8).
- **Industry taxonomy (decision 8)**: `frontend/src/data/industries.ts` mirrors `backend/apps/search/data/industries.py` (35 entries, seed order = serial ids 1..35 — migration 0004 inserts list-order). No industries-list endpoint exists (3.2 ships search only), so the sidebar renders the static list; cross-stack parity is a dev-run check + deferred item (extends the 3.4 wilaya parity item in deferred-work.md). Industry labels render from the active locale's name field via `useLocale()`.
- **No John (PM) consultation (decision 9)**: ACs fully specify behavior (badge semantics, one-query-per-Apply, reset staging, empty state); backend counting semantics fixed by 3.2 (Q8) — no open product questions (3.2 decision-10 precedent).

### Existing patterns to follow (from 2-5 / 3-2 precedents)

- Component + test layout: client components in `frontend/src/components/<domain>/`, tests in `frontend/src/__tests__/<name>.test.tsx` (2-5 precedent); services in `frontend/src/lib/api/<domain>-service.ts` extending `HttpClient` (AD-19, AuthService precedent), singleton export.
- Tests: vitest + jsdom; `src/test/setup.ts` imports `mocks.ts` (next-intl `useTranslations` returns the KEY, `useLocale` → 'en'; next/navigation stubbed) — assert message KEYS never values; module mocks via `vi.hoisted` + `vi.mock('@/lib/api/search-service')`; `fireEvent` (user-event installed but unused — 2-5 convention); RHF NOT used here (filters are not a form — plain useState; AD-18 governs forms, this is not one); async service calls → `waitFor`/`findBy*`; jest-dom matchers.
- Design tokens (AD-2/AD-9): `w-sidebar-width` (`--spacing-sidebar-width: 288px`), `bg-card`, `border-inline-end border-border`, `text-primary`/`bg-primary`/`text-primary-foreground`, `rounded-md`, `text-caption text-muted-foreground` (`--font-size-caption: 12px`), `text-small`; logical properties ONLY (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`border-inline-*`) — never hardcode 288px or hex values.
- Mobile touch inflation (UX-DR22): `min-h-11` on interactive rows/buttons `< md` (existing components use h-8/h-9 — sidebar rows must inflate on mobile).
- No code comments unless necessary; commit style `Story 3.3: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.
- Checkboxes `- [x]` stay unchecked until dev executes them — tasks above are the live checklist.

### Implementation notes

- Exact prop contract for `FilterSidebar`:
  `{ tab: SearchTab; applied?: StagedFilters; busy?: boolean; rateLimited?: boolean; rateLimitMessage?: string; wilayaField?: ReactNode; wilayaCount?: number; onSubmit: (filters: StagedFilters) => void }` — `applied` defaults to `EMPTY_FILTERS`; draft lazily initialized from `applied`; a `useEffect([applied])` re-syncs the draft when applied changes (3.6 saved-search re-runs will drive this; no clobber while editing because the parent only mutates `applied` after a submit).
- Payload contract (3.2): `filters` = JSON-encoded query param; people keys `industry/wilaya/seniority/keyword`; companies keys `industry/wilaya/size/keyword/include_unknown_size`; empty lists = no filter; `include_unknown_size` must NEVER appear in a people payload (3.2 review patch: `invalid_filter` server-side).
- `SearchService` methods: `searchPeople(filtersJson: string, page = 1, sort = 'name:asc'): Promise<SearchResult>` — GET `/api/search/people/` with `{ filters, page, sort }` params; same for companies at `/api/search/companies/`. 429 detection: axios error → `error.response?.status === 429` (detail message at `error.response.data.detail`).
- Drawer: Base UI `Drawer.Root`/`Portal`/`Backdrop`/`Popup` (+ `Title`/`Close`) — DangerZone dialog precedent at `frontend/src/components/settings/DangerZone.tsx`; swipe-down: `onTouchStart`/`onTouchMove`/`onTouchEnd` on the sheet, closing when cumulative deltaY > 30% of sheet height.
- Industry option rendering: `useLocale()` from next-intl → `name_{locale}` field (fallback `name_en`); the wilaya-combobox transliteration fallback is 3.4's concern — industries have no fallback requirement.
- Test note: `structureClone` is available in jsdom; the Apply handler must pass a copy of the draft so later edits don't mutate the submitted value.
- The `search.results.count` key interpolates `{count}` (existing); AD-8 `tabular-nums` on the count line.

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd`; backend venv `backend\.venv\Scripts\` (run from `backend/`); system python is 3.10 — use the venv python for backend gates.
- Do NOT add Radix packages (`@radix-ui/react-checkbox` etc.) — the project is shadcn v4 base-nova on `@base-ui/react` ^1.6.0; Base UI Checkbox uses `checked`/`onCheckedChange` (NOT `onChange`).
- Do NOT use `text-transform: uppercase` on group labels (Arabic has no case — AC literal; also breaks Arabic joining).
- Do NOT touch the backend (`backend/` unchanged), `http-client.ts`, `auth-service.ts`, the interceptor, or `src/test/mocks.ts` (unless a new mock is needed for the drawer).
- Do NOT normalize the keyword client-side — diacritic-insensitive matching is server-side (3.2 `plainto_tsquery` + unaccent + tashkeel strip); the field is plain text.
- Do NOT adopt TanStack Query in this story (decision 5; AD-20 gate — verify v5 under vitest 2.x first, in 3.5).
- jsdom has no real viewport — the mobile trigger and desktop sidebar coexist in the DOM (`md:hidden`/`hidden md:flex`); tests assert on both, never on window width.
- Base UI drawer renders in a Portal — query the sheet via `document.body` (DangerZone test precedent) or container-scoped queries where possible.
- `next/link` is NOT available in tests (next/navigation mocked wholesale) — tab links use `@/i18n/navigation` Link; if tests need them, assert on href strings, and keep SearchPage's own logic mock-agnostic.
- i18n parity: `npm.cmd run check:i18n` compares key SETS (en = source of truth) — every new key must land in fr + ar or the gate fails.

### Project Structure Notes

- Frontend NEW: `frontend/src/components/search/FilterSidebar.tsx`, `frontend/src/components/search/CheckboxGroup.tsx`, `frontend/src/components/search/KeywordField.tsx`, `frontend/src/components/search/SearchPage.tsx`, `frontend/src/components/ui/{checkbox,input,drawer,badge,tooltip,label,separator,scroll-area}.tsx` (shadcn CLI / Base UI wrappers), `frontend/src/lib/api/search-service.ts`, `frontend/src/data/industries.ts`, `frontend/src/app/[locale]/search/page.tsx`, `frontend/src/app/[locale]/search/companies/page.tsx`.
- Frontend UPDATE: `frontend/messages/{en,fr,ar}.json` (+8 keys ×3), tests `frontend/src/__tests__/{search-service,checkbox-group,filter-sidebar,search-page,industries-data}.test.tsx` (NEW).
- Backend: NO changes (regression gates only).
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-3 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 stays in-progress.
- Deferred-work: `_bmad-output/implementation-artifacts/deferred-work.md` — add: TanStack Query adoption gate (AD-20, first real consumer = 3.5), industries parity (backend `data/industries.py` ↔ frontend `data/industries.ts` — extend the existing 3.4 wilaya parity item).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-03-filter-sidebar-component.md] Story spec (all ACs)
- [Source: _bmad-output/implementation-artifacts/3-2-search-api-endpoints.md] Completed 3.2 — filters JSONB contract (people vs companies key sets), 429 shape (`code: search_limit_exceeded` + `detail` + `limit`), Q8 counting semantics, story format precedent
- [Source: _bmad-output/implementation-artifacts/2-5-auth-ui-components.md] Completed 2.5 — frontend component story precedent (RTL/a11y conventions, i18n keys ×3, aria-live patterns, test conventions)
- [Source: docs/ARCHITECTURE-SPINE.md#L313-L325] AD-18 forms (NOT used — filters are not a form); #L337-L343 AD-20 TanStack Query (deferred); #L347-L367 component tree (FilterSidebar > WilayaCombobox + ResultsArea > ChecklistCard); #L384-L397 SearchLayout routes
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md] §Component Patterns filter-sidebar row (staged edits, Apply = 1 search, badge counts staged + active, groups in order, include-unknown-size off); filter-chip row (removal stages); §Interaction Primitives (Apply-not-instant, disabled-but-actionable); §State Patterns (rate-limited row: aria-disabled + inline message + aria-describedby; empty results: broaden + clear-all); §Accessibility Floor (bottom-sheet dismiss paths + focus return; skip-to-results; 44px touch targets; aria-live polite); §Responsive (md breakpoint → bottom-sheet)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md] §Components filter-sidebar spec (288px via {spacing.sidebar-width}, card fill, border-inline-end, caption uppercase-free labels, Apply pinned bottom primary/rounded-md, Filters(n) badge in primary); colors/typography token tables; §Do's and Don'ts (logical properties, no uppercase, Western numerals)
- [Source: _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L86-L124] FR-9 (multi-select + select all/clear), FR-11 (seniority bands), FR-12 (size bands + include-unknown off), FR-13 (keyword AND + diacritic-insensitive)
- [Source: backend/apps/search/data/industries.py] 35-industry seed (trilingual; seed order = serial ids) — frontend mirror source
- [Source: frontend/src/components/ui/button.tsx, select.tsx] base-nova shadcn API (Base UI); LocaleSwitcher Select usage + sr-only live-region precedent
- [Source: frontend/src/components/settings/DangerZone.tsx] Base UI Dialog primitive pattern (Backdrop/Popup/Title/Close) — drawer analog
- [Source: frontend/src/data/wilayas.ts] Multilingual data-file model (code + name_ar/fr/en)
- [Source: frontend/src/lib/api/auth-service.ts, http-client.ts] Service inheritance + interceptor patterns
- [Source: frontend/src/app/[locale]/login/page.tsx] Server page pattern (setRequestLocale, generateMetadata, Suspense)
- [Source: frontend/messages/en.json#L258-L312] Existing search namespace keys (group labels, seniority/size bands, results, apply/clear/save)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] Wilaya parity item (3.4) — industries parity extends it

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-08-05: Story created (ready-for-dev) from epic 3.3 spec; Sally UX consultation resolved 8 design decisions (staged-vs-applied draft model + badge semantics + reset-staging, minimal /search + /search/companies pages per user D2 approval, wilayaField slot + disabled-Select placeholder contract for 3.4, Base UI Drawer bottom-sheet with full dismiss path + focus return, one-call-per-Apply with aria-disabled busy/rate-limited states + no TanStack Query (3.5 gate), empty-state prompt + checklist-slot + count/truncated placeholder region, i18n key reuse + 8 new keys no-uppercase, industries.ts seed mirror); no John consultation (ACs fully specify — 3.2 precedent); validated against checklist; sprint-status 3-3 → ready-for-dev.
