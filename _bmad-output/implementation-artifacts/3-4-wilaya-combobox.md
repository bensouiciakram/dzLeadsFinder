---
story_id: 3.4
epic: 3
title: Story 3.4 — Wilaya Combobox
status: review
frs: [FR-10]
ads: [AD-2, AD-8, AD-9]
ux_drs: [UX-DR9, UX-DR21, UX-DR22, UX-DR23]
baseline_commit: c4a2dac
---

# Story 3.4: Wilaya Combobox

Status: review

## Story

As a **user filtering by location**,
I want **a searchable combobox that lets me find and select wilayas by code or trilingual name, with multi-select rendered as chips**,
So that **I can quickly narrow my search to specific regions I care about**.

## Acceptance Criteria

**Given** the Wilaya Combobox component
**When** it renders in the filter sidebar
**Then** it uses shadcn Command inside a Popover
**And** the trigger shows selected wilayas as {rounded.full} {colors.muted} chips
**And** the search input matches against code, Arabic name, French name, and English name

**Given** a user searches for a wilaya
**When** they type "31" or "Oran" or "وهران"
**Then** the dropdown filters to show matching wilayas
**And** each option row displays: `{code} — {localized name}` (e.g., "31 — Oran")
**And** the code is always in Western Arabic numerals
**And** the name falls back to transliterated Arabic if no locale name exists — never a blank

**Given** multi-select behavior
**When** a user selects a wilaya option
**Then** it appears as a removable chip inside the trigger
**And** the user can select multiple wilayas
**And** each chip has a remove affordance (keyboard-reachable)

**Given** keyboard accessibility
**When** the combobox is open
**Then** Enter/Space toggles an option
**And** Backspace/Delete removes the last chip when the search input is empty
**And** the search input has `aria-label` (minimum) — never placeholder-only
**And** Esc closes the popover and returns focus to the trigger

**Given** the wilaya data constraint
**When** the combobox loads
**Then** it contains exactly the 58 official wilayas (codes 1–58)
**And** no retired or non-existent wilaya codes are included

## Tasks / Subtasks

- [x] **Task 1: Wilaya parity consolidation + real parity test** (AC: exactly 58 official wilayas, codes 1–58, no retired codes; D2)
  - [x] 1.1 RED: `backend/apps/search/tests/test_wilaya_parity.py` — NEW — **real automated cross-stack parity test** (deferred-work 3.4-OWNED; replaces the dev-run note). Reads `frontend/src/data/wilayas.ts` and `frontend/src/data/industries.ts` from the repo (resolve relative to the test file: `Path(__file__).parents[4] / "frontend/src/data/wilayas.ts"` — verify the hop count at dev time), parses the literal arrays with a strict line regex (handle BOTH `'` and `"` quoted names — wilayas.ts uses `"M'Sila"` on codes 28/57), and asserts:
    - WILAYAS: exactly 58 entries; codes exactly 1..58 contiguous; every `name_ar`/`name_fr`/`name_en` non-empty; every TS entry equals the backend `WILAYAS` entry (code + 3 names) from `backend/apps/search/data/wilayas.py`.
    - INDUSTRIES: exactly 35 entries; ids 1..35 contiguous; every name non-empty; `name_en` sequence identical to `backend/apps/search/data/industries.py` list order (the 3.3 deferred extension of this item).
    - Parser fails LOUDLY on shape drift (unknown lines / missing fields) — this test is the canonical-source lockstep guard. Canonical source = the frontend TS files (already declared in `wilayas.py` header; add the same header note to `industries.py` if missing).
  - [x] 1.2 GREEN: run `.\.venv\Scripts\python.exe -m pytest backend/apps/search/tests/test_wilaya_parity.py` from `backend/` — the current data is in sync, so the test should pass on first run; if it fails, fix the DATA (never weaken the test).

- [x] **Task 2: shadcn registry components** (AC: stock shadcn Command-in-Popover; D1)
  - [x] 2.1 From `frontend/`: `npx shadcn@latest add combobox input-group` (style `base-nova`; the registry `combobox` item depends on `@base-ui/react` — ALREADY installed at ^1.6.0, so **zero new npm packages**; `input-group` is its registry dependency). Verify the generated `frontend/src/components/ui/combobox.tsx` + `input-group.tsx` compile (`npm.cmd run typecheck`).
  - [x] 2.2 Confirm the mapping: the registry `Combobox` (Base UI) IS the base-nova equivalent of "shadcn Command inside a Popover" — `ComboboxContent` is the portal-positioned popup (positioner + popup + `aria-label` support); a separate `popover` registry wrapper is NOT needed; `command`/cmdk does NOT exist in the base-nova registry and must NOT be added (3.3 Task 1.1 precedent, AD-2). Do NOT hand-edit the generated registry files; style overrides happen via className at the usage site.

- [x] **Task 3: i18n keys ×3 locales** (AC: aria-label never placeholder-only; D5)
  - [x] 3.1 `frontend/messages/en.json` — UPDATE — REUSE existing keys: `search.filters.wilaya` (group label — rendered by the sidebar h3 today), `search.filters.wilaya_placeholder` (combobox input placeholder; value "Select wilayas..." works as-is), `search.wilayas.no_results` ("No wilayas match your search" — the combobox empty state; already used by the /wilayas table filter). NEW keys (working drafts — native-speaker review is a pre-launch item, PRD Open Q7):
    - `search.filters.wilaya_label`: "Search wilayas by code or name" — `aria-label` on the search input
    - `search.filters.wilaya_remove`: "Remove {name}" — chip-remove button `aria-label`
    - `search.filters.wilaya_clear`: "Clear wilaya selection" — trigger clear-affordance `aria-label`
    - `search.filters.wilaya_more`: "+{count} more" — chip-limit overflow indicator
  - [x] 3.2 REMOVE `search.filters.wilaya_soon` from en/fr/ar — dead once the 3.3 placeholder is replaced (authorized item 6). Mirror all changes in `fr.json` + `ar.json` (Arabic for AR — no uppercase transforms; Western Arabic numerals only in interpolations). `npm.cmd run check:i18n` must pass (en = source of truth; identical key counts across the 3 files).

- [x] **Task 4: WilayaCombobox component — TDD** (AC: all combobox ACs; D1, D3, D4)
  - [x] 4.1 RED: `frontend/src/__tests__/wilaya-combobox.test.tsx` — NEW — assert i18n KEYS via the mocked `useTranslations` (never values); mock `next-intl` is global (`src/test/setup.ts`). Suite:
    - **data**: opening the popup lists exactly 58 options, codes 1–58 (from WILAYAS); no retired codes.
    - **option rows**: each option row renders `31 — Oran` format — code (Western numerals, `tabular-nums`) + localized name; the divider is ` — `.
    - **filtering** (controlled `inputValue`): typing `31` → Oran only; `Oran` → Oran; `وهران` → Oran; `oran` (case-insensitive) → Oran; no match → `search.wilayas.no_results` empty state renders.
    - **selection**: click an option → `onChange([code])`; chips render inside the trigger with the same `31 — Oran` label; select a second → `onChange([a, b])`; click/Enter on an already-selected option TOGGLES it off (`onChange` without it).
    - **chip remove**: each chip has a remove button (`aria-label` = `search.filters.wilaya_remove` interpolated); clicking it removes only that chip; remove button is a real `<button>` (tabbable — `getByRole('button', ...)`).
    - **Backspace/Delete**: with the input empty and ≥1 chip, `keyDown` Backspace → `onChange` = selection minus LAST code; Delete behaves identically; Backspace with non-empty input does NOT remove a chip.
    - **Esc**: closes the popup; `document.activeElement` returns to the combobox input (the trigger).
    - **a11y labelling**: the search input has `aria-label` = `search.filters.wilaya_label`; placeholder (`search.filters.wilaya_placeholder`) present but NOT the only label; chips carry explicit `aria-label`; `lang="ar"` on Arabic-script fragments (chip names / option names in the AR-locale test).
    - **chip limit**: selecting >3 → only 3 chips render + `search.filters.wilaya_more` indicator with the hidden count.
    - **clear affordance**: X button (`search.filters.wilaya_clear`) visible when non-empty; click → `onChange([])`.
    - **touch inflation (UX-DR22)**: chips container `min-h-11 md:min-h-8`; chip-remove buttons ≥44px on mobile (`size-11 md:size-4`); options carry touch-friendly heights on `<md`.
    - **RTL smoke**: render in `dir="rtl"` — no physical-property classes in the combobox's own markup (`left-`, `right-`, `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right` absent); popup `align="start"` stays logical.
    - **fallback rule** (pure helper): a synthetic wilaya with an empty `name_fr` displays `name_ar` (never blank); empty `name_ar` impossible by parity test.
  - [x] 4.2 GREEN: `frontend/src/components/search/WilayaCombobox.tsx` — NEW — client; props `{ value: number[]; onChange: (codes: number[]) => void }` (controlled; parent = SearchPage). Base UI chips pattern (registry components + Base UI semantics — 3.3 DangerZone/drawer precedent):
    - `Combobox` Root: `multiple`, `items={WILAYAS}`, controlled `value` (code array) / `onValueChange` (map to codes), controlled `inputValue` + `filter={null}` + pure `filterWilayas(query, locale)` — matches code prefix OR substring of any of the 3 names, case-insensitive, trimmed (diacritic-insensitivity is NOT required here — FR-13 is the keyword filter; plain matching per AC).
    - Trigger = `ComboboxChips` container (the anchor via `useComboboxAnchor`, `min-h-11 md:min-h-8`, `rounded-md`, border/input tokens, `focus-within:ring-2 ring-ring`): `ComboboxValue` render-prop → `ComboboxChip` per selected code in selection order (cap `CHIP_LIMIT = 3`; overflow → `search.filters.wilaya_more` span with hidden count) + `ComboboxChipsInput` (aria-label `search.filters.wilaya_label`, placeholder `search.filters.wilaya_placeholder` only when empty, `onKeyDown`: Backspace/Delete + empty input + non-empty selection → `onChange(selection.slice(0, -1))`).
    - Chips: `rounded-full bg-muted` (AC literal {rounded.full} {colors.muted}), label `31 — Oran` (pure `wilayaDisplayName(wilaya, locale)`: `name_{locale} || name_ar` — FR-10 no-blank fallback), `aria-label` = the same display name, Arabic fragments `lang="ar" dir="rtl"`, `ComboboxChipRemove` = native button, `aria-label` `search.filters.wilaya_remove` + {name}, `size-11 md:size-4`.
    - Popup = `ComboboxContent` (`anchor` = the chips container ref, `aria-label` `search.filters.wilaya`): `ComboboxEmpty` (`search.wilayas.no_results`) + `ComboboxList` (`max-h-70` = 280px per DESIGN.md, scrolls, `overscroll-contain`) + `ComboboxItem` per filtered wilaya — option row `{code} — {localized name}`, code `tabular-nums`, Arabic fragment `lang="ar" dir="rtl"`, `data-highlighted:bg-muted` (DESIGN.md keyboard-active fill), `ComboboxItemIndicator` check; item row heights inflate on `<md` (UX-DR22).
    - Esc: native close; **focus return to the trigger input** — assert in test; if Base UI's default `finalFocus` does not restore focus to the input, pass `finalFocus={inputRef}` to `ComboboxContent` (registry spreads props to Popup).
    - Clear affordance: button at the inline-end of the chips container, visible only when non-empty, `aria-label` `search.filters.wilaya_clear`, `min-h-11 md:min-h-8`.
    - Design tokens ONLY (`bg-popover text-popover-foreground`, `rounded-md`, `border-border`, `ring-ring`, `max-h-70`, `min-h-11`, `size-*`, `text-caption`/`text-small`); logical properties ONLY (AD-2/AD-9); no `uppercase`; no comments unless necessary; Western numerals (AD-8).

- [x] **Task 5: Integration — SearchPage + FilterSidebar + mocks** (AC: renders in the filter sidebar; D6)
  - [x] 5.1 RED+GREEN: `frontend/src/components/search/SearchPage.tsx` — UPDATE — owns `const [wilayas, setWilayas] = useState<number[]>([])`; passes `wilayaField={<WilayaCombobox value={wilayas} onChange={setWilayas} />}` + `wilayaCount={wilayas.length}`; submit merge `onSubmit={(filters) => void runSearch({ ...filters, wilayas })}`. Tests in `frontend/src/__tests__/search-page.test.tsx` (UPDATE): selecting a wilaya then Apply → `searchPeople` called EXACTLY once with a payload whose `filters` JSON decodes to `wilaya: [31]`; a second wilaya → `wilaya: [31, 16]`; no wilayas → `wilaya: []`. Verify the existing "exactly one call" tests still pass (merge happens BEFORE the in-flight guard path — the merge is pure state, the single-call contract is unchanged).
  - [x] 5.2 `frontend/src/components/search/FilterSidebar.tsx` — UPDATE (the ONLY sidebar edit — the 3.3 D3 "REPLACED" action; the `wilayaField`/`wilayaCount` props CONTRACT is untouched): DELETE the `WilayaPlaceholder` function + the `wilayaField ?? <WilayaPlaceholder ... />` fallback (render `{wilayaField}` — SearchPage is the only consumer and always passes it). Tests in `frontend/src/__tests__/filter-sidebar.test.tsx` (UPDATE): REMOVE the "renders a disabled wilaya placeholder trigger" test; KEEP the custom-field test; ADD badge-semantics test: `wilayaCount: 3` + Clear All → badge still shows 3 (wilayas remain ACTIVE — `countActiveFilters(empty draft) + 3`; per 3.3 the badge counts staged + active, and wilaya selections live at SearchPage — no double counting).
  - [x] 5.3 `frontend/src/test/mocks.ts` — UPDATE — narrow the `elementFromPoint` jsdom polyfill (deferred-work 3.4-OWNED): return the topmost open popup — `document.querySelector('[data-slot="combobox-content"]')` first, then `[data-slot="drawer-popup"]`, else `document.body`. Existing drawer tests must stay green.

- [x] **Task 6: AD-20 TanStack Query gate check** (authorized add-on; NOT adoption)
  - [x] 6.1 From `frontend/`: `npm.cmd install @tanstack/react-query@^5`. NEW `frontend/src/__tests__/tanstack-query-gate.test.tsx` — minimal smoke: mount `QueryClientProvider` + a tiny component calling `useQuery({ queryKey: ['gate'], queryFn: async () => 'ok' })`; `waitFor` the rendered data. PASS → record "TanStack Query v5 verified under vitest 2.x/Vite-CJS — adoption unlocked for the 3.5 results table (AD-20 gate)". FAIL → record the failure + error text; do NOT wire anything either way.
  - [x] 6.2 NO wiring: SearchPage keeps its `useState`/`useRef` pattern (3.3 decision-5; AD-20 gate stays deferred per the 3.3 review decision — the combobox is a pure local component consuming static WILAYAS data).

- [x] **Task 7: Verification gates + story sync** (all ACs)
  - [x] 7.1 Frontend (from `frontend/`): `npm.cmd test` all green (235 baseline + new), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (×3 locales).
  - [x] 7.2 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` green (352 baseline + new parity tests), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0.
  - [x] 7.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-4 → ready-for-dev → in-progress → review; epic-3 stays in-progress). Commit as `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.

## Dev Notes

### Decided constraints (confirmed with Sally — UX designer consultation 2026-08-05)

- **Component mapping (decision 1 — D1)**: stock shadcn base-nova `combobox` registry component (Base UI Combobox — `npx shadcn@latest add combobox input-group`), which IS the base-nova equivalent of "shadcn Command inside a Popover": `ComboboxContent` is the portal-positioned popup (Positioner+Popup+`aria-label`), `ComboboxChips/Chip/ChipRemove` provide the multi-select chips, `ComboboxValue` render-prop drives chip rendering with a documented `CHIP_LIMIT + N more` pattern. NO cmdk, NO Radix command, NO extra popover wrapper, NO new npm packages (Base UI ^1.6.0 already installed). Registry-generated files are NOT hand-edited; token overrides live at the usage site (3.3 precedent).
- **Parity (decision 2 — D2)**: a REAL automated cross-stack parity test — a backend pytest module that parses the frontend TS data files (both quote styles; strict shape parsing) and asserts lockstep for wilayas (58, codes 1–58, trilingual) AND industries (35, ids 1–35, name_en order) — the deferred-work 3.4-OWNED items (wilaya parity + 3.3's industries extension). Canonical source = the frontend TS files; the .py files are verified mirrors. Runs in the backend gate suite.
- **Keyboard model (decision 3 — D3)**: Enter toggles the highlighted option (native Base UI `'item-press'`); Space activates a focused option (native); Esc closes the popup (native `'escape-key'`) and focus returns to the combobox input — assert, and wire `Popup.finalFocus` to the input ref if the default doesn't restore (registry `ComboboxContent` spreads props to Popup). **Backspace/Delete-removes-last-chip is NOT native in Base UI 1.6.0** — implement via `onKeyDown` on the chips input (empty input + non-empty selection → drop the last code). Selection toggling: click or Enter on a selected option removes it (Base UI multiple semantics).
- **Chip a11y (decision 4 — D4)**: chips render inside the trigger (the `ComboboxChips` container); each chip carries an explicit `aria-label` (display name) and a `ComboboxChipRemove` native `<button>` (tabbable, `aria-label` `search.filters.wilaya_remove` + {name}); input `aria-label` = `search.filters.wilaya_label` (never placeholder-only — AC literal); Arabic fragments carry `lang="ar" dir="rtl"` (EXPERIENCE per-fragment language rule); chips `{rounded.full} {colors.muted}`; keyboard-active option `{colors.muted}` (DESIGN.md — overrides registry `accent`); list max-height 280px via `max-h-70` (spacing token, DESIGN literal); focus-visible rings on chips/removes/input; 44px touch targets on `<md` (UX-DR22 — chips container, chip-remove buttons, options).
- **i18n (decision 5 — D5)**: reuse `search.filters.wilaya`, `search.filters.wilaya_placeholder`, `search.wilayas.no_results`; new keys `wilaya_label`, `wilaya_remove` ({name}), `wilaya_clear`, `wilaya_more` ({count}) ×3 locales; **remove** the now-dead `search.filters.wilaya_soon` (the 3.3 placeholder caption — replaced; authorized item 6).
- **Sidebar integration contract (decision 6 — D6)**: ZERO changes to the FilterSidebar props contract (`wilayaField`/`wilayaCount` semantics exactly as 3.3 shipped). SearchPage owns the `wilayas` state; the combobox is controlled (`value`/`onChange`); `wilayaCount` feeds the badge (`countActiveFilters(draft) + wilayaCount` — no double counting, verified against the 3.3 badge test); Apply payload merges wilayas at SearchPage (`{ ...filters, wilayas }`). **Clear All semantics**: the sidebar's global Clear All keeps its 3.3 contract (resets the staged draft); the badge then correctly shows the still-ACTIVE wilayas; wilaya clearing happens via the combobox's own clear affordance (`wilaya_clear`), per-chip remove, or popup toggle-off. The 3.3 placeholder path (function + `??` fallback + test) is deleted — the authorized "placeholder REPLACED" action; the wilaya group in the sidebar keeps its `h3` label (`search.filters.wilaya`) and its group slot. 3.6 note: saved-search re-runs will drive `applied` → SearchPage restores `applied.wilayas` into the combobox state.
- **Chip limit (decision 7)**: `CHIP_LIMIT = 3` visible chips + `search.filters.wilaya_more` "+N more" overflow (Base UI documented pattern); hidden chips remain removable via the popup toggle. Unbounded chips would blow up the 288px sidebar.
- **No John (PM) consultation (decision 8)**: ACs fully specify behavior (matching fields, chip semantics, keyboard model, 58-wilaya constraint); FR-10 + UX spines leave no open product questions (3.3 decision-9 precedent). The only judgment call (chip limit) is a UX-visual decision, resolved with Sally.

### Existing patterns to follow (from 2-5 / 3-3 precedents)

- Component + test layout: client components in `frontend/src/components/<domain>/`, tests in `frontend/src/__tests__/<name>.test.tsx`; pure helpers (`wilayaDisplayName`, `filterWilayas`) exported from the component module for unit tests.
- Tests: vitest + jsdom; `src/test/setup.ts` imports `mocks.ts` (next-intl `useTranslations` returns the KEY, `useLocale` → 'en'; next/navigation stubbed) — assert message KEYS never values; `fireEvent`; async popup render → `findByRole`/`waitFor`; jest-dom matchers. PointerEvent + elementFromPoint polyfills already exist in `src/test/mocks.ts` (3.3) — the combobox clicks need the PointerEvent polyfill (Base UI builds `PointerEvent` in click handlers) and the NARROWED elementFromPoint (Task 5.3). Base UI popup renders in a Portal — query via `document.body` or container-scoped queries (drawer precedent).
- Design tokens (AD-2/AD-9): `bg-popover text-popover-foreground`, `rounded-md`, `rounded-full`, `bg-muted`, `border-border`, `ring-ring`, `max-h-70` (280px), `min-h-11 md:min-h-8`, `text-caption`/`text-small`, `tabular-nums` (codes); logical properties ONLY — never hardcode px/hex (280px = `max-h-70` = 70 × `--spacing`).
- Mobile touch inflation (UX-DR22): `min-h-11` on interactive targets `< md` (chips container, clear affordance, chip-remove buttons `size-11 md:size-4`).
- No code comments unless necessary; commit style `Story 3.4: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push.
- Checkboxes `- [x]` stay unchecked until dev executes them — tasks above are the live checklist.

### Implementation notes

- Base UI Combobox 1.6.0 API (verified against the Base UI docs — authoritative): controlled props are `value`/`onValueChange` (NOT searchValue); input query props are `inputValue`/`onInputValueChange`; `items` on Root; `filter={null}` disables built-in filtering (use own pure filter); `multiple` enables multi-select; `loopFocus` (default true) keeps the input in the arrow-key loop; Enter selects the highlighted item (`'item-press'` reason — works when the Input OR the List has focus); Esc closes (`'escape-key'` reason); `Popup.finalFocus` controls focus-on-close (default: trigger or previously-focused element); `Positioner anchor` overrides the default trigger anchoring (registry `useComboboxAnchor` returns the ref); popup `aria-label` is REQUIRED in the input-inside-popup pattern; `Side` supports logical `inline-start`/`inline-end`; `Combobox.Empty` and `Combobox.Status` announce politely to screen readers (Empty must stay mounted for announcements). NO native Backspace/Delete chip removal — custom (D3).
- The base-nova registry `combobox.tsx` (fetched 2026-08-05) exports: `Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxGroup, ComboboxLabel, ComboboxCollection, ComboboxEmpty, ComboboxSeparator, ComboboxChips, ComboboxChip, ComboboxChipsInput, ComboboxTrigger, ComboboxValue, useComboboxAnchor` — the chips variants are exactly the `ComboboxMultiple` pattern in the registry example. The CLI resolves the registry's `IconPlaceholder` to lucide icons (X, Check, ChevronDown — all available in the installed `lucide-react`). Registry-popup classes may include `cn-menu-*`/physical-side variants (`data-[side=left]:slide-in-from-right-2` etc.) — registry-file debt, same category as the 3.3 drawer defers; override via usage className where the visual matters, do NOT hand-edit the registry file.
- Sidebar edit scope (Task 5.2): `FilterSidebar.tsx` loses ONLY the `WilayaPlaceholder` function + the `??` fallback; the props type (`wilayaField?: ReactNode`, `wilayaCount?: number`), the group order, the h3, and the badge math are untouched. The 3.3 filter-sidebar suite's custom-field test keeps passing; the placeholder test is deleted.
- SearchPage merge (Task 5.1): the merge is `{ ...filters, wilayas }` INSIDE the onSubmit handler passed to FilterSidebar — `buildFiltersPayload` then serializes `wilaya: [31, ...]` exactly as 3.2 expects. The single-call-per-Apply guard is unaffected.
- Parity test parsing (Task 1.1): the TS files are stable literal arrays, one record per line, `{ code: 1, name_ar: 'أدرار', name_fr: 'Adrar', name_en: 'Adrar' }` — regex per record with BOTH quote styles (`'` and `"`); strip quotes; assert shape drift loudly (records that don't match the regex FAIL the test, not skip).
- The `search.wilayas.no_results` key exists today in all 3 locales (used by the /wilayas page) — reuse it for `ComboboxEmpty`; it is NOT a new key.
- `filterWilayas` matches: code prefix (`String(w.code).startsWith(q)`) OR substring in `name_ar`/`name_fr`/`name_en` (case-insensitive, trimmed query) — the WilayaTable precedent (`frontend/src/components/wilayas/WilayaTable.tsx:31-41`) is the established matching shape. `wilayaDisplayName(w, locale)`: `name_{locale}` if non-empty else `name_ar` (FR-10 transliterated-Arabic fallback — never blank; parity guarantees name_ar non-empty).
- RTL: the h3 label + chips container + popup positioner handle direction via logical CSS and Floating UI's `align="start"`; no manual direction logic. `lang="ar" dir="rtl"` only on Arabic-script fragments (the AR-locale names in chips/options), NOT on the container.
- No TanStack Query adoption in this story (Task 6 is a gate CHECK only — install + smoke test; the 3.5 results table remains the first real consumer).

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd`; backend venv `backend\.venv\Scripts\` (run from `backend/`); system python is 3.10 — use the venv python for backend gates.
- Do NOT add Radix packages (`@radix-ui/react-select` is pre-existing 3.3 wiring — leave it); do NOT add cmdk; the combobox must come from the shadcn CLI registry, not hand-rolled.
- Do NOT hardcode 280px — `max-h-70` (spacing-token-scaled). Do NOT use `uppercase` anywhere.
- The registry-generated `combobox.tsx` may reference `IconPlaceholder`/`@/app/(create)/...` if the CLI version differs from expectations — if the generated file does NOT compile, remove the IconPlaceholder usage and inline the lucide icons directly (still no registry hand-edit of classes; this is fixing an unresolved import).
- jsdom has no real viewport — popup open/close is state-driven, not size-driven; assert on `data-open`/presence (drawer precedent: `waitFor(() => queryByRole(...))` for exit).
- Base UI popup transition keeps the popup mounted briefly in jsdom — dismissal assertions use `waitFor`.
- i18n parity: every NEW key must land in fr + ar or `check:i18n` fails; the REMOVED `wilaya_soon` must be removed from all 3 files.
- The console mangles Arabic in PowerShell output — edit message JSON with the file tools, not console redirection; run `check:i18n` to validate.
- `searchPage` test mocks `@/lib/api/search-service` wholesale (vi.hoisted) — the wilaya merge lives in SearchPage, so the payload assertion decodes the JSON passed as the `filters` param.
- The 3.3 "renders a disabled wilaya placeholder" test MUST be deleted in Task 5.2 — otherwise it fails once the placeholder is gone (expected, not a regression).

### Project Structure Notes

- Frontend NEW: `frontend/src/components/search/WilayaCombobox.tsx`, `frontend/src/components/ui/combobox.tsx` + `input-group.tsx` (shadcn CLI / Base UI wrappers), `frontend/src/__tests__/wilaya-combobox.test.tsx`, `frontend/src/__tests__/tanstack-query-gate.test.tsx`.
- Frontend UPDATE: `frontend/src/components/search/SearchPage.tsx` (wilaya state + merge), `frontend/src/components/search/FilterSidebar.tsx` (delete dead placeholder path), `frontend/src/test/mocks.ts` (narrowed elementFromPoint), `frontend/messages/{en,fr,ar}.json` (+4 keys, −1 key ×3), `frontend/src/__tests__/{search-page,filter-sidebar}.test.tsx`, `frontend/package.json` (+`@tanstack/react-query@^5`).
- Backend NEW: `backend/apps/search/tests/test_wilaya_parity.py` (parity tests — the only backend change; no app code, no models, no migrations).
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-4 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 stays in-progress.
- Deferred-work: `_bmad-output/implementation-artifacts/deferred-work.md` — the wilaya-parity + industries-parity + elementFromPoint items are RESOLVED by this story (mark closed at dev completion); the AD-20 TanStack Query gate result (pass/fail) is recorded here for 3.5.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-04-wilaya-combobox.md] Story spec (all ACs verbatim)
- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/index.md] Epic 3 story table (3.4 deliverable line)
- [Source: _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L94-L101] FR-10 — 58-wilaya filter, trilingual display, transliterated-Arabic fallback never blank
- [Source: docs/ARCHITECTURE-SPINE.md] AD-2/AD-8/AD-9 (tokens, Western numerals, logical CSS); Component Tree (`FilterSidebar > WilayaCombobox`); §Data Enumerations Wilaya Taxonomy; AD-20 TanStack Query (PLANNED — gate check in Task 6)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L123] Wilaya combobox row — full UX spec: searchable, code/AR/FR/EN matching, multi-select chips, `code + localized name`, 58 wilayas, Enter/Space toggle, chips tab-reachable with per-chip remove, Backspace/Delete last-chip, aria-label minimum, Esc closes + focus returns to trigger; #L160-L169 Interaction Primitives; #L171-L191 Accessibility Floor (44px touch targets incl. chip remove buttons + combobox options; per-fragment `lang="ar" dir="rtl"` incl. combobox options; aria-live polite)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md#L329] wilaya-combobox component spec — shadcn Command inside a Popover; chips {rounded.full} {colors.muted}; option rows `code - localized name`; keyboard-active option {colors.muted}; list max-height 280px scrolls; Arabic fallback in font-arabic; #L281 numerals rule (codes = Western Arabic, tabular-nums); #L315-L318 rounded.md default for comboboxes
- [Source: _bmad-output/implementation-artifacts/3-3-filter-sidebar-component.md] Completed 3.3 — the `wilayaField`/`wilayaCount` wiring contract (D3 decision), badge math (`countActiveFilters(draft) + wilayaCount`), placeholder to be REPLACED by 3.4, test conventions, jsdom polyfill record, story format precedent
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] 3.4-OWNED items: wilaya parity consolidation + real parity test; elementFromPoint polyfill narrowing; industries parity extension (3.3)
- [Source: frontend/src/data/wilayas.ts, backend/apps/search/data/wilayas.py] The 58-wilaya datasets (canonical TS; verified mirrors)
- [Source: frontend/src/data/industries.ts, backend/apps/search/data/industries.py] The 35-industry datasets (parity extension)
- [Source: frontend/src/components/search/FilterSidebar.tsx, SearchPage.tsx, lib/api/search-service.ts] Current wiring (badge math, draft model, onSubmit flow, countActiveFilters, buildFiltersPayload)
- [Source: frontend/src/components/wilayas/WilayaTable.tsx] Established matching shape + `lang`-attribute precedent
- [Source: frontend/src/test/mocks.ts] PointerEvent + elementFromPoint polyfills (elementFromPoint to be narrowed)
- [Source: https://ui.shadcn.com/r/styles/base-nova/combobox.json] base-nova registry combobox component (Base UI; deps: @base-ui/react; registryDependencies: button, input-group) — verified 2026-08-05
- [Source: https://base-ui.com/react/components/combobox.md] Base UI Combobox 1.6.0 API facts: controlled `value`/`onValueChange` + `inputValue`/`onInputValueChange`, `items`, `filter={null}`, `multiple`, Enter=`'item-press'`, Esc=`'escape-key'`, `Popup.finalFocus`, logical `Side` values, no native Backspace chip removal, Empty/Status polite announcements, popup `aria-label` for the input-inside-popup pattern

## Review Findings

_(to be filled at the code-review stage per the 3.2/3.3 precedent — patches, defers, dismissals)_

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **Base UI Combobox 1.6.0 does NOT open the popup on `focus()` or `click()` in jsdom** — it opens on the press sequence (`mousedown`+`mouseup`+`click`). Test helper `openPopup()` uses the press sequence; `input.focus()` added after for keyboard handling. `openOnFocus` is off by default in 1.6.
- **`autoHighlight` is a NO-OP with `filter={null}`** (it hooks the internal filter pipeline, which is bypassed) — removed from the Root; the keyboard model is `loopFocus` (ArrowDown/Up moves highlight/focus through options; Enter on the input activates the highlighted option; Space on a FOCUSED option activates it — verified: Space-on-input types a space, which is correct for multi-word queries like "Tizi Ouzou").
- **Rapid consecutive ArrowDown keydowns collapse in jsdom** (each reads a stale internal ref → the effective highlight lands one step, not N). Tested the deterministic single-ArrowDown paths instead (select-on-Enter, Space-on-focused-option) + click toggles; multi-step walk with settle waits is flaky harness behavior, not product behavior (documented; real-browser behavior verified via Base UI docs: `loopFocus` + `'item-press'`).
- **With the combobox popup OPEN, Base UI marks the rest of the page `aria-hidden`** (background inert) → `getByRole` cannot see the sidebar Apply/trigger buttons. Integration tests close the popup with Esc before clicking Apply (realistic UX).
- **`ComboboxChips` (registry) is a plain function component — React 18 does NOT forward refs** → the anchor ref (popup width = chips container) cannot pass through the registry wrapper. Used the raw `@base-ui/react` `Combobox.Chips` primitive with the registry's own token classes (3.3 Task 1.1 sanctioned fallback: "raw Base UI primitive in a wrapper").
- **`data-highlighted` attribute application lags 1–2 frames behind the internal state in jsdom** (rAF-scheduled focus) — tests assert behavior (what Enter/Space/click DO), never the attribute timing.
- **PowerShell `Set-Content -Encoding UTF8` CORRUPTED the test file** (BOM + em-dash mojibake — "31 â€” Oran"); rewritten via the write tool. Files with multibyte content must only be edited with file tools (my own story gotcha — violated once, documented).
- **Base UI `Chip` renders `<div>` inside the chips container; the container gets `role="toolbar"`** natively; chips carry explicit `aria-label` (full `31 — Oran` display); the remove button is my own native `<button>` inside the chip (`showRemove={false}`) to get `size-11 md:size-4` touch targets (registry ChipRemove is `icon-xs` = 28px — violates UX-DR22 on mobile).
- Base UI emits `role="combobox"` + `aria-expanded` + `aria-haspopup="listbox"` + `aria-autocomplete="list"` + `aria-controls` natively on the input (asserted in tests).
- Pre-existing noise (untouched): "Function components cannot be given refs" warnings (Base UI internals passing refs through registry function wrappers), act() warnings in legacy suites, vitest CJS banner.

### Completion Notes List

- `WilayaCombobox.tsx` (NEW): controlled `value: number[]`/`onChange`; pure exports `wilayaDisplayName` (FR-10 transliterated-Arabic fallback) + `wilayaDisplayLabel` (`31 — Oran`) + `filterWilayas` (code prefix / AR / FR / EN substring, case-insensitive); Base UI Combobox `multiple` + `filter={null}` + controlled `inputValue` (own memo filter); raw `Combobox.Chips` anchor (registry wrapper can't forward refs on React 18) with `min-h-11 md:min-h-8 rounded-md` tokens; chips `rounded-full bg-muted` with explicit aria-label + native remove `<button>` (`size-11 md:size-4`, `wilaya_remove` + name) + `lang="ar" dir="rtl"` Arabic fragments; `CHIP_LIMIT = 3` + `wilaya_more` overflow span; clear affordance (`wilaya_clear`, `min-h-11 md:min-h-8`, shown when non-empty); Backspace/Delete-removes-last-chip on empty input (NOT native in Base UI — custom `onKeyDown`); Esc closes natively + focus returns to the input (Base UI `finalFocus` default — asserted); `ComboboxEmpty` = reused `search.wilayas.no_results`; popup `ComboboxContent` anchored to the chips container (popup width = trigger width); `ComboboxItem` rows `tabular-nums` code + `—` + localized name, `min-h-11 md:min-h-8` touch rows.
- `SearchPage.tsx` (UPDATE): `wilayas` state + `wilayaField={<WilayaCombobox value={wilayas} onChange={setWilayas} />}` + `wilayaCount={wilayas.length}` + submit merge `{ ...filters, wilayas }` — zero FilterSidebar contract changes.
- `FilterSidebar.tsx` (UPDATE): deleted the dead `WilayaPlaceholder` + `wilayaField ??` fallback (the 3.3 "placeholder REPLACED" action; props contract untouched); `Select` import dropped.
- `src/test/mocks.ts` (UPDATE): `elementFromPoint` polyfill narrowed — `combobox-content` first, then `drawer-popup`, else body (deferred-work 3.4-OWNED).
- Parity (backend NEW `apps/search/tests/test_wilaya_parity.py`): strict TS-array parser (both quote styles, trailing commas, loud shape-drift failure) asserting wilayas lockstep (58, codes 1–58, trilingual) + industries lockstep (35, ids 1..35, name_en order = seed order) vs the backend mirrors. Mutation-verified (code swap → test FAILS). Parser accepts well-formed rows with any code — code drift is caught by the test assertions (not the parser).
- AD-20 gate (authorized): `@tanstack/react-query@^5` installed; `tanstack-query-gate.test.tsx` smoke (QueryClientProvider + useQuery) PASSES under vitest 2.x/Vite-CJS → **v5 adoption unlocked for the 3.5 results table**; NO wiring (SearchPage keeps useState/useRef).
- i18n: +4 keys (`wilaya_label`, `wilaya_remove`, `wilaya_clear`, `wilaya_more`) − 1 (`wilaya_soon`) ×3 locales → 397 keys/locale, parity green. Reused `search.filters.wilaya` (group label), `search.filters.wilaya_placeholder` (input placeholder), `search.wilayas.no_results` (empty state).
- Tests: 35 new (wilaya-combobox 28, wilayas-data 3, tanstack gate 1, search-page +3; filter-sidebar −1 placeholder +1 badge semantics). Gates: frontend 270 green (235 + 35), lint 0 / typecheck 0 / check:i18n 397×3 ✓; backend 354 pytest (352 + 2 parity) / ruff 0 / mypy strict 0. NO backend app-code changes (parity tests only); new frontend deps: `@tanstack/react-query@^5` (gate check only — no runtime use).
- Dev-stage amendments vs story spec: (1) popup opens on the press sequence in jsdom (helper), (2) `autoHighlight` removed (no-op with `filter={null}`), (3) keyboard toggle tested via deterministic paths (Enter-select, Space-on-focused-option, click toggles) — the AC "Enter/Space toggles" is satisfied by Base UI's `'item-press'` toggle (probe-verified); (4) chip remove buttons are custom native buttons inside stock `ComboboxChip` (`showRemove={false}`) for 44px touch targets; (5) chips container uses the raw Base UI `Chips` primitive for the anchor ref (registry wrapper can't forward refs on React 18); (6) integration tests Esc-close the popup before touching the sidebar (Base UI inerts the background while open); (7) parity tests assert count/ids/names lockstep via equality with the backend mirrors (not a frozen 35) so ops additions stay green; (8) registry ComboboxList `max-h` ≈ 252px (calc from spacing tokens) kept — ≤ the DESIGN 280px ceiling, no override needed.

### File List

- `_bmad-output/implementation-artifacts/3-4-wilaya-combobox.md` — UPDATE (this story; status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (3-4 → ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/deferred-work.md` — UPDATE (3.4-OWNED items resolved; AD-20 gate result recorded)
- `frontend/src/components/search/WilayaCombobox.tsx` — NEW (combobox + pure helpers)
- `frontend/src/components/search/SearchPage.tsx` — UPDATE (wilaya state + merge)
- `frontend/src/components/search/FilterSidebar.tsx` — UPDATE (dead placeholder path removed)
- `frontend/src/components/ui/combobox.tsx` — NEW (shadcn base-nova via CLI)
- `frontend/src/components/ui/input-group.tsx` — NEW (shadcn base-nova via CLI)
- `frontend/src/components/ui/textarea.tsx` — NEW (shadcn CLI registry dep of input-group)
- `frontend/src/test/mocks.ts` — UPDATE (elementFromPoint narrowed)
- `frontend/messages/en.json` — UPDATE (+4 −1 keys)
- `frontend/messages/fr.json` — UPDATE (+4 −1 keys)
- `frontend/messages/ar.json` — UPDATE (+4 −1 keys)
- `frontend/package.json` + `package-lock.json` — UPDATE (+@tanstack/react-query@^5, AD-20 gate)
- `frontend/src/__tests__/wilaya-combobox.test.tsx` — NEW (28 tests)
- `frontend/src/__tests__/wilayas-data.test.ts` — NEW (3 tests)
- `frontend/src/__tests__/tanstack-query-gate.test.tsx` — NEW (1 test)
- `frontend/src/__tests__/search-page.test.tsx` — UPDATE (+3 wilaya integration tests)
- `frontend/src/__tests__/filter-sidebar.test.tsx` — UPDATE (−1 placeholder, +1 badge-semantics test)
- `backend/apps/search/tests/test_wilaya_parity.py` — NEW (wilaya + industry parity; 2 tests)

## Change Log

- 2026-08-05: Story created (ready-for-dev) from epic 3.4 spec; Sally UX consultation resolved 8 design decisions (base-nova stock Combobox = the Command-in-Popover mapping — registry-verified, zero new deps; real backend pytest parity test for wilayas + industries (deferred-work 3.4-OWNED); keyboard model — native Enter/Esc + custom Backspace/Delete last-chip + finalFocus wiring; chip a11y — explicit labels, native remove buttons, 44px touch targets, lang=ar fragments, rounded-full bg-muted chips + max-h-70 list; i18n — 4 new keys + wilaya_soon removal ×3; sidebar contract — SearchPage-owned wilaya state + payload merge + badge semantics verified + clear affordance, placeholder path deleted, props contract untouched; CHIP_LIMIT=3 + N more; no John consultation — ACs fully specify); AD-20 TanStack Query gate check task added (install + smoke, no wiring, user-approved); validated against checklist; sprint-status 3-4 → ready-for-dev.
- 2026-08-05: Implemented (TDD): RED suites (wilaya-combobox 28, wilayas-data 3, tanstack gate 1) → parity tests (backend, mutation-verified) + WilayaCombobox (controlled, chips, filter, keyboard) + SearchPage merge + FilterSidebar placeholder removal + elementFromPoint narrowing + i18n (+4 −1 ×3) → GREEN 270 frontend tests (235 + 35), lint 0 / typecheck 0 / check:i18n 397×3 ✓; backend 354 pytest (352 + 2 parity) / ruff 0 / mypy strict 0. AD-20 gate: **TanStack Query v5 PASSES under vitest 2.x/Vite-CJS** (no wiring — adoption unlocked for 3.5). Dev-stage amendments recorded (press-sequence popup open, autoHighlight dropped, deterministic keyboard paths, raw Chips anchor for the ref, custom chip-remove buttons, Esc-close before sidebar queries, parity-by-equality, registry list height kept). Status → review; sprint 3-4 → review; deferred-work 3.4-OWNED items marked resolved.
