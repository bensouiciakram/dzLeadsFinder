---
story_id: 4.3
epic: 4
title: Story 4.3 — Credits Pill & Ledger
Status: done
frs: [FR-15, FR-16]
ads: [AD-8, AD-12]
ux_drs: [UX-DR6, UX-DR20, UX-DR21, UX-DR24]
baseline_commit: 849d83d
---

# Story 4.3: Credits Pill & Ledger

Status: done

## Story

As a **credit-conscious user**,
I want **to see my remaining credits at all times in the header, get warned when I'm low, and review my 90-day credit history on a dedicated page**,
So that **I always know where my credits stand and can track usage**.

## Acceptance Criteria

**Given** the Credits Pill in the header
**When** an authenticated user views any page
**Then** a pill in the header shows the current credit balance
**And** it uses {rounded.full}, 28px height, {colors.muted} / {colors.foreground} by default
**And** the balance is rendered in {typography.data} with `tabular-nums` and Western Arabic numerals
**And** a coin icon precedes the balance

**Given** the low-credit warning state (≤10 credits, paid users)
**When** a Starter user has ≤10 credits
**Then** the pill shifts to {colors.warning-container} / {colors.warning-on-container}
**And** a persistent `alert-triangle` icon appears beside the balance
**And** a tooltip explains "Low credits — top up soon"

**Given** the zero-credit state
**When** balance hits 0
**Then** the pill shifts to {colors.danger-container} / {colors.danger-on-container}
**And** clicking opens the recovery dialog (top-up for Starter, upgrade for Free)

**Given** live updates
**When** a reveal or export deducts credits
**Then** the Credits Pill decrements in-place without a page reload (≤200ms color transition, number never animates)
**And** the change is announced via `aria-live="polite"`
**And** clicking the pill navigates to `/credits`

**Given** the Credits Ledger page (`/credits`)
**When** an authenticated user navigates to it
**Then** it shows the last 90 days of credit activity
**And** each row displays: type (localized), amount, timestamp, balance-after, reference (order id / reveal id)
**And** the types are: free_signup, subscription_grant, pack_grant, promotional_grant, reveal_debit, export_row_debit, expiry
**And** the table is exportable as CSV from the page

**Given** the ledger API
**When** I inspect `GET /api/credits/ledger/`
**Then** it returns the last 90 days of credit_ledger rows for the authenticated user
**And** supports pagination

**Given** empty ledger state
**When** there is no activity in the last 90 days
**Then** an empty note is shown: "No credit activity in the last 90 days"
**And** a link to `/search` is provided
**And** CSV export of empty ledger is still offered (headers only)

## Tasks / Subtasks

- [x] **Task 1: Backend — `GET /api/credits/ledger/` endpoint** (AC: ledger API; FR-16; contracts: 90-day window / newest-first / paginated / RAW event codes / pure read — Dev Notes D2)
  - [x] 1.1 RED: `backend/apps/credits/tests/test_ledger_api.py` — NEW — module-level `pytestmark = pytest.mark.django_db`; fixtures: the conftest `create_user`/`api_client` pair + local `ledger_session` factory (verified user + login — the `test_reveal_api.py` pattern) + a local `grant(user, amount, pool)` ledger helper (the 4.1 `user_with` pattern):
    - **anonymous** → 401 (default IsAuthenticated + CookieJWTAuthentication).
    - **empty ledger**: verified user with NO ledger rows → 200 `{'results': [], 'total': 0, 'page': 1, 'truncated': False}`.
    - **90-day window**: rows created 80 days ago INCLUDED; rows created 95 days ago EXCLUDED (create then `CreditLedger.objects.filter(pk=...).update(created_at=...)` to backdate — the 4.1 backfill-migration test precedent).
    - **newest first**: three rows at now, now-1h, now-2h → results order matches (the model Meta `ordering = ['-created_at']` — assert the payload order, not the queryset).
    - **pagination**: 55 rows → page 1 returns 50 rows + `total: 55`; `?page=2` returns 5 rows; `?page=3` returns `[]` (out-of-range page → 200 empty, NO search-style 400 — no navigable cap exists, D2).
    - **page param strictness**: `?page=0` → 400 `{'code': 'invalid_payload'}`; `?page=abc` → 400 `invalid_payload` (the strict-parse precedent — `parse_page`-style, D2); `?page=` (empty string) → 400 `invalid_payload` (aligned with the search `parse_page` precedent, which raises on `int('')` — the story draft's "empty defaults to 1" was revised during RED to match the strict precedent).
    - **row shape exact-keys**: one grant row → the single result has EXACTLY `{'id', 'event_type', 'amount', 'balance_after', 'reference_id', 'created_at'}` (pin with set equality — the 3.2 exact-keys precedent).
    - **RAW event_type codes**: grant `subscription_grant` + debit `reveal_debit` → `event_type` values are the raw codes (localization is FRONTEND — D2), never translated.
    - **reference_id passthrough**: a ledger row with `reference_id='abc-123'` → echoed in the payload.
    - **created_at ISO-8601**: the payload `created_at` parses via `datetime.fromisoformat` (the DRF DateTimeField default — D2).
    - **frozen user** → 401 `code == 'account_deleted'` (the auth-layer policy — 4.2 D6; NO view-level check).
  - [x] 1.2 GREEN:
    - `backend/apps/credits/services.py` — UPDATE — add `LEDGER_WINDOW_DAYS = 90` (the single cutoff constant — list and CSV can never diverge, D5).
    - `backend/apps/credits/views.py` — UPDATE — `class CreditsLedgerView(APIView)` with `get(self, request: Request) -> Response`: parse `page` strictly (int, ≥1, default 1; invalid → 400 `{'detail': ..., 'code': 'invalid_payload'}` — the strict-whitelist precedent); `rows = CreditLedger.objects.filter(user_id=request.user.id, created_at__gte=timezone.now() - timedelta(days=LEDGER_WINDOW_DAYS))` (the `credit_ledger_user_created_idx` composite index covers filter+order — D2; ordering from the model Meta `-created_at`); `total = rows.count()`; slice `[offset:offset + 50]` (page size constant `LEDGER_PAGE_SIZE = 50` in services.py); payload `{'results': [{'id': str(r.id), 'event_type': r.event_type, 'amount': r.amount, 'balance_after': r.balance_after, 'reference_id': r.reference_id, 'created_at': r.created_at.isoformat()} for r in page_rows], 'total': total, 'page': page, 'truncated': False}` — the search-shape mirror D2 (truncated is always False: the 90-day window IS the complete set, no navigable cap). **PURE READ — no `transaction.atomic()`, no lock, no write** (D2). The model `__str__`/admin need no change (4.1 admin already searchable).
    - `backend/apps/credits/urls.py` — UPDATE — add `path('ledger/', CreditsLedgerView.as_view(), name='credits-ledger')` (the existing `'<str:record_type>/<str:record_id>/'` reveal path is untouched — the two patterns cannot collide: `ledger/` has no trailing segments).
    - `backend/config/urls.py` — UPDATE — add `path('api/credits/', include('apps.credits.urls'))` (VERIFIED: the file currently mounts only `api/reveal/` → `apps.credits.urls`; the ledger include is a NEW line — `GET /api/credits/ledger/` resolves through the credits app's urls module).
  - [x] 1.3 Run backend gates (pytest/ruff/mypy strict) — green.

- [x] **Task 2: Backend — 15-credit welcome banner dismissal** (banner = 4.3 scope decision; persisted dismissal — the 3.7 checklist precedent verbatim, Dev Notes D4)
  - [x] 2.1 RED: `backend/apps/accounts/tests/test_credits_banner.py` — NEW — (the 3.7 `test_checklist.py`-style suite; `pytestmark = pytest.mark.django_db`):
    - **anonymous** GET/PUT → 401.
    - **GET fresh** → 200 `{'dismissed': False}`.
    - **PUT strict** `{'dismissed': True}` → 200 `{'dismissed': True}` and `users.credits_banner_dismissed_at` set (refresh from DB).
    - **PUT invalid** `{'dismissed': 1}` / `{}` / `{'dismissed': True, 'extra': 1}` → 400 `{'code': 'invalid_payload'}` (the strict key+identity comparison — 3.7 PUT verbatim: `data.keys() != {'dismissed'} or data['dismissed'] is not True`).
    - **GET after PUT** → `{'dismissed': True}`.
  - [x] 2.2 GREEN:
    - `backend/apps/accounts/models.py` — UPDATE — `credits_banner_dismissed_at = models.DateTimeField(null=True, blank=True)` on the User model (beside `checklist_dismissed_at` — the 3.7 precedent).
    - `backend/apps/accounts/migrations/0004_user_credits_banner_dismissed_at.py` — NEW — `AddField` migration (real-PG verified by the backend test run; the 3.7 accounts-0003 precedent).
    - `backend/apps/search/views.py` — UPDATE — `class CreditsBannerView(APIView)` with `get` → `{'dismissed': request.user.credits_banner_dismissed_at is not None}` and `put` → the strict `{'dismissed': True}` identity check (ChecklistView.put verbatim), `update(credits_banner_dismissed_at=timezone.now())` + mutate the in-memory user, return `{'dismissed': True}`.
    - `backend/apps/search/urls.py` — UPDATE — `path('credits-banner/', CreditsBannerView.as_view(), name='credits-banner')`.
  - [x] 2.3 Run backend gates — green.

- [x] **Task 3: Frontend — data layer** (credits service + query keys + CSV builder; ACs: ledger API pagination, CSV export; AD-21 discipline, Dev Notes D2/D5)
  - [x] 3.1 RED: `frontend/src/__tests__/credits-service.test.ts` — NEW — (the axios-stub pattern: `(service as any).client.get = vi.fn()`):
    - `ledger(1)` GETs `/credits/ledger/` with `{params: {page: 1}}` and returns the typed `LedgerResult`.
    - `ledger(3)` passes page 3.
    - `LedgerRow` type pinned to the backend exact-keys (`id, event_type, amount, balance_after, reference_id, created_at`); `LedgerResult = {results, total, page, truncated}`.
  - [x] 3.2 RED: `frontend/src/__tests__/query-keys-credits.test.ts` — NEW — `creditsKeys` factory: `all`, `ledger(userKey, page)` (the user-scoped lesson — 3.6/3.7 cross-user cache isolation), `banner(userKey)`.
  - [x] 3.3 RED: `frontend/src/__tests__/credits-csv.test.ts` — NEW — pure-function tests for `buildCreditsCsv` (no DOM):
    - **localized headers ×3**: headers = type/amount/timestamp/balance-after/reference in EN/FR/AR (the CSV locale param).
    - **row mapping**: a LedgerRow renders: type = the LOCALIZED label (mapped from the raw code — the FE-owns-localization contract D2; unknown code → the raw code as fallback, the RevealControl size_band pattern), amount signed (`+15` for grants, `-1` for debits — ASCII hyphen-minus), timestamp ISO-8601 (locale-independent, Excel-sortable — D5), balance-after, reference (empty → blank).
    - **Western numerals**: no Arabic-Indic digits in any locale output (`String()` interpolation — the 3.4 AD-8 lesson).
    - **RFC-4180 escaping**: a reference/description containing `,`, `"`, or newline is quoted + doubled quotes (hand-rolled — ZERO new deps, D5).
    - **UTF-8 BOM**: output starts with `\uFEFF` (Excel + Arabic — D5).
    - **empty ledger** → headers only (the AC literal).
    - **column order stable** for the CSV (type, amount, timestamp, balance_after, reference — FR-2 underlying-column-order rule, D5).
  - [x] 3.4 RED: `frontend/src/__tests__/credits-hooks.test.tsx` — NEW — (renderHook + QueryClientProvider; mock `@/lib/api/credits-service` + the session):
    - `useCreditsLedger({user, page})`: enabled-gated on `user !== null` (disabled → idle phase, no fetch); success → `{rows, phase: 'success'}`; error → `phase: 'error'`; page change → new query key (`creditsKeys.ledger(userKey, page)` — page is part of the key, D2).
    - `useCreditsBanner({user})`: GET gated on user; `phase` derivation (idle/loading/error/success — the useChecklist 4-state pattern).
    - `useCreditsBannerMutations()`: `dismiss` PUTs `{'dismissed': True}` and invalidates `creditsKeys.all` (the useChecklistMutations pattern).
  - [x] 3.5 GREEN:
    - `frontend/src/lib/api/credits-service.ts` — NEW — `LedgerRow` / `LedgerResult` types + `CreditsService extends HttpClient` with `ledger(page: number): Promise<LedgerResult>` → `this.client.get('/credits/ledger/', {params: {page}})`; singleton `creditsService`. ALSO owns the banner calls (`getBanner` → `GET /search/credits-banner/`, `dismissBanner` → strict `PUT {dismissed: true}`) — one credits service file per the File List.
    - `frontend/src/lib/queryKeys/credits.ts` — NEW — `creditsKeys = { all: ['credits'], ledger: (userKey, page) => ['credits','ledger',userKey,page], banner: (userKey) => ['credits','banner',userKey] }`.
    - `frontend/src/lib/credits/csv.ts` — NEW — `buildCreditsCsv(rows: LedgerRow[], labels: CreditsCsvLabels): string` (pure — BOM + localized header row + RFC-4180 escaping + Western numerals; the labels object carries the translated headers + type labels so the builder stays locale-agnostic and testable — the story draft's `(rows, locale)` signature was refined during GREEN to inject labels); `ledgerTypeLabelKey` helper; `downloadCreditsCsv(content, filename)` (Blob + `URL.createObjectURL` + anchor click — the download seam; NO new dependency).
    - `frontend/src/hooks/useCreditsLedger.ts` — NEW — `useCreditsLedger({user, page})` returns `{rows, total, page, truncated, phase, isFetching, refetch}`; `useQuery({queryKey: creditsKeys.ledger(userKey, page), queryFn: () => creditsService.ledger(page), enabled: user !== null})`; phase derivation (idle when disabled / loading / error / success — AD-21 explicit states; NO placeholderData).
    - `frontend/src/hooks/useCreditsBanner.ts` — NEW — `useCreditsBanner({user})` → `{dismissed, phase}` via `useQuery({queryKey: creditsKeys.banner(userKey), ...})` (the useChecklist shape).
    - `frontend/src/hooks/useCreditsBannerMutations.ts` — NEW — `useCreditsBannerMutations()` → `{dismiss: {mutate, mutateAsync, isPending}}` (the useChecklistMutations pattern; `onSuccess` → `invalidateQueries({queryKey: creditsKeys.all})`).
  - [x] 3.6 Run frontend gates — green.

- [x] **Task 4: Frontend — Credits Pill** (ACs: pill anatomy, warning/zero states, live updates, announcement, /credits navigation; D1/D3/D6; the 4.2 test update)
  - [x] 4.1 RED: `frontend/src/__tests__/credits-pill.test.tsx` — NEW — (renderHeader-style harness: SessionProvider-mock + CreditProvider + ToastProvider + QueryClientProvider; the header.test.tsx mock pattern — verify how header.test mocks useSession before writing):
    - **guest** → renders nothing (the guest/loading-unchanged contract, D1).
    - **authenticated default** (balance 15, tier free): a pill link (`href="/credits"`), `rounded-full` + `h-7` (28px — `md:h-7`) + `bg-muted` + `text-foreground` classes (token assert — the checklist-card shell-test precedent), balance in `text-data` + `tabular-nums`, a lucide coin icon (`aria-hidden`) preceding the balance, `aria-label` = "X credits remaining" (Western numerals via `String()` — the AD-8 rule), NO alert-triangle, NO tooltip.
    - **warning state** (balance 10, tier starter): `bg-warning-container` + `text-warning-on-container` + persistent `alert-triangle` icon beside the balance + tooltip with "Low credits — top up soon" (the saved-searches cap tooltip precedent — `TooltipTrigger`/`TooltipContent`); balance 11 starter → default tones; balance 5 tier FREE → default tones (PAID-only — D3).
    - **zero state** (balance 0, any tier): `bg-danger-container` + `text-danger-on-container`; click → recovery STUB (toast with the no-credits message — D3; assert via the toast container), NO navigation; the pill stays focusable (the disabled-but-actionable primitive).
    - **announcement**: starting balance 5 → change to 4 (via `applyCreditDelta(-1)`) → the pill's sr-only `role="status"` span announces "Balance updated — {balance} credits remaining" with Western numerals (`common.credits.updated`, `String()` interpolation); NO announcement on mount (prevBalance null guard — D3); an INCREASE (+1) → NO announcement (decrease-only — D3); a second change 4→3 announces again.
    - **click navigates**: click on the default pill → `href="/credits"` link (assert the anchor, not router).
    - **RTL smoke**: no physical-property classes (`left-`/`right-`/`ml-`/`mr-`/`text-left`/`text-right`) in the pill markup.
  - [x] 4.2 RED: `frontend/src/__tests__/results-table.test.tsx` — UPDATE — the "announces the credit change through the polite toast on success" test (line ~549): the success toast is REMOVED (D3 — the pill owns the announcement); assert the toast region is ABSENT after a successful reveal (`queryByRole('status')` null + `queryByText('search.reveal.deducted')` null — wait for the confirmed balance first); the failure test (line ~559) UNCHANGED (the failure toast stays — D3).
  - [x] 4.3 RED: `frontend/src/__tests__/i18n-shape.test.ts` — UPDATE — the reveal block drops `deducted`; new `common.credits.*` block: every key the pill/ledger/banner render is truthy in all three locales; `credits.updated` contains `{balance}`; `credits.banner_welcome` contains `{count}`; the type keys are interpolation-free.
  - [x] 4.4 GREEN:
    - `frontend/src/components/layout/CreditsPill.tsx` — NEW — reads `useCredits().balance` + `useSession().user`; renders `null` for guest/loading (D1); states: `balance === 0` → danger tones + recovery-stub click (toast `common.credits.no_credits` + preventDefault — no navigation); `0 < balance <= 10 && user.tier === 'starter'` → warning tones + `alert-triangle` + tooltip; else default tones. Anatomy: `Link href="/credits"` (locale-aware — the search-page `Link` usage), `rounded-full` + `md:h-7` + `min-h-11` (28px desktop / 44px mobile touch floor — review finding 17 reconciliation) + `px-3` + `inline-flex items-center gap-1.5` + `bg-* text-*` per state + `transition-colors duration-200 motion-reduce:transition-none` (≤200ms color transition; number NEVER animates — D1) + `focus-visible:ring-2 focus-visible:ring-ring`; lucide `Coins` icon (`size-4`, `aria-hidden`) + balance `<span className="text-data font-semibold tabular-nums">{String(balance)}</span>` (AD-8); `aria-label` = `t('common.credits.remaining', {count: String(balance)})`; always-mounted sr-only `role="status"` span (`data-testid="pill-announcer"`) driven by a `prevBalanceRef` effect keyed on `balance` ONLY (a `useTranslations` fn from the test mock changes identity per render — keying the effect on it re-ran the diff and cleared the announcement; the text is computed in render, the effect only flips an `announceDecrease` boolean): on `balance < prevBalance.current` (decrease only, `prevBalance.current !== null`) set the flag, else clear it; the sr-only span renders `t('common.credits.updated', {balance: String(balance)})` when flagged (Sally's always-mounted rule D3); tooltip wraps the warning state only (the `TooltipTrigger render={<span/>}` pattern — RevealControl zero-credit precedent).
    - `frontend/src/components/layout/Header.tsx` — UPDATE — replace the plain credits `<Link href="/credits">` (line 34-36) with `<CreditsPill />` (D1); `common.nav.credits` key stays in messages (no dead-key gate — John Q4) but the Header no longer renders it.
    - `frontend/src/components/search/RevealControl.tsx` — UPDATE — remove the success toast block (`search.reveal.deducted` + the `.then` toast — D3): `handleClick` keeps the in-flight guard + zero-credit stub + the `.catch(() => toast('search.reveal.failed'))`; the `mutateAsync` `.then` no longer toasts.
    - `frontend/messages/en.json` / `fr.json` / `ar.json` — UPDATE — remove `search.reveal.deducted`; add `common.credits.*` (Task 7 owns the full key set; the pill-relevant subset here: `updated`, `remaining` already exists, `no_credits`).
  - [x] 4.5 Run frontend gates — green.

- [x] **Task 5: Frontend — `/credits` page** (ACs: ledger page rows/pagination/CSV, empty state; D2/D5; the search-page pattern)
  - [x] 5.1 RED: `frontend/src/__tests__/credits-page.test.tsx` — NEW — (renderPage-style harness: SessionProvider-mock + QueryClientProvider + mock `@/lib/api/credits-service`; the search-page-checklist.test.tsx renderPage precedent):
    - **guest** → the page shows a sign-in prompt (no fetch — enabled gate) with a login link (the auth-guard pattern D2).
    - **loading** → skeleton/loading state (`aria-busy`).
    - **error** → inline error + retry button (the search-page error pattern).
    - **data**: a 3-row ledger → table with the five columns in AC order (type localized / amount signed `tabular-nums` / timestamp / balance-after `tabular-nums` / reference); each type code renders its localized label; `data-testid="ledger-table"`.
    - **pagination**: 55 total → "Page 1 of 2"-style nav, prev disabled on page 1, next advances (page 2 → 5 rows; the search-page pagination pattern with `ChevronLeftIcon/ChevronRightIcon` + `rtl:rotate-180`); the query key changes with page.
    - **CSV button**: present; click → `downloadCreditsCsv` invoked with the FULL window rows (the service mock returns multi-page data; assert the CSV fetches ALL pages — page 1 + page 2, D5) and localized headers; empty ledger → button still present and exports headers-only.
    - **empty state**: 0 rows → "No credit activity in the last 90 days" + a `/search` link + the CSV button still offered (the AC literal).
    - **RTL smoke**: no physical-property classes in the page markup.
  - [x] 5.2 GREEN:
    - `frontend/src/app/[locale]/credits/page.tsx` — NEW — server page: `generateMetadata` (`getTranslations` namespace `common.credits` — the ledger title) + `setRequestLocale(locale)` + renders `<CreditsPage />`.
    - `frontend/src/components/credits/CreditsPage.tsx` — NEW — client page: `const { user } = useSession()`; guest → sign-in prompt (Link to `/login`); `useCreditsLedger({user, page})` + local page state (default 1); states: loading (`aria-busy` + loading line), error (retry), empty (message + `/search` Link + CSV button), data (table + pagination + CSV button). Table anatomy per DESIGN.md results-table (header `text-small` 600 `text-muted-foreground`, rows with `border-b border-border`, hover `bg-muted`); columns: type (localized via the labels map — unknown code → raw, the size_band fallback pattern), amount (`{amount > 0 ? '+' : ''}{amount}` `tabular-nums` — ASCII hyphen-minus, D5), timestamp (`Intl.DateTimeFormat(locale + '-u-nu-latn', {dateStyle:'medium', timeStyle:'short'})` — Western numerals forced, D5; `<bdi>` around the formatted value — the bidi-isolation rule), balance-after (`tabular-nums`), reference (`font-mono text-caption`, empty → `—`). CSV button in a header row above the table (lucide `Download`, `min-h-11 md:h-8`, focus ring); on click: `setExporting(true)`, fetch ALL pages (`for page = 1; ; page++` with a last-page break: `result.results.length < PAGE_SIZE || allRows.length >= result.total` — belt-and-braces against a ledger that shrank between pages, D5), `downloadCreditsCsv(buildCreditsCsv(allRows, csvLabels), 'credits-90-days.csv')`, `setExporting(false)`; button label flips to the exporting key while busy; failure → inline `role="alert"` export error (no toast — the no-global-toast rule, AD-21). `useLocale()` for the timestamp formatter; the CSV labels built from `useTranslations` (the labels-injected builder — Task 3).
  - [x] 5.3 Run frontend gates — green.

- [x] **Task 6: Frontend — 15-credit welcome banner** (deferred-work 3.7 entry (a); D4; the DOM-order pin)
  - [x] 6.1 RED: `frontend/src/__tests__/credits-banner.test.tsx` — NEW — (the checklist-card.test.tsx harness + SearchPage-level render where needed):
    - **hidden for guests** (no user → render nothing).
    - **hidden for Starter** (tier starter, balance 15 → render nothing — free-only trigger, John Q3/D4).
    - **hidden at 0 balance** (free tier, balance 0 → render nothing).
    - **visible for free tier with balance** (free + 15 → the strip renders with "{count} credits left" — LIVE balance `String(balance)`, Western numerals; `bg-info-container` + `text-info-on-container`, `rounded-md`, a lucide `Gift` icon at inline-start — D4).
    - **hidden when dismissed** (banner GET returns `dismissed: true` → render nothing).
    - **dismiss** (X click → `dismiss.mutate` called → after invalidation lands, the banner unmounts — the checklist-card dismissal test pattern; the `getBanner` mock flips to `{dismissed: true}` for the invalidation refetch).
    - **balance drop without reload**: balance 15 → 12 → the count text re-renders (live balance, never a stale "15" — John Q3/D4; asserted via a param-capturing `next-intl` mock: `common.credits.banner_welcome({"count":"12"})`).
  - [x] 6.2 RED: `frontend/src/__tests__/search-page-checklist.test.tsx` — UPDATE — the "renders the card as the first child of the results section" test (line ~98): the banner is now the FIRST child of `#results` and the card the SECOND (the deferred-work 3.7 DOM-order pin — "banner slots before #results's first child"; the test asserts both `data-testid="credits-banner"` then `data-testid="checklist-card"`); the harness gains the `CreditProvider` wrapper + a `credits-service` mock (`getBanner` → `{dismissed: false}` — the banner's dismissal query must not hit the real API).
  - [x] 6.3 GREEN:
    - `frontend/src/components/search/CreditsWelcomeBanner.tsx` — NEW — props none (self-contained: `useSession()` for tier, `useCredits().balance`, `useCreditsBanner({user})` + `useCreditsBannerMutations()`); render `null` unless `user !== null && user.tier === 'free' && (balance ?? 0) > 0 && dismissed !== true`; anatomy: NO `role="status"` (static mount — no announcement on every /search visit, D4), `bg-info-container text-info-on-container rounded-md px-4 py-2`, `flex items-center gap-2`, lucide `Gift` (`size-4`, `aria-hidden`), message `t('common.credits.banner_welcome', {count: String(balance)})`, dismiss button (lucide `X`, `aria-label` from `common.actions.close`, `min-h-11 min-w-11` — the 44px floor) calling `dismiss.mutate()`; `data-testid="credits-banner"`.
    - `frontend/src/components/search/SearchPage.tsx` — UPDATE — inside `<section id="results">`, render `<CreditsWelcomeBanner />` BEFORE `<ChecklistCard onStepComplete={...} />` (the deferred-work contract — banner slots immediately ABOVE the card; the 3.7 DOM-order test updated in 6.2 pins both).
  - [x] 6.4 Run frontend gates — green.

- [x] **Task 7: i18n — `common.credits.*` keys ×3** (AC microcopy; the check-i18n parity gate; John's pinned copy)
  - [x] 7.1 RED/GREEN: `frontend/messages/en.json` + `fr.json` + `ar.json` — UPDATE — add under the existing `common.credits` block (the 1.x keys `label`/`remaining`/`buy`/`zero`/`warning`/`ledger` stay):
    - `updated`: "Balance updated — {balance} credits remaining" / "Solde mis à jour — {balance} crédits restants" / "تم تحديث الرصيد — {balance} نقطة متبقية" (the pill announcement — `String(balance)` interpolation rule; the truthful 4.2-review wording).
    - `no_credits`: "No credits remaining" / "Aucun crédit restant" / "لا رصيد متبقي" (the zero-state recovery-stub toast, D3).
    - `low_tooltip`: "Low credits — top up soon" / "Crédits faibles — rechargez bientôt" / "الرصيد منخفض — أعد الشحن قريبًا" (the AC-literal tooltip — do NOT reuse the old `warning` key, John Q5).
    - `export`: "Export CSV" / "Exporter CSV" / "تصدير CSV" (the CSV button).
    - `exporting`: "Exporting…" / "Exportation…" / "جارٍ التصدير…" (the busy label).
    - `empty`: "No credit activity in the last 90 days" / "Aucune activité de crédit au cours des 90 derniers jours" / "لا توجد حركة رصيد خلال آخر 90 يومًا" (the AC-literal empty note).
    - `empty_cta`: "Go to search" / "Aller à la recherche" / "انتقل إلى البحث" (the action-labeled /search link — John Q2).
    - `column_type` / `column_amount` / `column_date` / `column_balance_after` / `column_reference`: "Type" / "Amount" / "Date" / "Balance after" / "Reference" + fr/ar (the ledger headers — CSV header labels reuse these, D5).
    - `type_free_signup` "Signup credits" / `type_subscription_grant` "Monthly subscription" / `type_pack_grant` "Credit pack purchase" / `type_promotional_grant` "Promotional credits" / `type_reveal_debit` "Reveal" / `type_export_row_debit` "Export" / `type_expiry` "Credits expired" + fr/ar (the seven AC types).
    - `banner_welcome`: "{count} credits left" / "{count} crédits restants" / "متبقي {count} رصيدًا" (the banner — `{count}` = live balance, Western numerals; EXPERIENCE.md line 90 template).
    - `guest`: "Sign in to view your credit history" / "Connectez-vous pour voir votre historique de crédits" / "سجّل الدخول لعرض سجل الرصيد" (the /credits guest prompt).
    - `pagination`: "Page {current} of {total}" / "Page {current} sur {total}" / "الصفحة {current} من {total}" (the ledger pagination aria-label).
    - Remove `search.reveal.deducted` from all three locales (moved to `common.credits.updated` — D3).
  - [x] 7.2 GREEN: `frontend/src/__tests__/i18n-shape.test.ts` — UPDATE — the `common.credits.*` shape block (parity by construction + shape pin; `updated`/`banner_welcome`/`pagination`/`remaining` carry their interpolation params; the type keys + plain keys are interpolation-free); the reveal block drops `deducted`.
  - [x] 7.3 Run frontend gates — green (check:i18n must pass — every key in all 3 locales).

- [x] **Task 8: Full regression + real-stack verification** (the 4.2 Task 7 precedent)
  - [x] 8.1 Full gates: backend `pytest` (all apps) + `ruff` + `mypy` strict; frontend `vitest run` + `lint` + `typecheck` + `check:i18n` — ALL green (backend 533 / ruff 0 / mypy 0; frontend 581 / lint 0 / typecheck 0 / check:i18n ✓).
  - [x] 8.2 Real-stack E2E (docker PG16 — the 4.2 stack): `makemigrations --check` clean; `migrate` applied accounts-0004 on the live DB; URL-namespace collision fixed (`include(('apps.credits.urls', 'credits'), namespace='credits')` + `namespace='credits-reveal'` — the double include of the same app_name produced the `urls.W005` warning, resolved with explicit namespaces; `manage.py check` clean); live flows verified via curl: signup+verify → `GET /api/credits/ledger/` (200 `{results, total: 4, page: 1, truncated: False}` — the 95-day-backdated promotional row EXCLUDED, newest-first order pack_grant → reveal_debit → subscription_grant → free_signup, `reference_id` passthrough) → `?page=0` (400 `invalid_payload`) → `?page=abc` (400) → banner GET (false) → banner PUT strict (true) → banner re-GET (true) → anonymous ledger (401) → frozen user ledger (401 `account_deleted`); E2E rows cleaned.
  - [x] 8.3 NFR-1 headroom note: the ledger endpoint is ONE GET with ≤3 indexed statements (count + page slice on the `credit_ledger_user_created_idx` composite index); the /credits page fetches 1 page on mount (the CSV export fetches all pages on demand only — never on mount); the pill/announcement are pure client-state (no refetch) — recorded in Dev Notes.

## Dev Notes

- **Source of truth — the planning spec**: `_bmad-output/planning-artifacts/epics/epic-04-reveal-credit-export/story-03-credits-pill-ledger.md` (all ACs verbatim). FR-15/FR-16 in `_bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L139-153`. UX: `DESIGN.md#L325` (credits-pill component spec), `DESIGN.md#L107-113` (credits-pill token block), `DESIGN.md#L336` (banner info variant), `EXPERIENCE.md#L119` (pill behavioral rules), `EXPERIENCE.md#L150-154` (state rows: low-credit paid-only / 0-credit / ledger-window-empty), `EXPERIENCE.md#L90` (15-credits banner microcopy), review-accessibility finding 24 (persistent warning icon) + 17 (touch-target floor) + 16 (tooltip reachability). Mockup: `ux-designs/.../mockups/reveal-zero-credit.html` (pill zero state: coin + number, danger-container tones, Western numerals).
- **CRITICAL CONTRACTS (recorded for the review — MUST be honored verbatim):**
  - **D1 — the 4.2 CreditProvider contract** (4-2 Dev Notes D4 + credit-provider tests): the pill renders from `useCredits()` → `{balance, applyCreditDelta, applyConfirmedBalance}`; 4.3 wires ONLY rendering, warning/zero tones, announcement and /credits navigation — do NOT change the provider's balance semantics (the 4.2 tests pin them). The pill NEVER reads `SessionUser.credits_balance` directly (AD-12 — the provider's balance IS the session seed; the contract's "read the provider's balance, never compute from SessionUser.credits_balance" is satisfied by construction: the pill consumes only `useCredits().balance`).
  - **D2 — the ledger API contract** (spine `GET /api/credits/ledger/`): authenticated (default IsAuthenticated + CookieJWTAuthentication); 90-day window (`created_at >= now - 90 days`); newest first (model Meta ordering); paginated (50/page — pinned in tests); response mirrors the search result shape `{results, total, page, truncated}` — `truncated` is always `False` (the 90-day window IS the complete set; no navigable cap exists, unlike the search 1,000-row cap — the key is kept for shape parity per the user's explicit contract, the search-shape mirror); RAW `event_type` codes (localization on the FRONTEND — the search-row raw-code precedent); ISO-8601 `created_at`; row shape exactly `{id, event_type, amount, balance_after, reference_id, created_at}` (description omitted — ops field, not in the AC display); 401 anonymous; frozen users 401 at the auth layer (`account_deleted` — 4.2 D6, NO view-level check); PURE READ — never in `transaction.atomic()`, no lock, no write. Page parse: strict int ≥1, default 1, invalid → 400 `invalid_payload`; out-of-range page → 200 empty results (NO search-style 400 — no navigable cap).
  - **D3 — announcement dedupe** (4-2 Review Findings P12): the pill OWNS the aria-live announcement → REMOVE the 4.2 success toast from RevealControl (update the 4.2 test "announces the credit change through the polite toast" — Task 4.2); keeping both = double announcement, rejected. The failure toast (`search.reveal.failed`) STAYS. The pill announces via an always-mounted sr-only `role="status"` span; detection = effect diffing `balance` against a `prevBalanceRef`; announce ONLY on DECREASE (the AC's "deducts credits → the change is announced" is decrease-scoped; a +1 rollback must NOT announce — the failure toast already explains "credits restored"; announcing the rollback would triple-announce on failure: -1 announce + +1 announce + failure toast); skip while `prevBalance.current === null` (mount/guest — never announce the initial render); `String(balance)` interpolation (the 3.4 AD-8 numeral lesson — next-intl would render Arabic-Indic digits in AR).
  - **D4 — the 15-credit welcome banner** (deferred-work.md 3.7 entry (a)): 4.3 IS the credit-surfaces story — banner INCLUDED (Winston/Sally/John all resolve: include; recorded in the Change Log). Hand-rolled info strip, slotted as the FIRST child of `#results`, immediately ABOVE the checklist card (the 3.7 DOM-order test is updated in Task 6.2 to pin banner-before-card). Trigger: `user.tier === 'free'` AND `balance > 0` AND not dismissed (PM: free-only — a Starter's balance is subscription-metred, the banner is the free-grant welcome; UJ-1 pins it to the first-run moment). Copy: "{count} credits left" with the LIVE balance (never a stale "15" — a reveal before dismissal must not lie, John Q3). Dismissible (X) + PERSISTED per user (the 3.7 checklist dismissal precedent: `users.credits_banner_dismissed_at` + strict PUT `{'dismissed': True}` + `creditsKeys` invalidation). No `role="status"` on the banner (static mount — announcing on every /search visit would spam the polite region). The 0-credit /search danger banner is NOT in 4.3's ACs — recorded handoff to the 5.x dialog story (John Q3 flag).
  - **D5 — CSV export**: client-side, hand-rolled, ZERO new dependencies (the skill halts on unapproved deps); localized headers (FR-3 — the header labels reuse the ledger column keys); Western numerals everywhere (`String()`); RFC-4180 escaping (quote + double-quote fields containing `,`/`"`/newline); UTF-8 BOM (`\uFEFF` — Excel + Arabic); EMPTY ledger → headers only (the AC literal); stable column order (type, amount, timestamp, balance_after, reference — FR-2's underlying-column-order rule); the export fetches ALL pages of the 90-day window (completeness — the paged API alone would under-export; the fetch loop is on-demand, never on mount); 4.6 may absorb the infra (recorded handoff — the user's explicit note). Winston's backend-endpoint recommendation was considered and REJECTED per the user's explicit client-side contract (recorded in the Change Log).
  - **D6 — AD-8 / FR-15 display rules**: `{typography.data}` (`text-data`) + `tabular-nums`; Western Arabic numerals in every locale (`String()` for all interpolations — the 3.4 lesson); the number NEVER animates (only `transition-colors`, ≤200ms, with `motion-reduce:transition-none` — review finding 17's reduced-motion rule); coin icon (lucide `Coins`, `aria-hidden`); `{rounded.full}`, 28px height (desktop; `<md` inflates the touch target to ≥44px via `min-h-11` while the visual height is preserved — the review finding 17 reconciliation rule), `{colors.muted}/{colors.foreground}` default (DESIGN.md #L325).
  - **D7 — scope decisions**: the pill REPLACES the plain credits link at Header.tsx:34 (click → /credits; guest/loading unchanged — renders nothing); the announcement is a dedicated polite region in the pill (`role="status"` sr-only span); ledger page size 50/page pinned in tests; `/credits` minimal scope = ledger table + pagination + CSV button + empty state (NO balance-summary header — the AC does not require it; the pill IS the balance surface, John Q4); NO mount-time balance refetch (the provider is authoritative — its seed comes from the session `/me` probe; a refetch would fight the 4.2 confirmed-balance contract and add a waterfall — the ledger page shows its own data, the pill stays provider-driven); `/credits` = a new authenticated page under `frontend/src/app/[locale]/credits/page.tsx` following the `/search` page pattern (server page + client component; guest → sign-in prompt, the auth-guard pattern).
- **Prior-story contracts this story closes**: 4.2 (D4 — pill state-level satisfaction; D8 — the announcement handoff, resolved by D3 above; D9 — the recovery-dialog stub precedent, reused by the pill's zero state); 3.7 (`deferred-work.md` entry (a) — the banner DOM-order contract; the checklist dismissal precedent Task 2); 3.4 (the AD-8 `String()` interpolation lesson); 4.1 (the ledger model + index `credit_ledger_user_created_idx` — the endpoint is a pure read on it).
- **Out of scope (handoff)**: the recovery/upgrade dialogs = Epic 5 (D3/D7 — the pill's zero-state click fires the stub toast; 5.x wires the real dialog); the 0-credit /search danger banner = 5.x dialog story (D4); CSV infra consolidation = 4.6 (D5); ledger `description` field display = not in the AC (D2).
- **NFR-1 (≤1.5s p95 on 4G)**: the ledger endpoint is ONE GET with ≤3 indexed statements (count + page slice on the composite index); the /credits mount fetches exactly 1 page; the CSV export's all-pages loop is user-triggered only. Not CI-testable — recorded as design headroom.
- **Testing standards**: backend — pytest + `django_db`, the conftest `create_user`/`api_client` pair + the `test_reveal_api.py` session-fixture pattern, the strict-parse + exact-keys precedents; gates = `pytest` + `ruff` + `mypy` (strict). Frontend — vitest + jsdom, service modules mocked via `vi.hoisted`/`vi.mock` (never fetch), error objects shaped `{response: {status, data: {code}}}`; `useTranslations` returns keys verbatim (assert keys, never values); gates = `vitest run` + `lint` + `typecheck` + `check:i18n`. Run ALL gates after EVERY task.

## Dev Agent Record

### Agent Model Used

opencode-go/deepseek-v4-flash

### Debug Log References

- RED runs: test_ledger_api.py (17 failed — no endpoint), test_credits_banner.py (13 failed — no field/view), credits-service/query-keys-credits/credits-csv/credits-hooks suites (4 failed — missing modules), credits-pill (17 failed — missing component), credits-page (10 failed — missing component), credits-banner (8 failed — missing component), results-table success-toast test (1 failed), search-page-checklist DOM-order test (1 failed).
- GREEN fixes during implementation: the ledger `?page=` empty-string case was revised during RED to 400 (the search `parse_page` precedent raises on `int('')` — the story draft's "empty defaults to 1" was corrected); ruff E501 + mypy strict on the ledger test file (long signatures → `_Grant` alias + multi-line defs); the double `include('apps.credits.urls')` produced the `urls.W005` namespace collision on the live stack — resolved with explicit namespaces (`namespace='credits'` / `namespace='credits-reveal'`, the 2-tuple app_name form); the CreditsPill announcement effect keyed on `[balance, t]` re-ran on every render (the test mock's `useTranslations` returns a fresh fn per call) and cleared the announcement — re-keyed on `[balance]` only with an `announceDecrease` boolean + render-time text; the credits-page CSV export loop terminates on `results.length < PAGE_SIZE || allRows.length >= total` (belt-and-braces against a ledger that shrank between pages); the credits-page test harness needed `mockResolvedValueOnce` ×2 for the export loop (the mount fetch consumes one value); the banner suite overrides the global `next-intl` mock with a param-capturing translator to assert the LIVE `{count}` interpolation.
- E2E (docker PG16, live stack): seeded verified user; verified via shell; ledger 200 (4 rows in window, 95-day row excluded, newest-first, reference passthrough); page=0/page=abc → 400 invalid_payload; banner GET false → PUT true → re-GET true; anonymous 401; frozen 401 account_deleted; E2E rows cleaned. `manage.py check` clean after the namespace fix.

### Completion Notes List

- Story 4.3 implemented end-to-end (TDD red→green for every task): backend `GET /api/credits/ledger/` (CreditsLedgerView — 90-day window, newest-first, 50/page, strict page parse, `{results, total, page, truncated}` search-shape mirror, RAW event codes, pure read) + the 15-credit banner dismissal (users.credits_banner_dismissed_at + strict GET/PUT CreditsBannerView — the 3.7 checklist precedent); frontend data layer (CreditsService ledger/getBanner/dismissBanner + creditsKeys factory + labels-injected CSV builder with BOM/RFC-4180/Western numerals + useCreditsLedger/useCreditsBanner/useCreditsBannerMutations hooks); CreditsPill (default/warning/zero tones, persistent alert-triangle + tooltip, recovery-stub click, decrease-only sr-only announcement, /credits navigation) replacing the Header plain link; RevealControl success toast REMOVED (the pill owns the announcement — 4.2 P12 dedupe); /credits page (guest/loading/error/empty/data states, 5-column ledger table, pagination, full-window CSV export); CreditsWelcomeBanner (free-tier + balance>0 + not-dismissed, live count, persisted dismissal) slotted ABOVE the checklist card; i18n common.credits.* ×3 (search.reveal.deducted moved to common.credits.updated).
- Gates: backend 533 pytest / ruff 0 / mypy strict 0; frontend 581 vitest / lint 0 / typecheck 0 / check:i18n ✓ (457 keys ×3). Real-stack PG16 E2E verified (window filter, ordering, strict page parsing, banner persistence, 401 anonymous + frozen).

### File List

- `backend/apps/credits/views.py` (MODIFIED — CreditsLedgerView + _parse_page)
- `backend/apps/credits/services.py` (MODIFIED — LEDGER_WINDOW_DAYS, LEDGER_PAGE_SIZE)
- `backend/apps/credits/urls.py` (MODIFIED — ledger path)
- `backend/apps/credits/tests/test_ledger_api.py` (NEW — 17 tests)
- `backend/apps/accounts/models.py` (MODIFIED — credits_banner_dismissed_at)
- `backend/apps/accounts/migrations/0004_credits_banner_dismissed_at.py` (NEW)
- `backend/apps/accounts/tests/test_credits_banner.py` (NEW — 13 tests)
- `backend/apps/search/views.py` (MODIFIED — CreditsBannerView)
- `backend/apps/search/urls.py` (MODIFIED — credits-banner path)
- `backend/config/urls.py` (MODIFIED — api/credits include + explicit namespaces)
- `frontend/src/lib/api/credits-service.ts` (NEW)
- `frontend/src/lib/queryKeys/credits.ts` (NEW)
- `frontend/src/lib/credits/csv.ts` (NEW)
- `frontend/src/hooks/useCreditsLedger.ts` (NEW)
- `frontend/src/hooks/useCreditsBanner.ts` (NEW)
- `frontend/src/hooks/useCreditsBannerMutations.ts` (NEW)
- `frontend/src/components/layout/CreditsPill.tsx` (NEW)
- `frontend/src/components/layout/Header.tsx` (MODIFIED — pill replaces the plain link)
- `frontend/src/components/search/RevealControl.tsx` (MODIFIED — success toast removed)
- `frontend/src/components/search/CreditsWelcomeBanner.tsx` (NEW)
- `frontend/src/components/search/SearchPage.tsx` (MODIFIED — banner slot above the card)
- `frontend/src/components/credits/CreditsPage.tsx` (NEW)
- `frontend/src/app/[locale]/credits/page.tsx` (NEW)
- `frontend/messages/en.json` / `fr.json` / `ar.json` (MODIFIED — common.credits.* added, search.reveal.deducted removed)
- `frontend/src/__tests__/credits-service.test.ts` (NEW)
- `frontend/src/__tests__/query-keys-credits.test.ts` (NEW)
- `frontend/src/__tests__/credits-csv.test.ts` (NEW)
- `frontend/src/__tests__/credits-hooks.test.tsx` (NEW)
- `frontend/src/__tests__/credits-pill.test.tsx` (NEW)
- `frontend/src/__tests__/credits-page.test.tsx` (NEW)
- `frontend/src/__tests__/credits-banner.test.tsx` (NEW)
- `frontend/src/__tests__/results-table.test.tsx` (MODIFIED — success-toast test)
- `frontend/src/__tests__/search-page-checklist.test.tsx` (MODIFIED — DOM-order pin + harness)
- `frontend/src/__tests__/i18n-shape.test.ts` (MODIFIED — common.credits block, reveal block drops deducted)

### Change Log

- 2026-08-07: Story created (ready-for-dev) from the epic 4.3 planning spec. Persona consultations recorded (project practice — 3.5/3.7/4.1 precedent):
  - **Winston (architect)** — (Q1) ledger API: `{results, total, page}` offset pagination, 50/page, RAW event codes + ISO-8601 dates, out-of-range page → 200 empty (no navigable cap); RECOMMENDED dropping `truncated` (search-specific cap concept) — OVERRIDDEN by the user's explicit CRITICAL CONTRACT (response must mirror the search shape `{results, total, page, truncated}`); (Q2) RECOMMENDED a thin backend CSV endpoint for data completeness — OVERRIDDEN by the user's explicit client-side hand-rolled zero-dep contract (D5; the client loops ALL pages on demand for completeness); (Q3) 15-credit banner INCLUDED in 4.3; RECOMMENDED non-dismissible (schema cost) — OVERRIDDEN by Sally+John (DESIGN.md info-variant dismissal default + the 3.7 persistence precedent, D4); (Q4) guardrails: frozen users at the auth layer, no `credits_balance` reads, AD-21 key-factory discipline, no reveal-time ledger invalidation (mount-refetch with the default staleTime 0), zero-state stub precedent, `LEDGER_WINDOW_DAYS = 90` single cutoff constant.
  - **Sally (UX)** — (Q1) pill anatomy: lucide `Coins` (`aria-hidden`), `text-data` + `tabular-nums`, `rounded-full` 28px, default muted/foreground, warning-container + persistent `alert-triangle` + tooltip (warning state only), danger-container zero state; aria-label "X credits remaining" (`String(count)`); (Q2) announcement dedupe: pill owns it via an always-mounted sr-only `role="status"` span; success toast removed from RevealControl; failure toast stays; diff-based detection (refined by D3 to decrease-only — avoids the failure triple-announce); (Q3) /credits minimal scope confirmed (table + pagination + CSV + empty, NO balance header); 5 columns in AC order; timestamp via `Intl.DateTimeFormat(locale + '-u-nu-latn')` + `<bdi>`; (Q4) empty state verbatim + `/search` link + headers-only CSV; (Q5) banner: info-container strip, `Gift` icon, live-count copy, dismissible; (Q6) guardrails: 44px mobile floor vs 28px desktop visual, focus ring, `motion-reduce:transition-none`, low-credit note on /credits for paid users (reuses `low_tooltip`).
  - **John (PM)** — (Q1) low-credit warning PAID-ONLY: gate `user?.tier === 'starter'` (strict equality — a future tier must not inherit the warning); balance 0 → danger for ALL tiers; precedence: zero → danger; 0 < balance ≤ 10 AND starter → warning; else default; (Q2) empty copy verbatim + action-labeled "Go to search" link + CSV headers-only still offered; (Q3) banner INCLUDED: free-tier only + balance > 0, dismissible, live-balance copy ("{count} credits left" — never a stale 15); 0-credit /search danger banner deferred to 5.x (not in the 4.3 ACs); (Q4) /credits scope confirmed — no balance header (the pill IS the balance surface); `common.nav.credits` key kept (no dead-key gate); (Q5) copy pinned ×14 (type labels, tooltip, empty state, columns, banner).
- 2026-08-07: Scope decisions recorded (D7): pill replaces Header.tsx:34; announcement = dedicated sr-only region in the pill; 50/page pinned in tests; /credits minimal scope; no mount-time balance refetch (provider authoritative); /credits follows the /search page pattern (server page + client component + guest prompt). Sprint-status 4-3 → ready-for-dev (epic-4 stays in-progress).
- 2026-08-07: Implemented (TDD) — Task 1 ledger endpoint (90-day window / newest-first / 50-page / strict parse / search-shape mirror / raw codes / pure read), Task 2 banner dismissal backend (accounts-0004 + strict GET/PUT), Task 3 data layer (service + keys + CSV builder + 3 hooks), Task 4 CreditsPill (three tones + announcement + recovery stub; RevealControl success toast removed; i18n moved), Task 5 /credits page (guest/loading/error/empty/data + pagination + full-window CSV), Task 6 welcome banner (free-tier trigger + persisted dismissal + DOM-order pin above the checklist card), Task 7 i18n common.credits.* ×3, Task 8 full regression + real-PG16 E2E (window filter, ordering, strict page parsing, banner persistence, 401 anonymous/frozen; urls.W005 namespace collision fixed with explicit namespaces). Gates: backend 533 / ruff 0 / mypy strict 0; frontend 581 / lint 0 / typecheck 0 / check:i18n ✓. Status → review (sprint-status 4-3 → review).

### Review Findings

Code review (full mode — Blind Hunter + Edge Case Hunter + Acceptance Auditor, 2026-08-07). Blind: 3 Medium + 10 Low. Edge: 1 High + 6 Medium + 11 Low. Auditor: 4 Low deviations + 1 informational (no AC violations — all 7 AC blocks SATISFIED, contracts D1–D7 honored). Triage: 12 patch, 5 defer, 10 dismiss. All patches applied; gates re-run green (backend 536 pytest / ruff 0 / mypy strict 0; frontend 588 vitest / lint 0 / typecheck 0 / check:i18n ✓).

- [x] [Review][Patch] Ledger `page` beyond PostgreSQL's signed-64-bit OFFSET range → uncaught OperationalError → 500 (edge High) [backend/apps/credits/views.py] — fixed: `_MAX_LEDGER_PAGE = 1_000_000` cap + digits-only regex (int() silently accepts `+5`, `1_0`, `' 5 '`, `1e3` — the strict-parse contract) → 400 `invalid_payload`. Tests: coercion-leniency + huge-page suites.
- [x] [Review][Patch] Same-instant ledger rows (batch grants, the 4.1 backfill) have no deterministic order → rows can duplicate/skip across page boundaries and in the CSV (blind+edge Medium) [backend/apps/credits/views.py] — fixed: explicit `order_by('-created_at', '-id')` tie-break. Test: same-instant ordering + cross-request stability.
- [x] [Review][Patch] Pill announces a phantom decrease TWICE on a failed reveal: the 4.2 refresh-reconcile re-seeds the provider from a fresh /me probe, and the re-seed reads as a decrease against the previous user's baseline (blind Medium) [frontend/src/components/layout/CreditsPill.tsx] — fixed: the diff effect now keys on `[balance, user]` and resets `prevBalanceRef` on any user-key change (logout/login/re-seed → mount-like, no announcement); also closes the cross-account swap spurious-announce case (edge Low).
- [x] [Review][Patch] Low-credit warning is invisible to screen readers: the alert-triangle is aria-hidden, the aria-label is only "X credits remaining", and the tooltip is unreliable (blind Medium) [CreditsPill.tsx] — fixed: the warning-state aria-label appends the low-credit tooltip text ("X credits remaining — Low credits — top up soon"). Test: accessible-name assertion.
- [x] [Review][Patch] CSV export silently duplicates rows when the ledger mutates mid-export (offset-pagination drift) (blind+edge Medium) [frontend/src/components/credits/CreditsPage.tsx] — fixed: rows dedupe by id across the fetch loop (`seen` set). Test: the full-window export test still passes with dedupe in place (the loop fetches pages 1..N).
- [x] [Review][Patch] `page` state never resets on user change; a second account lands on the previous user's page number and sees a false empty state (blind Medium) [CreditsPage.tsx] — fixed: `useEffect` resets `page` to 1 when `user?.email` changes. Test: cross-account page reset.
- [x] [Review][Patch] 90-day expiry while sitting on page 2 strands the user with a lying "No credit activity" empty state and no way back (blind+edge Medium) [CreditsPage.tsx] — fixed: `rows.length === 0 && page > 1` renders a distinct out-of-range note ("No more credit activity on this page" + "Back to the first page" button — 2 new keys ×3, i18n shape updated). Test: expiry-on-page-2 + recovery.
- [x] [Review][Patch] Banner flashes on first mount before the dismissal state loads, and a transient getBanner error re-shows the banner to users who dismissed (blind+edge Low) [CreditsWelcomeBanner.tsx, useCreditsBanner.ts] — fixed: the banner renders only when `phase === 'success'` (loading and error are indistinguishable from "fresh" — never render on either). Tests: no-flash + error-hidden suites.
- [x] [Review][Patch] `getBanner` fires for Starter users who can never see the banner (blind Low) [useCreditsBanner.ts] — fixed: `enabled: user !== null && user.tier === 'free'`; the Starter test now asserts NO fetch.
- [x] [Review][Patch] Banner dismiss X stays enabled during the pending PUT (double-fire risk) and has no pending guard (blind+edge Low) [CreditsWelcomeBanner.tsx] — fixed: `disabled={dismiss.isPending}`.
- [x] [Review][Patch] Export button busy state is not announced; double-click races the `disabled` flag (blind+edge Low) [CreditsPage.tsx] — fixed: `aria-busy` on the button + a `exportingRef` re-entrancy guard inside `exportCsv` (the disabled flag lands only after the next render).
- [x] [Review][Patch] `URL.revokeObjectURL` runs synchronously after `click()` — can cancel the download in some engines (blind+edge Low) [frontend/src/lib/credits/csv.ts] — fixed: deferred revoke via `setTimeout(..., 0)`; removed the dead `ledgerTypeLabelKey` export (blind Low); removed the unused `creditsKeys` import in the banner test (blind Low).
- [x] [Review][Patch] Unrequested copy change to the existing fr `common.credits.warning` string (em-dash → hyphen) (blind Low + auditor deviation) [frontend/messages/fr.json] — fixed: restored the em-dash; the new FR keys keep the em-dash consistently.
- [x] [Review][Patch] Auditor coverage gaps vs the story's own RED checklist — (a) INCREASE → no announcement test (added: the rollback/restore path asserts the announcer clears and stays silent); (b) zero-state "NO navigation / stays focusable" weakly asserted (the click-preventDefault + href behavior is pinned); (c) "localized headers ×3" only exercised for EN/AR — added an FR labels variant test (headers + type labels) [credits-pill.test.tsx, credits-page.test.tsx, credits-csv.test.ts].
- [x] [Review][Defer] CSV formula-injection cells (leading `=`, `+`, `-`, `@`) not neutralized [csv.ts] — all current cells are server-constrained (UUIDs, ISO timestamps, fixed label set) so no vector is reachable; the builder is the documented 4.6 infrastructure — revisit neutralization with the 4.6 export work (recorded handoff).
- [x] [Review][Defer] Entire 90-day window accumulated in one in-memory string/Blob for extreme users [CreditsPage.tsx, csv.ts] — realistic 90-day volumes (≤ ~1k rows) are trivial; chunked/streamed CSV generation is 4.6 infrastructure scope (recorded handoff).
- [x] [Review][Defer] Export-failure feedback invisible if the session dies mid-export (the error renders only in the authenticated branch) [CreditsPage.tsx] — a logged-out user sees the guest prompt, which is the correct surface; the stale error is moot.
- [x] [Review][Defer] `CreditsBannerView.put` doesn't check the `update()` rowcount (a vanished user row returns 200 with nothing persisted) — mirrors the 3.7 checklist precedent verbatim; the auth layer makes the row-vanishes window unreachable in practice.
- [x] [Review][Defer] Both `api/reveal/` and `api/credits/` mount the same urlpatterns, exposing `POST /api/credits/{type}/{id}/` and `GET /api/reveal/ledger/` as side effects (auditor informational) — sanctioned by the 8.2 namespace fix (the reveal path is a 4.2-pinned contract); both views are same-auth same-data, so the duplication is harmless.
- [x] [Review][Dismissed] Announcement carries the optimistic balance, never the confirmed one (blind Low) — the D3 decrease-diff design announces the displayed value; the confirmed reconcile usually writes the same value (cost 1), and a differing correction re-announces the truth (desirable, Sally Q2).
- [x] [Review][Dismissed] Guests lose the header Credits entry entirely (blind Low) — the pre-4.3 Header rendered the credits link only in the authenticated branch; guests never had it (verified in the 4.2-era Header). No regression.
- [x] [Review][Dismissed] Authenticated session whose `/me` seed lacks `credits_balance` → pill permanently hidden (edge Low) — the session contract always carries `credits_balance` (SessionUser shape + 4.2 credit-provider tests pin it); no fallback needed.
- [x] [Review][Dismissed] `CreditsBannerView.put` bypasses `updated_at` auto_now (blind Low) — the accounts User model has no `updated_at` field (verified in models.py); nothing to bypass.
- [x] [Review][Dismissed] Export loop termination bound to the FE `PAGE_SIZE` constant instead of the server's page size (edge Medium) — `LEDGER_PAGE_SIZE = 50` is a pinned backend contract (tested); the FE mirror is intentional; the dedupe + empty-page breaks make divergence fail safe (truncation only, never duplication or infinite loops).
- [x] [Review][Dismissed] Unbounded fetch loop if the ledger grows ≥50 rows per fetch (edge Medium) — impossible on a finite ledger; every page returns < 50 rows eventually, and the `allRows.length >= total` + empty-page breaks terminate deterministically (the Blind Hunter independently confirmed termination).
- [x] [Review][Dismissed] Cross-user `prevBalanceRef` swap without a null transition (edge Low) — closed by the user-key reset patch above.
- [x] [Review][Dismissed] `getBanner` for guests (edge/banner suite) — the query is `enabled`-gated on `user !== null`; guests report idle without fetching (pinned in the hooks test).

### Change Log (continued)

- 2026-08-07: Code review (full mode — Blind Hunter + Edge Case Hunter + Acceptance Auditor). Blind: 3 Medium + 10 Low. Edge: 1 High + 6 Medium + 11 Low. Auditor: all 7 AC blocks SATISFIED + 4 Low deviations + 1 informational. Triage: 12 patches (int64 page cap + digits-only parse, `-id` tie-break, pill user-key diff reset, warning aria-label, CSV dedupe, page reset on user change, out-of-range empty state, banner phase-gated render, tier-gated banner query, dismiss pending guard, export aria-busy + re-entrancy, deferred URL revoke + dead-code cleanup + fr warning restore + 3 auditor coverage tests), 5 defers (formula injection, memory for extreme windows, mid-export session death, PUT rowcount, URL-surface duplication — all 4.6 handoffs or 3.7-precedent mirrors), 10 dismissals. All gates re-run green (backend 536 / FE 588). Status stays review pending Step 3 close-out.
- 2026-08-07: Review resolved — all patch findings applied, defers recorded in the Review Findings section, gates fully green; Status → done (sprint-status 4-3 → done, epic-4 stays in-progress). Committed as `Story 4.3: ...` (author bensouici akram, no push).
