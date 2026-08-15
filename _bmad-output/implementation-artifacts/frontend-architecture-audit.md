# Frontend Architecture Audit — Resolution Report

Date: 2026-08-15
Scope: `frontend/src` (Next.js 15 App Router, React 19, TanStack Query 5, next-intl, Base UI)
Baseline: the react-refactor audit (40 rules / 7 categories → 15 findings H1–H5, M1–M14), executed as a 6-phase remediation plan. All work committed locally only (never pushed).

## Verification trajectory

| Phase | Commit | Suite | Coverage (stmts) |
| --- | --- | --- | --- |
| Baseline (post dead-code pass) | — | 933 tests | 80.02 % |
| Phase 1 — results-format extraction (H1) | `13e5994` | 933 | 80.02 % |
| Phase 2 — error/loading/not-found shells (H2) | `a69d4bb` | 938 | 80.13 % |
| Phase 3 — URL-backed search + controlled FilterSidebar (H3+H4+M4+M1+M2) | `cc5c20c` | 953 | 80.22 % |
| Phase 4 — query-key/reveal-cache centralization (H5+M8) | `bf0d627` | 960 | 80.23 % |
| Phase 5 — stability + plumbing (M6+M7+M9+M10+M11+M12) | `29e4aa9` | 963 | 80.22 % |
| Phase 6 — M14 + cleanup + pure-logic tests | `714cf5d` | 973 | 80.25 % |

Gates held green on every phase: `tsc --noEmit`, `next lint` (0 warnings), `check:i18n` (534 keys × 3 locales parity), full `vitest run`, `next build`, `vitest --coverage` (never below the committed baseline).

## Phase 1 — Results-format extraction (H1)

Cycle break: `ResultsTable` ⇄ `RevealControl` circular import dissolved by extracting `src/components/search/results-format.tsx` (shared display helpers, 100 % covered). Removed the duplicated `wilayaLabel`-class logic; `ResultsTable` and `RevealControl` now import from one module.

## Phase 2 — Error/loading/not-found shells (H2)

- `src/app/[locale]/error.tsx` — logs the error, reset-retry button, `buttonVariants`-styled home link, `data-testid="error-boundary"`.
- `src/app/[locale]/not-found.tsx` — reuses the existing `common.states.not_found` string (no new copy), `data-testid="not-found"`.
- `src/app/[locale]/loading.tsx` — skeleton, `data-testid="page-loading"`.
- i18n: `common.errors.{title,description,try_again,go_home}` merged into the PRE-EXISTING `common.errors` namespace (validation keys `required/invalid_email/...`) in en/fr/ar. Incident recorded: a first draft shadowed the block with duplicate JSON keys (last-wins) — the lesson (check for an existing namespace before adding keys) is captured in the keys' review path.
- Tests: `error-boundary.test.tsx`, `not-found.test.tsx`, `page-loading.test.tsx`.

## Phase 3 — URL-backed search + controlled FilterSidebar (H3+H4+M4+M1+M2)

The search screen became a URL-state machine:

- `src/lib/search/search-params.ts` (new, 20 unit tests): `SORT_FIELDS`, `sortParamFor/parseSortParam`, tab-scoped `filtersToParams/paramsToFilters` (`ind/wil/sen/siz/kw/unk`), `pageFromParams` (≥1), `buildSearchUrl` with the `runs=1` marker (a committed EMPTY search = "search everything", distinct from the never-ran clean URL), `buildSubmitted` (returns null until the URL says "ran"), `removeFacetValue`, `ChipRemoveEvent`.
- `src/hooks/useSearchForm.ts` (new): `useReducer({draft, dirty})` with `draft/applied/committed/cleared` actions; `commit(filters, sort, page=1)` pushes the URL; `submitted` derived from the URL.
- `FilterSidebar` became CONTROLLED: `draft/onDraftChange/onApply/onClearAllRequest` replace the applied-sync/chipRemove/submit props; the rate-limit path closes the mobile panel first; the free-tier path opens the single Upgrade Dialog.
- `SearchPage` state cut to `wilayas/wilayaQuery/sidebarOpen/activeSavedId/announcement`; `handleApply` lifts the wilayas merge (`{ ...draft, wilayas }`); `nonce`/`beginSearch`/`useSearchResults` deliberately UNCHANGED (nonce feeds ExportToolbar → ExportModal → useExportPreview).
- `<Suspense>` wrappers on both search routes (useSearchParams requirement).
- Root-cause fix: 27 initial test failures all traced to the missing `runs=1` marker; resolved by design, not by test weakening.
- Deliberate, documented delta: re-applying the same URL is a no-op (no refetch of an identical query); `wilayaQuery` stays lifted (dual-combobox contract).
- Tests: `search-params.test.ts` (20), `filter-sidebar.test.tsx` rewritten against a `SidebarHarness`, three SearchPage suites using a reactive `next/navigation` mock (vi.hoisted store + `useSyncExternalStore`).

## Phase 4 — Query-key/reveal-cache centralization (H5+M8)

- `src/lib/user-key.ts` (new): `userKey(user)` = `user?.email ?? 'guest'` — replaces the inline idiom at 9 sites (`useCreditsBanner`, `useCreditsLedger`, `usePaymentStatus`, `useBilling`, `usePacks`, `usePlan`, `useReveal`, `RevealControl`, `StatusCard`). One derivation, one cache partition.
- `src/lib/queryOptions/billing.ts` (new): `planQueryOptions/packsQueryOptions/historyQueryOptions` — the Header (`usePlan`), `/billing` (`useBilling`) and the RecoveryDialog (`usePacks`) now observe ONE shared cache entry per key (no split-brain); `usePlan` keeps its documented AD-21 `refetchOnWindowFocus: true` override; `usePacks` keeps the open-gate.
- `src/lib/reveal/reveal-cache.ts` (new): `RevealVariables`, `RevealInFlight`, `isSearchCache`, `updateSearchResultsWithReveal` moved out of the hook; `useReveal` now captures the session key at dispatch and guards the settle-time writes (a logout/login mid-flight can never write the new user's UI). `RevealControl` imports the types from the lib module.
- Tests: `reveal-cache.test.ts` (cache-shape guards, non-search caches untouched, matching-row flip), billing query-options key derivation + enabled gates.

## Phase 5 — Stability + plumbing (M6+M7+M9+M10+M11+M12)

- M6 — `completedSteps` (checklist-service) returns a content-keyed, referentially stable array: ChecklistCard's announcement effect fires only on real flips, not on every render.
- M7 — `UpgradeDialogProvider.open`/`close` are now identity-stable: the double-click guard moved to a one-way ref mirror (`deps: []`). ExportModal's upgrade re-point effect no longer re-fires on dialog flips (comment updated); StatusCard's success effect gained its full deps (`key, toast, refresh, resetBaseline, queryClient`) and lost the eslint-disable.
- M9 — `PendingCheckout` moved from `usePaymentStatus` into `checkoutStorage` (the storage layer no longer imports the hook layer); all importers updated.
- M10 — `AuthService.signup/resendVerification/verifyEmail` added; `SignupForm`, `VerifyEmailGate` and `VerifyLinkHandler` dropped raw `fetch` and now ride the shared interceptor stack (auth-redirect, offline-abort, refresh); `SignupErrorBody` type exported; the three auth test files rewired from fetch mocks to service mocks (behavioral assertions preserved, including the double-submit guard and the 400/404/410 classification).
- M11 — `src/hooks/useAccountMutations.ts` (new): DangerZone's delete-account and FrozenAccountPanel's undelete flows wrapped in TanStack mutations (`isPending` drives the buttons; error classification stays in the component via mutate options). Both test wrappers gained `QueryClientProvider`.
- M12 — `CreditProvider` syncs the server balance DURING render (React's stored-previous-value pattern) — no post-render effect pass, no stale-balance frame; `ExportToolbar` remounts `ExportModal` per open-session key (AC-pinned defaults + clean mutation state are mount-inherent; the reset-on-open effect and its `useExport.reset` consumer are gone; the close animation survives because the key only advances on OPEN). ExportModal/ExportToolbar tests updated to the remount contract.

## Phase 6 — M14 + cleanup + pure-logic tests

- M14 — the status card's timeout flip now uses an external-time store: `src/lib/billing/deadline-alarm.ts` (subscribe/getSnapshot/arm/clear singleton, single timer, no-op for passed deadlines) consumed via `useSyncExternalStore` in `usePaymentStatus` — the counter-state render-hack is gone. The status derivation is a pure function: `src/lib/billing/payment-status.ts` `classifyPaymentStatus(status, startedAt, now)` (terminal statuses beat the deadline; NaN deadline = passed; no checkout = never times out).
- LocaleProvider (zero consumers, hardcoded `fr`) deleted; `Providers.tsx` unwrapped.
- `'use client'` stripped from the self-guarding `checkoutStorage` lib module (its `typeof window` guards make it safe from server imports).
- Pure-logic tests: `deadline-alarm.test.ts` (fake-timer notify/bump/clear/re-arm/unsubscribe, relative-tick isolation) and `payment-status.test.ts` (all branches incl. terminal-over-deadline and NaN).

## Remaining deferred scope (recorded, not silent)

- M13 — full RSC server-side fetch for the search results is deliberately out of scope; only the error/loading/not-found shells landed.
- `useExportPreview` left as-is (M12 partial) — its retry/collector loop is behavior-tested.
- No bulk test `data-testid` churn; DI container approach accepted (no DI framework added).
- Coverage-threshold wiring in `vitest.config.ts` remains deferred (see `deferred-work.md`) — the suite-level number is the standing guardrail instead.
- Backend-side deferrals (webhook envelope, replay-after-purge, tier split-brain, etc.) unchanged — see `deferred-work.md`.