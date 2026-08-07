# Deferred Work

## Deferred from: code review of story 4.1 (2026-08-07)

- **SERIALIZABLE guard breaks under composition**: `reveal_contact` runs `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` as the first statement inside its `transaction.atomic()` — PG raises `ProgrammingError` if a future caller (e.g. the 4.2 reveal view) wraps the call in an OUTER atomic block or executes any query before it. Contract: call `reveal_contact` directly, never inside an outer `transaction.atomic()`. The per-user `select_for_update` lock (added in review) carries the concurrency correctness on any isolation level, so the guard is defense-in-depth — the composition hazard is a loud error, not silent corruption. [backend/apps/credits/services.py]

## Deferred from: code review of story-3.7-checklist-card (2026-08-06)

- **15-credit-banner handoff**: the checklist card AC says "appears below the 15-credit banner", but the banner does not exist yet (credit surfaces land in Epic 4). 3.7 renders the card as the FIRST child of `#results`. Epic 4 must render the 15-credit welcome banner immediately ABOVE the card (the banner slots before `#results`'s first child — the card's DOM-order test pins the position). [frontend/src/components/search/SearchPage.tsx, frontend/src/components/search/ChecklistCard.tsx]
- **Step-2/step-3 Epic-4 event contract**: `ChecklistView` GET returns `step_reveal`/`step_export` hard-coded `false` (the `reveals`/`exports` tables do not exist until Epic 4). Contract for 4.x: (a) backend — extend `ChecklistView._state` with `EXISTS` clauses on `reveals`/`exports` replacing the literal False (documented in views.py:296-299; the client contract does not change); (b) frontend — the 4-2 reveal and 4-5 export mutations MUST `invalidateQueries({ queryKey: checklistKeys.all })` on success, or the card's live check-off for steps 2/3 stops working. [backend/apps/search/views.py, frontend/src/hooks/useChecklistMutations.ts]

## RESOLVED by Story 3.5 (2026-08-05)

- ~~No timeout/abort on search requests~~ — **RESOLVED**: shared `timeout: 20000` in the HttpClient default config (all AD-19 services inherit) + `signal` forwarding on `searchPeople`/`searchCompanies` (queryFn abort on new submit; a hung request can no longer strand the page in loading). [frontend/src/lib/api/http-client.ts, frontend/src/lib/api/search-service.ts]
- ~~`aria-live="polite"` wraps the whole `#results` section~~ — **RESOLVED**: the polite region moved to the count/status line (`data-testid="results-status"`); the table is outside the live region; sort/page changes announce via an sr-only `role="status"` span inside it. [frontend/src/components/search/SearchPage.tsx]
- ~~AD-20 TanStack Query adoption~~ — **RESOLVED**: `QueryClientProvider` mounts in `Providers` (module-scoped client, `retry: false` + `refetchOnWindowFocus: false` — retry:false is a quota contract: a retried success would double-burn `daily_usage`); the results query is a `useQuery` consumer via the AD-19 `SearchService` methods (queryFn receives the abort signal); session stays SessionProvider-owned. The 3.4 gate test remains as the smoke guard. [frontend/src/components/providers/Providers.tsx, frontend/src/components/search/SearchPage.tsx]
- ~~`FilterSidebar` `applied` re-sync effect untested / clobbers post-submit edits~~ — **RESOLVED**: SearchPage drives `applied` with stable identity (set only on query success); the resync effect now carries a dirty-guard (`dirtyRef`) — staged edits during a query flight are never clobbered (verified by the 3.3 "keeps staged filters editable" test); chip removals stage via the new `stagedPatch` prop. [frontend/src/components/search/FilterSidebar.tsx]
- ~~Badge double-count landmine (draft.wilayas + wilayaCount)~~ — **RESOLVED**: badge = `countActiveFilters({ ...draft, wilayas: [] }) + wilayaCount` — wilayaCount is the single wilaya source while the combobox is wired (fires NOW because 3.5 drives applied). [frontend/src/components/search/FilterSidebar.tsx]
- ~~Dual combobox instances keep independent query state~~ — **RESOLVED**: `WilayaCombobox` gained optional controlled `inputValue`/`onInputValueChange`; SearchPage owns ONE shared query state fed to both aside + drawer mounts (same React element, two mounts — synchronized by construction). [frontend/src/components/search/WilayaCombobox.tsx, SearchPage.tsx]

## Deferred from: code review of story-3.5-results-table-stacked-row (2026-08-05)

- `/companies/:id` company-name links render per the AC literal but 404 until the company-detail surface lands (CompanyDetailPage is not in Epic 3's story list). No stub created — the link is forward-correct; the detail story must land before launch. [frontend/src/components/search/ResultsTable.tsx, ResultsTableStackedRow.tsx]

## RESOLVED by Story 3.4 (2026-08-05)

- ~~`elementFromPoint` jsdom polyfill returns the open drawer popup for every call site~~ — **RESOLVED**: polyfill now returns `[data-slot="combobox-content"]` first, then `[data-slot="drawer-popup"]`, else body. [frontend/src/test/mocks.ts]
- ~~Cross-stack industry parity is dev-run only~~ — **RESOLVED**: `backend/apps/search/tests/test_wilaya_parity.py` asserts industries lockstep (count, ids 1..N, name_en order) with a strict TS-array parser. [backend/apps/search/tests/test_wilaya_parity.py]
- ~~No cross-stack parity test between `backend/apps/search/data/wilayas.py` and `frontend/src/data/wilayas.ts`~~ — **RESOLVED**: the same parity module asserts wilaya lockstep (58 entries, codes 1–58, trilingual non-blank); mutation-verified (code swap → test fails). Canonical source = the frontend TS files. [backend/apps/search/tests/test_wilaya_parity.py]

## Deferred from: code review of story-3.3-filter-sidebar-component (2026-08-05)

- ~~No timeout/abort on search requests~~ — **RESOLVED by 3.5**: shared `timeout: 20000` in the HttpClient default config + `signal` forwarding on search methods. [frontend/src/lib/api/search-service.ts, frontend/src/lib/api/http-client.ts]
- ~~`FilterSidebar` `applied` re-sync effect~~ — **RESOLVED by 3.5**: `applied` driven with stable identity (set on query success) + dirty-guard resync + chips staging via `stagedPatch`; 3.6 saved-search re-runs restore `applied.wilayas` into the combobox via SearchPage. [frontend/src/components/search/FilterSidebar.tsx]
- Physical-property classes inside stock shadcn base-nova wrappers (drawer.tsx `md:text-left`, `left-`/`right-` swipe-direction variants, tooltip.tsx arrow offsets, scroll-area.tsx `border-l`) — registry defaults, dormant in 3.3 (swipe-down only, mobile only). Revisit if the drawer is reused at ≥md in RTL or if a CSS lint gate is added; do not hand-edit registry files lightly. [frontend/src/components/ui/{drawer,tooltip,scroll-area}.tsx]
- ~~`aria-live="polite"` wraps the whole `#results` section~~ — **RESOLVED by 3.5**: the polite region moved to the count/status line; the table is outside the live region. [frontend/src/components/search/SearchPage.tsx]
- Registry-file class debt in the 3.4 combobox wrapper (physical `-ml-1`/`right-2`/`pl-1.5`/`pr-8` inside stock `combobox.tsx` ItemIndicator/ChipRemove, physical `data-[side=left|right]:` slide variants) — dormant (chips use custom remove buttons; popup sides default to bottom/start); revisit with the same caveat as the drawer debt. [frontend/src/components/ui/combobox.tsx]
- ~~AD-20 TanStack Query: gate CHECK PASSED in Story 3.4~~ — **RESOLVED by 3.5**: adoption completed — QueryClientProvider in Providers, results query is a useQuery consumer, session stays SessionProvider-owned. [frontend/src/__tests__/tanstack-query-gate.test.tsx]

## Deferred from: code review of story-3.4-wilaya-combobox (2026-08-05)

- Dual combobox instances (the sidebar renders the same `wilayaField` node in the aside AND the drawer) keep independent internal query state — a query typed in the drawer can resurface when the aside popup reopens after a surface switch; while the drawer is open there are two `role="combobox"` inputs in the DOM (the aside is `display:none`, so it stays out of the a11y tree). Lift the query state or scope per surface in 3.5/3.6. [frontend/src/components/search/WilayaCombobox.tsx, FilterSidebar.tsx]
- `elementFromPoint` jsdom polyfill ignores coordinates: with the drawer AND the combobox popup both open, every point reports the combobox popup — combobox click-outside dismissal is untestable in that combination (latent; no current test opens the combobox inside the drawer). [frontend/src/test/mocks.ts]
- Combobox popup can outlive its anchor when the viewport crosses the md breakpoint while open (orphan floating popup; real browser only — the drawer has the matchMedia-close precedent, the combobox does not). [frontend/src/components/search/WilayaCombobox.tsx]
- Badge double-count landmine: `countActiveFilters` counts `draft.wilayas` AND the sidebar badge adds `wilayaCount` — safe today (`draft.wilayas` is always `[]` while the field is wired), but when 3.6 feeds `applied.wilayas` into the draft re-sync the badge becomes 2×N. 3.6 must normalize: `wilayaCount` is the single wilaya source while the combobox is wired. [frontend/src/components/search/FilterSidebar.tsx, frontend/src/lib/api/search-service.ts]
- Pre-existing AD-8 risk in the 3.3 key `search.filters.badge` — next-intl formats `{count}` with the locale's numeral system, so the mobile Filters badge renders Arabic-Indic digits in AR. The 3.4 fix (`String()` for `wilaya_more`) covers only the new key; a numbering-system pass over interpolated counts is needed pre-launch. [frontend/messages/ar.json]

## Deferred from: code review of story-3.2-search-api-endpoints (2026-08-05)

- Rate-limit check-then-increment TOCTOU: the quota SELECT and the atomic upsert span the search query, so a concurrent burst at count = limit-1 can exceed the 30/100 cap. One-statement `INSERT ... ON CONFLICT DO UPDATE ... WHERE search_count < limit RETURNING` would require increment-before-success (conflicts with Q8) and a PG transaction + row lock; needs a Postgres-backed CI job to be exercised. Spine-documented pattern. [backend/apps/search/quota.py]
- PG keyword path exercised only via string assertions in CI (SQLite fallback runs behavior tests); real-PostgreSQL verification was done ad-hoc in this review. Add a Postgres-backed CI job that runs the search API tests against PG (deferred-work 2.2 precedent). [backend/apps/search/fts.py]

## Deferred from: code review of 3-1-search-database-schema (2026-08-04)

- `bulk_create` / `bulk_update` / `QuerySet.update()` skip the `save()` override, leaving `search_normalized` empty/stale (tsvector silently empty). Requirement for story 3.2 (search API) and Epic 6 (scraper pipeline): writers must set `search_normalized` explicitly or write per-row. [backend/apps/search/models.py]
- DailyUsage upsert via update-then-create races under concurrent rate-limited requests (both create → IntegrityError). Story 3.2 must use an atomic PG `INSERT ... ON CONFLICT (user_id, date) DO UPDATE` upsert; the tested pattern is the SQLite-compatible approximation. [backend/apps/search/tests/test_daily_usage.py]
- No cross-stack parity test between `backend/apps/search/data/wilayas.py` and `frontend/src/data/wilayas.ts` (mirrored by process, not by test). Story 3.4 (wilaya combobox) should consolidate the canonical source and add a parity check.

## Deferred from: code review of 2-2-signup-free-credits (2026-08-01)

- Rate limiting on `POST /api/auth/signup/` and `POST /api/auth/resend-verification/` — anonymous email bombing of existing users + unbounded account creation. Needs a new dependency (django-ratelimit / django-axes) → user approval required before prod. [backend/apps/accounts/views.py:159,225]
- `select_for_update` is a silent no-op on SQLite — the concurrent-verify double-grant protection is only exercised on Postgres; CI currently runs no backend tests. Add a Postgres-backed CI job. [backend/apps/accounts/views.py:174]
- Client routing for 401 `email_not_verified` (redirect to /verify-email) + refresh tokens minting for unverified users — belongs to story 2.3 (Login & Session Management). [backend/apps/accounts/auth.py:27]
- `SingleUseToken` rows accumulate (resend invalidates by UPDATE, never deletes) — add a daily cleanup task (expired/consumed rows) to the ops maintenance backlog.
- Verification token exposed in URL path / access logs — standard email-link tradeoff; mitigated by single-use + 24h TTL.
- stylelint globals.css debt (136 pre-existing errors in the story-1.x design-token file) — unrelated to story 2.2; `lint:css` is not in the CI verification list.

## Deferred from: code review of story 2.1 (2026-08-01)

- djoser 2.2.3 has no register/login/logout/password-reset endpoints — `include('djoser.urls')` mounts only the `users/` router. Story 2.2 (signup) and 2.4 (password reset) must plan custom endpoints; story dev notes corrected. [backend/config/urls.py:15]
- No migrate step in deploy path (docker-compose.yml django command, backend/Dockerfile gunicorn, .github/workflows/deploy.yml); AUTH_USER_MODEL switch is unsupported on an already-migrated default-user DB. [docker-compose.yml:42]
- last_active_at per-request write amplification — authenticated requests within a 1-minute window trigger a full UPDATE on the users row (auth.py:20-22); revisit interval when traffic exists.

## Deferred from: code review of 2-3-login-session-management (2026-08-01)

- "7 days" deletion grace hardcoded in frozen-account copy; backend has no shared grace constant. Story 2.6 owns the deletion-grace flow (recover action + constant). [frontend/messages/en.json]
- SessionUser cast blindly from /api/auth/me/ response; a backend field change would silently corrupt the Header. Adopt zod response parsing (AD-18 pattern) in a later story touching session data. [frontend/src/lib/api/auth-service.ts:22]
- /frozen renders the guest header (Login/Sign up links) since the probe degrades to guest there. Story 2.6 refines the frozen surface. [frontend/src/components/layout/Header.tsx:18]
