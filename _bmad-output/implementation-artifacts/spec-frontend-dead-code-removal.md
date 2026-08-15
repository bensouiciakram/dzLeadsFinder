# SPEC — Frontend Dead Code Removal (Next.js)

- status: ready-for-dev
- route: freeform (plan-code-review)
- goal: remove only provably dead code from `frontend/src/*` + `frontend/src/middleware.ts`, with zero behavior change and zero public-surface damage, applying the refined "Dead Code Removal — Agent Prompt" rules adapted to Next.js surfaces
- related: `spec-dead-code-removal.md` (backend pass, same ruleset, completed 2026-08-14)

## Frozen Intent

### Always

- Classify every candidate into the ladder: CONFIRMED DEAD -> LIKELY DEAD -> Uncertain -> Ask-First. Only CONFIRMED DEAD may be removed, and only when all removal gates pass.
- CONFIRMED DEAD = zero runtime references anywhere in the project (source + tests + configs) AND zero public-surface exposure AND removal is safely verifiable (a test or build artifact proves nothing breaks).
- LIKELY DEAD = zero references in source, but zero-test-covered (no test file exercises the module/export). LIKELY DEAD is never removed; it is reported in the Final Report.
- Uncertain = ambiguous reference (string/getattr-style dispatch, dynamic import by name, i18n key concatenation, Next.js filesystem-routing registration). Uncertain is never removed; it is reported and, if cheap, proven or disproven with a quick test/build probe.
- Ask-First = any public-surface change, any i18n key removal, any package.json dependency/script change beyond the authorized dev-dep line, any `middleware.ts` config change, anything the author cannot fully prove. Ask-First items go to the human; they are never executed by the agent.
- Removal gates (all must pass): (1) no reference anywhere (source, tests, messages, configs, docs), (2) no public-surface exposure (app routes, middleware matcher, i18n keys, sitemap entries, exported API contracts), (3) test suite + typecheck + lint green after removal, (4) coverage never drops below baseline (when tooling available).
- Commit per batch, local only, NEVER push. Commit message: `refactor: remove dead <what> (<why, one line>) — <how verified>`.
- Stop-and-report on the first Anything-Goes-Wrong: any failing gate, any found-but-unremovable LIKELY DEAD, any uncertain classification, or any candidate the author cannot verify to their own standard. Everything found is reported in the Final Report, even when kept.
- Defer, never delete: anything structurally required (framework registration, i18n key parity, test infrastructure, seed data pinned by parity tests).
- The audit covers: `src/app/**`, `src/components/**`, `src/hooks/**`, `src/lib/**`, `src/data/**`, `src/i18n/**`, `src/middleware.ts`, `src/test/**` (audit only), `src/__tests__/**` (audit only), `messages/*.json` (key-parity audit only).
- Edits permitted outside `frontend/src`: `frontend/package.json` devDependencies ONLY for the authorized `@vitest/coverage-v8` line (Phase 0), and `_bmad-output/**` docs. Nothing else.
- Every batch ends with targeted verification: `npx vitest run <affected test files>` + `npm run typecheck` + `npm run lint`, then a commit.

### Never

- Never remove, rename, or reorder i18n message keys in `messages/en.json` / `fr.json` / `ar.json` — the `check:i18n` script and `i18n-shape.test.ts` pin trilingual parity; keys are only removable in lockstep across all three locales and only after Ask-First.
- Never delete, edit, or reorder files under `src/test/` (setup, mocks, next-intl-mock) — test infrastructure.
- Never delete or edit `src/__tests__/*` — they are the verification oracle; they may only grow (a new test proving a candidate dead) and never shrink.
- Never delete or edit framework-registered files: `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/sitemap.ts`, `src/app/api/emails/render/route.ts`, `src/middleware.ts` — registered by filesystem path, never "dead". Their contents may be audited for dead exports/imports only.
- Never touch: `next.config.js`, `tsconfig.json`, `vitest.config.ts`, `tailwind.config.*`, `postcss.config.*`, `src/app/globals.css` (design tokens), `scripts/check-i18n.mjs`, `eslintrc*`/`stylelint*` configs, lockfile (`package-lock.json` — install via `npm install <pkg> --save-dev` only, which updates it).
- Never remove a zero-reference symbol without an AST/static-verification pass confirming the absence of string/getattr-style dispatch, dynamic `import('...')` by name, `Object.keys`/key-concatenation usage, or CSS/`messages` string references.
- Never remove exports of `src/data/*` (wilayas, industries) — parity tests (`wilayas-data.test.ts`, `industries-data.test.ts`, wilaya cross-reference tests) pin them as live contract.
- Never change React Query `queryKeys` contracts — used across hooks and tests by string key.
- Never introduce comments or behavior changes while removing dead code.
- Never run `npm run build` as a per-batch gate — it is baseline + final gate only (it is slow); a failing batch is caught by vitest/typecheck/lint instead.

### Ask-First

- Anything public-surface: app routes (page.tsx existence), middleware matcher, sitemap entries, exported API-service functions, query key strings.
- Any i18n key removal (any locale).
- Any `package.json` change beyond the authorized `@vitest/coverage-v8` devDep line.
- Any candidate whose removal would require deleting a test file, or whose classification rests on a build artifact.
- Any LIKELY DEAD or Uncertain cluster that looks like a product feature in progress (e.g. a component with zero references but with i18n keys authored for it).

## Shared Vocabulary

- Batch = one module (or logical group) of the module list; ends in targeted verification + commit.
- Baseline = state at `baseline_commit` (650e103) after Phase 0 install; full gate + coverage recorded.
- Full gate = `npm run test`, `npm run typecheck`, `npm run lint`, `npm run lint:css`, `npm run check:i18n`, `npm run build` — runs at baseline and at the very end only.
- Coverage = `npx vitest run --coverage` (requires @vitest/coverage-v8) — baseline and end only.
- Targeted verification = `npx vitest run <affected test files>` + `npm run typecheck` + `npm run lint`.
- AST pass = the static zero-reference verification for every removal candidate (see Never list).

## Confidence Rules

- CONFIRMED DEAD requires: zero references in source + tests + messages + configs (AST-verified), no public-surface exposure, removal passes targeted verification AND the module's test file still green, coverage not below baseline at end.
- Zero-test-covered zero-reference candidate -> LIKELY DEAD -> report, keep.
- Reference via string/`getattr`-style dispatch, dynamic import, or concatenated key -> Uncertain -> report, keep, or prove with a probe test if cheap.
- Coverage rule: baseline coverage recorded at Phase 0; any final coverage drop below baseline must be explained or reverted. Zero-coverage + zero-reference -> LIKELY DEAD (tooling-aware rule, same as backend pass).

## Rules for Files

- `.tsx` components: referenced via JSX import or route registration. JSX-import scan = import-graph scan; route registration = filesystem (app/ dir). A component used only by a test is NOT dead (test is the consumer).
- Hooks (`use*`): referenced by import in components/tests. A hook with zero imports but zero tests -> LIKELY DEAD; zero imports but test-covered -> CONFIRMED DEAD candidate (test proves its contract).
- `lib/` modules: referenced by import. `utils.ts` helpers: per-export scan (named exports may be individually dead).
- `queryKeys/*`: keyed by function names used in hooks/services; string-key usage counts as a reference (AST pass must look for `queryKeys.X(` usage patterns).
- `messages/*.json`: parity-locked; audit only.
- `src/test/*`: never delete (Never list).
- `src/__tests__/*`: never delete; a test file that covers a candidate makes the candidate removable in principle (its contract is proven), never the test removable.

## Tasks

1. Phase 0 — baseline: install `@vitest/coverage-v8` (devDep; `npm install -D @vitest/coverage-v8`), run full gate + coverage, record baseline numbers, commit `chore: add @vitest/coverage-v8 for frontend dead-code cleanup coverage gate`.
2. Audit `src/lib/**` — api services, http-client, utils (per-export), queryKeys, validation, checkoutStorage, credits/csv. Verify + commit.
3. Audit `src/hooks/**` — all 17 use* hooks. Verify + commit.
4. Audit `src/data/**` — wilayas, industries (parity-pinned; expect all kept). Verify + commit.
5. Audit `src/components/ui/**` — shadcn primitives (badge, button, checkbox, combobox, dialog, drawer, dropdown-menu, input, input-group, label, scroll-area, select, separator, skeleton, table, textarea, tooltip). Verify + commit.
6. Audit `src/components/**` — auth, billing, credits, layout, locale, marketing, providers, search, settings, wilayas feature dirs. Verify + commit.
7. Audit `src/app/**` — pages, layout, sitemap, email-render route (framework-registered; audit contents for dead imports/exports only). Verify + commit.
8. Audit `src/i18n/**` + `src/middleware.ts` — routing/request/navigation + middleware (registration-pinned; audit contents only). Verify + commit.
9. Audit `src/test/**` + `src/__tests__/**` — audit-only; report anything found, delete nothing. Verify + commit.
10. Final gate — full suite + coverage; write Final Report + Suggested Review Order; commit spec; present.

## Deferred Work

- Nothing from this pass may be deferred to the backend pass or to the sprint; anything found but not removable lands in the Final Report with its classification. If a genuine new work item emerges (e.g. a probe test worth keeping), note it in `deferred-work.md`.

## Verification

- Workdir: `frontend/`.
- Per-batch: `npx vitest run <affected test files>`; `npm run typecheck`; `npm run lint` — expected: green (typecheck/lint fast, ~seconds; vitest parallelizes in-process).
- Baseline + final only: `npm run test`; `npm run typecheck`; `npm run lint`; `npm run lint:css`; `npm run check:i18n`; `npm run build`; `npx vitest run --coverage` — expected: all green; coverage >= baseline; build succeeds.
- Coverage NEVER runs per-batch; full gate NEVER runs per-batch (backend-pass pattern, verified 2026-08-14).

## Report

### Preface

- Frontend (Next.js) dead-code removal pass, same refined ruleset as the backend pass (`spec-dead-code-removal.md`), executed 2026-08-14/15 on `frontend/src/*` + `frontend/src/middleware.ts` under the Frozen Intent (Always/Never/Ask-First) above.
- Baseline recorded at `650e103` (backend pass commit; frontend Phase 0 commits `0e5bc0a` + `10c5b11`): 933 tests / 77 files passed; typecheck/lint/lint:css/check:i18n (530 keys × 3 locales)/build all green; coverage **77.82% stmts** (the baseline this pass protects).
- Pass commits (all local, never pushed): `0e5bc0a` (@vitest/coverage-v8 devDep), `10c5b11` (.gitignore `coverage/`), `698c9ad` (lib/api unexports), `e960d5d` (hooks unexports), `a78a5b5` (components unexports), `3599e0a` (approved deletion batch — this report's focus).
- Review loop: Blind Hunter + Edge Case Hunter task passes over the cumulative diff; findings triaged to the human; the human approved the disputed deletions (see LIKELY DEAD).

### Removed

Commit `3599e0a` — the human-approved deletion batch (15 files, −440 lines, zero behavior change):

- **ui-kit members deleted** (component functions removed, export-list entries removed; `badgeVariants` removed from the export list only — still used internally):
  `badgeVariants` (badge.tsx), `DialogTrigger`, `DialogClose` (dialog.tsx), `TooltipProvider` (tooltip.tsx), `DrawerDescription`, `DrawerFooter` (drawer.tsx), `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuSeparator` (dropdown-menu.tsx), `ComboboxTrigger`, `ComboboxInput`, `ComboboxGroup`, `ComboboxLabel`, `ComboboxCollection`, `ComboboxSeparator`, `ComboboxChips` (combobox.tsx), `InputGroupText`, `InputGroupTextarea` (input-group.tsx), `SelectValue` (select.tsx), `TableFooter`, `TableCaption` (table.tsx).
- **Cascade (unexported, forced by the above)**: `ComboboxClear` (combobox.tsx) — unexported, its only consumer was the deleted `ComboboxInput`; it could not survive.
- **Whole modules deleted** (zero references anywhere, confirmed by AST pass): `scroll-area.tsx`, `separator.tsx`.
- **Orphaned exports deleted**: `billingKeys.all` (queryKeys/billing.ts), `savedSearchesKeys.detail` (queryKeys/savedSearches.ts), `useLocaleContext` (providers/LocaleProvider.tsx), `Locale` type + `DEFAULT_LOCALE` (i18n/routing.ts).
- **Unused imports cleaned** in the same files (combobox.tsx input-group imports, dropdown-menu.tsx ChevronRightIcon, LocaleProvider.tsx useContext, input-group.tsx Textarea).
- Earlier batches (unexports, no behavior change): `698c9ad` — 8 internal-only types/classes unexported in `src/lib/api` (BillingApiError, ExportApiError, RevealedContact, RevealApiError, SavedSearchApiError, SearchApiError, DeletionSchedule, SettingsService); `e960d5d` — 25 internal-only hook types unexported in `src/hooks`; `a78a5b5` — 18 internal-only component types unexported in `src/components`.
- Tooling: `@vitest/coverage-v8@^2.1.8` devDep (`0e5bc0a`), `coverage/` gitignored (`10c5b11`).

### Preserved

- `getPathname` (i18n/navigation.ts) — kept by recommendation: next-intl navigation helper convention; zero-risk to keep, and its classification rested on next-intl internals, not on app references.
- `src/data/*` exports (wilayas, industries) — parity-pinned live contract; audit clean anyway.
- All live ui-kit members, hooks, lib services, queryKeys members not listed above — confirmed referenced.
- Framework-registered surfaces audited only (app routes, middleware, sitemap, email-render route): contents found clean; nothing removed.
- `messages/*.json` — untouched (trilingual parity, 530 × 3, still ✓ at final gate).
- `src/test/**`, `src/__tests__/**` — audit-only, nothing deleted.

### LIKELY DEAD

- The 25 candidates listed in Removed were classified LIKELY DEAD under the strict rule (zero source references but zero test coverage of the host module — their proof of death rests on the AST pass + consumer coverage, not on a dedicated test). Per the ladder they must not be removed by the agent — they were escalated as an Ask-First cluster in the review-loop triage, and the **human approved removal** ("proceed with deleting these", 2026-08-15). Executed in `3599e0a`, verified green (below). The rule was honored: the agent never self-authorized; the decision is the human's, and this section records it.
- Remaining LIKELY DEAD inventory after this decision: **none** (everything disputed was either removed by approval or proven live).
- Edge Case Hunter note (docs-only, zero runtime impact): removed names still appear in old design docs — `SettingsService` ×3 in `2-6-account-deletion.md`, `RevealedContact` ×2 + `RevealApiError` ×1 in `4-2-reveal-api-component.md`. Docs predate the API surface; no code impact; not edited (out of pass scope).

### Uncertain

- None. `getPathname` was the only debatable classification and resolved as keep (Preserved).

### Ask-First

- Coverage-threshold wiring in `vitest.config.ts` (enforce ≥ baseline programmatically) — Ask-First / Never-list territory; deferred to `deferred-work.md` rather than touched.

### Verification

- Mid-gate (after batches 2–5, before deletions): full suite 933/933.
- Final gate (2026-08-15, after `3599e0a`): `npm run test` **933/933 (77 files)**; `npm run typecheck` green; `npm run lint` zero warnings; `npm run lint:css` green; `npm run check:i18n` 530 keys × 3 locales ✓; `npm run build` compiled successfully; `npx vitest run --coverage` **933/933, coverage 80.03% stmts ≥ baseline 77.82%** (the gain comes from zero-covered dead modules leaving the denominator).
- Removability gates met for every item: AST pass (refmap) showed zero references; no public-surface exposure (app routes/middleware/i18n keys untouched); suite/typecheck/lint green after each batch; coverage at or above baseline at the end.

### Suggested Review Order

1. `frontend/src/components/ui/combobox.tsx` — largest deletion (8 members + `ComboboxClear` cascade + import cleanup); verify the surviving exports match consumers in `search/WilayaCombobox.tsx`. (`3599e0a`)
2. `frontend/src/components/ui/dropdown-menu.tsx` — 6 members + ChevronRightIcon import cleanup. (`3599e0a`)
3. `frontend/src/components/ui/{dialog,tooltip,drawer,input-group,select,table,badge}.tsx` — member deletions + export-list diffs. (`3599e0a`)
4. `frontend/src/components/ui/scroll-area.tsx`, `frontend/src/components/ui/separator.tsx` — whole-module deletions (git show `3599e0a`).
5. `frontend/src/components/providers/LocaleProvider.tsx`, `frontend/src/i18n/routing.ts`, `frontend/src/lib/queryKeys/billing.ts`, `frontend/src/lib/queryKeys/savedSearches.ts` — orphaned exports. (`3599e0a`)
6. `git show e960d5d` (hooks unexports, 25), `git show a78a5b5` (components unexports, 18), `git show 698c9ad` (lib/api unexports, 8) — the earlier batches.
7. `git show 0e5bc0a 10c5b11` — tooling commits.