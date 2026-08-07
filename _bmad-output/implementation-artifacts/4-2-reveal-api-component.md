---
story_id: 4.2
epic: 4
title: Story 4.2 — Reveal API & Component
Status: done
frs: [FR-14]
nfrs: [NFR-1]
ads: [AD-4]
ux_drs: [UX-DR11, UX-DR20, UX-DR21, UX-DR24]
baseline_commit: f345d1e
---

# Story 4.2: Reveal API & Component

Status: done

## Story

As a **user who wants contact details**,
I want **to click "Reveal" on a search result row and see the full contact data expand inline, with 1 credit deducted and my balance updated live**,
So that **I can access the value moment (phone, email, address) without leaving the search results**.

## Acceptance Criteria

**Given** the Reveal Button component in search results
**When** a result row renders with a record that has NOT been revealed
**Then** a 32px button with label "Reveal" + "1 credit" affordance appears
**And** it uses {colors.primary} / {colors.primary-foreground}, {rounded.md}
**And** it has `aria-expanded` and `aria-controls` wired to the contact expansion region

**Given** the user clicks Reveal
**When** the action starts
**Then** a spinner replaces the label, `aria-busy` is set, and the button width is pinned (no row jump)
**And** the UI optimistically expands the row and decrements the Credits Pill by 1

**Given** a successful reveal
**When** the API responds 200
**Then** contact fields (phone, email, address, source link) render inline below the result row
**And** the row stays expanded
**And** the Credits Pill shows the confirmed decremented balance
**And** `aria-live="polite"` announces the credit change

**Given** a failed reveal
**When** the API returns an error
**Then** the row collapses back to its initial state
**And** the Credits Pill balance increments back by 1
**And** a toast explains: "Reveal failed — credits restored"
**And** the button returns to the initial "Reveal" state

**Given** a record already revealed within 30 days
**When** the results row renders
**Then** the contact fields are auto-visible
**And** an "Already revealed" badge is shown: {colors.success-container} / {colors.success-on-container}, {rounded.full}, {typography.caption}
**And** no credit is deducted on re-view

**Given** a user with 0 credits
**When** they view a result row
**Then** the Reveal button renders with `aria-disabled` (stays focusable)
**And** it shows {colors.muted} fill, {colors.muted-strong} label, 1px {colors.border}
**And** a tooltip explains "No credits remaining"
**And** clicking/Enter opens the recovery dialog: Upgrade dialog for free users, top-up packs for Starter users

**Given** the reveal API endpoint
**When** I inspect `POST /api/reveal/{type}/{id}/`
**Then** it validates JWT, checks balance, performs atomic deduction, and returns full contact data or error
**And** it respects the re-reveal idempotency window (≤30d = free)

**Given** performance budget
**When** a reveal is triggered on 4G
**Then** the round-trip completes in ≤1.5s at the 95th percentile

## Tasks / Subtasks

- [x] **Task 1: Backend — `POST /api/reveal/{type}/{id}/` endpoint** (AC: reveal API endpoint; FR-14; the 4.1 deferred-work SERIALIZABLE-composition contract — see Dev Notes D1)
  - [x] 1.1 RED: `backend/apps/credits/tests/test_reveal_api.py` — NEW — module-level `pytestmark = pytest.mark.django_db`; fixtures: the `create_user`/`api_client` conftest pair + local `reveal_session` factory (unique-email user + `email_verified_at` + login via `POST /api/auth/login/` — the `test_saved_search_api.py` `search_session` pattern), a seeded `Person` (name/role/email/phone/address/company/source) + `Company` (name/website/source), and a local `grant(user, amount, pool='subscription')` ledger helper (the 4.1 `test_reveal.py` `user_with` pattern):
    - **anonymous** → 401 (default IsAuthenticated + CookieJWTAuthentication).
    - **happy path people**: user with 3 subscription credits → `POST /api/reveal/people/{person_id}/` → 200; body has `contact` with EXACTLY the 4.1 `_contact_data` people keys (`record_type, record_id, name, role, company_name, email, phone, address`) + `balances` with `subscription_balance, pack_balance, display_balance`; exactly one new ledger row `event_type='reveal_debit'`, `amount=-1`, `pool='subscription'`; one `Reveal` row `was_free=False`; `credits_balance == 2`.
    - **happy path company**: 200; `contact` keys exactly `record_type, record_id, name, industry, website, wilaya_code, size_band`; debit recorded (pool 'subscription').
    - **drawdown subscription-first**: subscription=0 + pack=5 → pool='pack' in the ledger row.
    - **free re-reveal ≤30d**: reveal, then POST again → 200 SAME contact, NO new `reveal_debit` ledger row, one NEW `Reveal` row `was_free=True`, balance unchanged (no double debit — the frontend re-view contract D3).
    - **insufficient credits** → 402, body `code == 'insufficient_credits'` + localized `detail` per `user.locale` (ar/fr/en fixtures — the quota.py trilingual pattern); NO ledger row, NO reveal row, cache unchanged (the atomic-rollback AC — nothing written on failure).
    - **record not found** → 404 `code == 'record_not_found'` (unknown UUID; unparseable id string — the 4.1 canonicalization guard precedent).
    - **invalid record_type** (`POST /api/reveal/fish/{id}/`) → 400 `code == 'invalid_payload'` (strict-whitelist precedent — 3.7 `invalid_payload`).
    - **frozen user policy**: user with `deleted_at`/`deletion_scheduled_at` set → 401 `code == 'account_deleted'` (the auth-layer policy — the 4.1 review-dismissed finding is enforced HERE at the API boundary; no view-level check needed — D6).
    - **balances payload**: after a 3-credit reveal, `balances == {'subscription_balance': 2, 'pack_balance': 0, 'display_balance': 2}` — the confirmed-balance contract the pill consumes (4.3).
  - [x] 1.2 GREEN: `backend/apps/credits/views.py` — NEW — `class RevealView(APIView)` with `post(self, request: Request, record_type: str, record_id: str) -> Response`:
    - whitelist `record_type in ('people', 'company')` → else 400 `{'detail': ..., 'code': 'invalid_payload'}`.
    - **D1 — call `reveal_contact(request.user, record_type, record_id)` DIRECTLY, never inside an outer `transaction.atomic()`** (the 4.1 deferred-work SERIALIZABLE-under-composition contract — an outer atomic block would raise ProgrammingError on PG).
    - catch `InsufficientCreditsError` → 402 `{'detail': <localized>, 'code': 'insufficient_credits'}`; catch `RevealRecordNotFoundError` → 404 `{'detail': ..., 'code': 'record_not_found'}`.
    - success: `contact = reveal_contact(...)` then `balances = user_balances(request.user)` (a plain aggregate read — safe after the atomic debit unwinds) → `Response({'contact': contact, 'balances': balances})`.
    - `backend/apps/credits/messages.py` — NEW — trilingual message dicts (the `quota.SEARCH_LIMIT_MESSAGES` pattern): `INSUFFICIENT_CREDITS_MESSAGES` + `RECORD_NOT_FOUND_MESSAGES` keyed `{'ar': ..., 'fr': ..., 'en': ...}` (the server `detail` is the ops/debug surface; the frontend toasts its OWN static localized string — Task 4 — never the server detail).
    - `backend/apps/credits/urls.py` — NEW — `app_name = 'credits'`; `path('people/<str:record_id>/', RevealView.as_view(), name='reveal-people')` + `path('company/<str:record_id>/', ...)` (the accounts/urls module pattern — two explicit paths so the `record_type` is never parsed from a free-form slug).
    - `backend/config/urls.py` — UPDATE — `path('api/reveal/', include('apps.credits.urls'))`.
  - [x] 1.3 Run backend gates (pytest/ruff/mypy strict) — green.

- [x] **Task 2: Frontend — RevealService + query keys + credits context** (data layer for the reveal surface; FR-14/FR-15 state)
  - [x] 2.1 RED: `frontend/src/__tests__/reveal-service.test.ts` — NEW — (the `search-service.test.ts` axios-stub pattern: `(service as any).client.post = vi.fn()`):
    - `reveal('people', id)` POSTs `/reveal/people/{id}/` and returns typed `RevealResult` (`contact` + `balances`).
    - `reveal('company', id)` POSTs `/reveal/company/{id}/`.
    - `RevealedContact`/`CreditBalances` type shapes pinned to the backend payload (people vs company keys).
    - `isInsufficientCreditsError(error)` true for 402 + `code == 'insufficient_credits'`, false otherwise.
  - [x] 2.2 RED: `frontend/src/__tests__/credit-provider.test.tsx` — NEW — (SessionProvider-mock + renderHook):
    - balance seeded from `SessionUser.credits_balance` when authenticated; `null` for guests.
    - `applyCreditDelta(-1)` → balance -1 (the optimistic decrement — D4).
    - `applyConfirmedBalance({display_balance: 2, ...})` → balance 2 (the confirmed server value — the pill's "confirmed decremented balance" AC, D4).
    - delta then confirmed-balance reconcile: delta applied first, confirmed balance overwrites (no drift).
  - [x] 2.3 RED: `frontend/src/__tests__/query-keys-reveal.test.ts` — NEW — `revealKeys` factory: `all`, `idle`, `contact(userKey, type, id)` (the `checklistKeys` shape precedent).
  - [x] 2.4 GREEN:
    - `frontend/src/lib/api/reveal-service.ts` — NEW — `PeopleContact` / `CompanyContact` / `RevealedContact` (discriminated union on `record_type` — EXACTLY the 4.1 `_contact_data` keys, D2), `CreditBalances = {subscription_balance, pack_balance, display_balance}`, `RevealResult = {contact, balances}`, `RevealApiError` + `isInsufficientCreditsError` guard (402 + code); `RevealService extends HttpClient` with `reveal(recordType: 'people'|'company', recordId: string): Promise<RevealResult>` → `this.client.post('/reveal/' + recordType + '/' + recordId + '/')`; singleton `revealService`.
    - `frontend/src/lib/queryKeys/reveal.ts` — NEW — `revealKeys = { all: ['reveal'], idle: ['reveal','idle'], contact: (userKey, type, id) => ['reveal','contact',userKey,type,id] }` — the user-scoped key lesson from 3.6/3.7 (cross-user cache isolation).
    - `frontend/src/components/providers/CreditProvider.tsx` — UPDATE — real balance + mutation API (D4): `balance: number | null`, `applyCreditDelta(delta: number)`, `applyConfirmedBalance(balances: CreditBalances)`; seed from `useSession().user?.credits_balance` (re-seed on session change; guest → null). The provider is inside SessionProvider (Providers.tsx mount order) — no cycle.
    - `frontend/src/lib/api/search-service.ts` — UPDATE — `CompanyResultRow` gains `revealed: boolean` (the backend has sent it since 4.1 — D10; the FE type lagged) — and the 3.5 exact-shape test is updated in 2.5.
  - [x] 2.5 RED/GREEN: `frontend/src/__tests__/search-service.test.ts` — UPDATE — `CompanyResultRow` shape now includes `revealed` (exact-keys assertion updated); `PeopleResultRow` unchanged (already carries `revealed`). (Typecheck fallout: the 3.5-era `CompanyResultRow` literals in `results-table.test.tsx`/`results-table-stacked-row.test.tsx` gained `revealed: false`.)
  - [x] 2.6 Run frontend gates (vitest/lint/typecheck/check:i18n) — green.

- [x] **Task 3: Frontend — `useReveal` mutation hook** (the optimistic-rollback engine; checklist event contract; ACs: optimistically decrements pill / failed → pill +1; the 3.7 step-2 event contract)
  - [x] 3.1 RED: `frontend/src/__tests__/use-reveal.test.tsx` — NEW — (the `checklist-hooks.test.tsx` renderHook + QueryClientProvider pattern; mock `@/lib/api/reveal-service`, `@/components/providers/CreditProvider` context via a test harness, and spy on `queryClient.invalidateQueries`):
    - **optimistic decrement**: `mutate` → `applyCreditDelta(-1)` called synchronously BEFORE the promise settles (D4 — the pill decrements on click).
    - **success**: `applyConfirmedBalance(balances)` with the server values; contact written to `revealKeys.contact(userKey, type, id)` cache (setQueryData — the expand region reads it, D5); the search-results cache rows updated (`setQueriesData` on the `['search']` prefix: matching row id → `revealed: true` — so a sort/page re-render shows the badge, D5); `invalidateQueries({ queryKey: checklistKeys.all })` (the CRITICAL 3.7 deferred-work event contract — D7).
    - **failure**: `applyCreditDelta(+1)` rollback called (pill restored); NO contact cache write; NO checklist invalidation; the rejected error propagates to the component (toast is component-side, Task 4 — assert the hook DOES NOT toast, keeping the hook UI-free).
    - **user-scoped keys**: contact cache key uses `user.email` (cross-user isolation).
  - [x] 3.2 GREEN: `frontend/src/hooks/useReveal.ts` — NEW — `useReveal()` returns a shaped mutation (the `useChecklistMutations` pattern): `{ reveal: { mutate, mutateAsync, isPending } }`; `useMutation({ mutationFn: ({type, id}) => revealService.reveal(type, id), onMutate: () => applyCreditDelta(-1), onSuccess: (result, vars) => { applyConfirmedBalance(result.balances); setQueryData(revealKeys.contact(userKey, vars.type, vars.id), result); setQueriesData search-cache rows → revealed:true; invalidateQueries(checklistKeys.all) }, onError: () => applyCreditDelta(+1) })`; `userKey` from `useSession()`. (The shaped return additionally exposes `variables` — the component needs per-row `isPending` matching; one mutation serves all rows.)
  - [x] 3.3 Run frontend gates — green.

- [x] **Task 4: Frontend — Toast system** (the failure toast AC: "a toast explains 'Reveal failed — credits restored'"; also the polite `aria-live` surface for the credit-change announcement)
  - [x] 4.1 RED: `frontend/src/__tests__/toast-provider.test.tsx` — NEW — (renderHook + a consumer component inside the provider):
    - `toast('key')` renders the message (translated via `useTranslations` inside the toaster — keys asserted in tests); container is `role="status"` (polite live region — the AC's `aria-live="polite"` announcement surface, D8).
    - auto-dismisses after ~5s (`vi.useFakeTimers`); manual dismiss button per toast.
    - multiple toasts stack; newest visible.
  - [x] 4.2 RED: `frontend/src/__tests__/i18n-shape.test.ts` — UPDATE — `search.reveal.*` keys present in all three locales (the 3.7 shape-test precedent).
  - [x] 4.3 GREEN: `frontend/src/components/providers/ToastProvider.tsx` — NEW — hand-rolled (the 3.7 ChecklistCard "stock registry rejected → hand-rolled token shell" precedent; NO new dependency — the skill halts on unapproved deps): `ToastContext` + `useToast() → { toast(messageKey: string) }`; toaster renders a fixed stack (`fixed bottom-4 inset-inline-4`/logical properties only, RTL-safe) of `role="status"` cards (`rounded-md border border-border bg-card text-foreground shadow`, caption text, dismiss X with min-h-11 touch target); auto-dismiss 5s + manual dismiss; the toast message key is translated INSIDE the toaster (so callers pass keys — the next-intl pattern); `ToastProvider` mounted in `Providers.tsx` INSIDE `LocaleProvider` (translation context) and OUTSIDE `CreditProvider`.
  - [x] 4.4 Run frontend gates — green.

- [x] **Task 5: Frontend — `RevealControl` component** (the UX-DR11 button states; ACs: button/aria/badge/auto-visible/0-credit; the 3.5 reveal-slot handoff)
  - [x] 5.1 RED: `frontend/src/__tests__/results-table.test.tsx` — UPDATE — the inert-slot assertions become full RevealControl assertions (mock `@/lib/api/reveal-service` + the credits context):
    - **not revealed** (people row): a 32px button (`h-8 md:min-h-8`, `min-h-11` on mobile — UX-DR22 touch target) with the reveal label + "1 credit" affordance; `{colors.primary}`/`{colors.primary-foreground}` fill + `{rounded.md}`; `aria-expanded="false"` + `aria-controls` pointing at the row's expansion region id; NO native `disabled` (it stays clickable).
    - **click → pending**: spinner replaces the label (lucide `Loader2` + `animate-spin`), `aria-busy="true"`, button width pinned (fixed width class — no row jump); the row shows the expansion region (optimistic expansion).
    - **success**: contact fields render inline (people: email/phone/address — the value moment; each field labeled); `aria-expanded="true"`; the button is REPLACED by the Already-revealed badge (`success-container`/`success-on-container`, `rounded-full`, caption — assert the token classes).
    - **failure**: row collapses (region gone), button returns to the Reveal state, toast `search.reveal.failed` fired (assert via the toast container), pill rolled back (context balance assertion).
    - **already-revealed row** (`row.revealed === true`): badge + auto-visible fields (the auto-fetch fires the free path — the mock `revealService.reveal` called WITHOUT any click; assert no debit semantics via the hook test in Task 3), `aria-expanded="true"`.
    - **0 credits**: `aria-disabled="true"` (focusable — NOT native disabled), muted/border token classes, tooltip "No credits remaining" (`search.reveal.no_credits`) on focus/hover; click/Enter → the recovery stub announcement (toast with the no-credits message — D9).
    - **RTL smoke**: no physical-property classes (`left-`/`right-`/`ml-`/`mr-`/`text-left`/`text-right`) in the RevealControl markup.
  - [x] 5.2 RED: `frontend/src/__tests__/results-table-stacked-row.test.tsx` — UPDATE — card reveal slots become RevealControl: full-width button on both tabs (people + companies — the 3.5 card already renders the slot for both); expansion region renders BELOW the meta lines (card reflow); company row with `revealed: true` → badge + auto-visible fields.
  - [x] 5.3 GREEN:
    - `frontend/src/components/search/RevealControl.tsx` — NEW — props `{ tab, row }` where row is `PeopleResultRow | CompanyResultRow`; reads `useCredits().balance` + `useReveal()` + `useSession()`:
      - states: (a) revealed (row.revealed OR contact cache present) → badge + fields; (b) pending (mutation.isPending for this row) → spinner button + expansion region; (c) zero credits (balance !== null && balance <= 0) → `aria-disabled` button + tooltip (`TooltipTrigger`/`TooltipContent` — the saved-searches cap precedent) + click → toast `search.reveal.no_credits` (D9); (d) idle → primary button.
      - expansion region: `id={'reveal-content-' + row.id}`, `role="region"`, `aria-label={t('search.reveal.content')}`, rendered when revealed || pending; the BUTTON carries `aria-expanded` + `aria-controls={regionId}` (review-accessibility finding (c) literal — the expanded region is labeled).
      - auto-visible path: when `row.revealed === true` and no contact cache yet → `useQuery({ queryKey: revealKeys.contact(userKey, type, id), queryFn: () => revealService.reveal(type, id), enabled: row.revealed })` — the FREE re-view path (4.1 idempotency guarantees no debit — D3); the badge renders immediately from `row.revealed` (not gated on the fetch); fields render when the cache lands; fetch failure → badge stays (the revealed flag is authoritative), no retry loop.
      - contact fields: people → email/phone/address (labeled); company → website (rendered as a link — the AC's "source link" maps to website, D2), industry, size_band (bandLabelKey when known, else raw). Western numerals only (`tabular-nums` on phone — FR-15).
    - `frontend/src/components/search/ResultsTable.tsx` — UPDATE — the inert `RevealSlot` (people column) replaced by `<RevealControl tab="people" row={person} />`; the companies column set is UNCHANGED (DESIGN.md literal — 5 columns; desktop company reveal is a documented handoff, D10). Keep `data-testid="reveal-slot"` on the button (minimal churn) + add `data-testid="reveal-content-{id}"` region.
    - `frontend/src/components/search/ResultsTableStackedRow.tsx` — UPDATE — the card `RevealSlot` replaced by `<RevealControl tab={tab} row={row} />` (both tabs).
  - [x] 5.4 Run frontend gates — green.

- [x] **Task 6: i18n — `search.reveal.*` keys ×3** (AC microcopy; the check-i18n parity gate)
  - [x] 6.1 RED: `frontend/messages/en.json` + `fr.json` + `ar.json` — UPDATE — the new keys (shape test already added in 4.2):
    - `search.reveal.cost`: "1 credit" / "1 crédit" / "1 رصيد" (the button affordance).
    - `search.reveal.already_revealed`: "Already revealed" / "Déjà révélé" / "تم العرض مسبقًا" (badge).
    - `search.reveal.no_credits`: "No credits remaining" / "Aucun crédit restant" / "لا رصيد متبقي" (0-credit tooltip + recovery-stub announcement, D9).
    - `search.reveal.failed`: "Reveal failed — credits restored" / "Échec de la révélation — crédits restaurés" / "فشل العرض — تمت استعادة الرصيد" (the AC-literal toast).
    - `search.reveal.deducted`: "1 credit used — {balance} remaining" ×3 — the success aria-live announcement (D8; **`{balance}` interpolated via `String(balance)` — the 3.4 AD-8 numeral lesson: next-intl would render Arabic-Indic digits in AR**).
    - `search.reveal.content`: "Contact details" / "Coordonnées de contact" / "بيانات الاتصال" (the expansion-region aria-label).
    - `search.reveal.field_email` / `field_phone` / `field_address` / `field_website` / `field_industry` / `field_size_band`: field labels ("Email/Phone/Address/Website/Industry/Size" + fr/ar).
  - [x] 6.2 GREEN: `frontend/src/__tests__/i18n-shape.test.ts` — UPDATE — the `search.reveal.*` keys asserted present in all three locales (parity by construction + shape pin).
  - [x] 6.3 Run frontend gates — green (check:i18n must pass — every key in all 3 locales).

- [x] **Task 7: Full regression + real-stack verification** (the 4.1 Task 8 precedent; NFR-1)
  - [x] 7.1 Full gates: backend `pytest` (all apps) + `ruff` + `mypy` strict; frontend `vitest run` + `lint` + `typecheck` + `check:i18n` — ALL green.
  - [x] 7.2 Real-stack E2E (docker PG16 — the 4.1 docker-compose.yml stack): `migrate` clean (no new migrations expected — 4.2 is endpoint+UI only); `curl`/django-test flow: login → reveal a seeded person (200, contact payload, ledger debit, cache decrement via psql) → re-reveal (200, no second debit) → 0-credit user reveal (402, nothing written) → frozen user (401 account_deleted). If docker is unavailable, document the fallback (the 3.2 PG-keyword precedent: ad-hoc verification + CI caveat).
  - [x] 7.3 Confirm NFR-1 headroom: the reveal round trip is ONE POST, no waterfall; the endpoint runs ≤4 indexed queries (user pk lookup + window EXISTS + ledger sums + inserts); the auto-visible path fires parallel free-path requests bounded by the page size (D3) — record in Dev Notes.

## Dev Notes

- **Source of truth — the planning spec**: `_bmad-output/planning-artifacts/epics/epic-04-reveal-credit-export/story-02-reveal-api-component.md` (all ACs verbatim). FR-14 in `_bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L131-137`. UX-DR11/20/21/24 + the reveal-button spec in `_bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md#L332` (tonal aria-disabled, revealed badge, loading/width-pinned) + `EXPERIENCE.md#L219-233` (state machine, already-revealed short-circuit, 0-credit recovery paths) + NFR-1 (`10-cross-cutting-nfrs.md` — reveal ≤1.5s p95 on 4G). Mockup: `ux-designs/.../mockups/reveal-zero-credit.html` (pins: tonal aria-disabled, badge, auto-visible fields, pill zero state).
- **CRITICAL CONTRACTS (recorded for the review — MUST be honored verbatim):**
  - **D1 — the 4.1 service contract** (`deferred-work.md` "Deferred from: code review of story 4.1"): `POST /api/reveal/{type}/{id}/` must call `reveal_contact` DIRECTLY — never inside an outer `transaction.atomic()` (the SERIALIZABLE guard would raise ProgrammingError on PG). The per-user `select_for_update` lock carries correctness on any isolation level. Exception mapping: `InsufficientCreditsError` → 402 `{'detail': <localized>, 'code': 'insufficient_credits'}` (the "Reveal failed — credits restored" semantics live in the FRONTEND toast — Task 4/6; the server detail is the localized ops message); `RevealRecordNotFoundError` → 404 `{'code': 'record_not_found'}`.
  - **D2 — contact payload shape pinned by 4.1 `_contact_data`**: people → `{record_type, record_id, name, role, company_name, email, phone, address}`; company → `{record_type, record_id, name, industry, website, wilaya_code, size_band}`. The AC's "source link" clause is honored by the WEBSITE link on the company payload; person records carry NO URL field in the pinned payload (the 4.1 contract predates the AC text — the AC's field list is illustrative of "contact fields"; the value moment per EXPERIENCE.md is phone/email/address). The `source` provenance column is internal metadata, not a customer-facing link — deliberately NOT added to the payload (pinned contract + 4.1 tests assert the exact keys).
  - **D3 — re-view is FREE**: search rows already carry `revealed: true` for ≤30d reveals (4.1). The "Already revealed" badge consumes `row.revealed` directly; the auto-visible fields fetch via the reveal endpoint (the ≤30d free path — 4.1 idempotency: no debit, a `was_free=True` row). The frontend MUST NOT skip the fetch on `revealed: true` rows (the search payload has no contact data by contract — the 3.2 exact-keys row shape).
  - **D4 — the Credits Pill is story 4.3**: 4.2 satisfies the "pill decrements/rolls back" ACs at the STATE level — `CreditProvider` gains a real balance (seeded from `SessionUser.credits_balance`) + `applyCreditDelta` (optimistic) + `applyConfirmedBalance` (server-confirmed); the `useReveal` hook applies `-1` onMutate and `+1` onError. 4.3 wires the pill RENDERING (header, warning/zero tones, navigation) from this context and owns the pill's own aria-live announcement. The success-path aria-live credit-change AC is additionally satisfied in 4.2 by a polite `role="status"` toast (D8).
  - **D5 — cache discipline (no quota burn)**: reveal success NEVER invalidates the search-results queries (a refetch would re-run the search and re-increment `daily_usage` — the 3.6 `retry: false` quota contract). Instead: `setQueryData(revealKeys.contact(...))` for the contact + `setQueriesData` on the `['search']` prefix flipping the matching row's `revealed` to true (so sort/page re-renders show the badge).
  - **D6 — deleted/frozen users**: the auth layer (`CookieJWTAuthentication.validate_user_token`) already rejects frozen/inactive/unverified users with 401 before the view body runs — no view-level guard (the 4.1 review-dismissed finding resolves AT the API boundary by contract).
  - **D7 — the checklist event contract** (`deferred-work.md` 3.7 entry (b)): the reveal mutation MUST `invalidateQueries({ queryKey: checklistKeys.all })` on success, or the card's step-2 live check-off stops working (`step_reveal` EXISTS is already live from 4.1). Asserted in the hook test.
  - **D8 — the toast = the polite surface**: no toast system exists in the app (grep-verified); the AC demands "a toast explains". 4.2 ships a hand-rolled `ToastProvider` (`role="status"` — polite live region by construction), zero new dependencies (the skill halts on unapproved deps; the 3.7 hand-rolled-shell precedent). The failure toast is the AC-literal message; the success announcement (`search.reveal.deducted` with `String(balance)` — AD-8 Western-numeral lesson from 3.4) satisfies the `aria-live="polite"` credit-change clause; the 4.3 pill may adopt/merge this announcement (recorded handoff).
  - **D9 — 0-credit recovery dialog depends on Epic 5** (the dialogs land with billing): 4.2 renders the full disabled-but-actionable surface NOW — `aria-disabled` (stays focusable), tonal muted/border tokens, tooltip "No credits remaining" — and clicking/Enter fires a STUB announcement (toast with the no-credits message) that 5.x replaces with the real Upgrade/top-up dialog. This is the 3.5 reveal-slot precedent verbatim (inert-but-real affordance + documented handoff).
  - **D10 — company desktop reveal column**: DESIGN.md pins the companies table to 5 columns (name/industry/wilaya/size/people-count — no reveal) and the completed 3.5 story's tests assert that exact header set. 4.2 therefore wires RevealControl into: the people desktop column + BOTH tabs of the mobile stacked card (the 3.5 card already renders the slot for companies). Desktop company reveal is a documented handoff to the company-detail surface. The FRONTEND `CompanyResultRow` type gains `revealed: boolean` (the backend has sent it since 4.1 — the FE type lagged; the 3.5 exact-shape test is updated).
- **Prior-story contracts this story closes**: 3.5 (`3-5-results-table-stacked-row.md` decision 8): the inert `reveal-slot` handoff — Task 5 fills RevealButton; 3.7 (`3-7-checklist-card.md` D4): the step-2 event contract — Task 3 delivers the invalidate half; 4.1 (`4-1-credit-system-backend.md` D9/D10): the `revealed` flag + free re-view semantics + the payload contract; `deferred-work.md` (SERIALIZABLE-under-composition + checklist event contract).
- **Out of scope (handoff)**: Credits Pill rendering + `/credits` ledger = 4.3; exports = 4.4/4.5; the 15-credit welcome banner (deferred-work 3.7) = 4.3; the recovery/upgrade dialogs = Epic 5 (D9); desktop company reveal column = company-detail surface (D10); contact-data encryption at rest (3.1 decision 7) — the reveal surface now ships the PII; raised in the review as an Epic-4 note (data is served over HTTPS; encryption-at-rest remains on the spine backlog).
- **NFR-1 (≤1.5s p95 on 4G)**: single POST round trip, no waterfall; the endpoint runs ≤4 indexed queries (user-row lock, window EXISTS, ledger sums, inserts); the contact payload is ~200 bytes. The auto-visible path fires N parallel free-path POSTs (N = revealed rows on the current page, bounded by PAGE_SIZE 100) — free, idempotent, no debit (D3). Not CI-testable — recorded as design headroom.
- **Testing standards**: backend — pytest + `django_db`, the `test_saved_search_api.py` session fixture pattern, localized-detail fixtures (ar/fr/en), the 4.1 `user_with` grant pattern; gates = `pytest` + `ruff` + `mypy` (strict). Frontend — vitest + jsdom, service modules mocked via `vi.hoisted`/`vi.mock` (never fetch), error objects shaped `{response: {status, data: {code}}}`; `useTranslations` returns keys verbatim (assert keys, never values); gates = `vitest run` + `lint` + `typecheck` + `check:i18n`. Run ALL gates after EVERY task.

## Dev Agent Record

### Agent Model Used

opencode-go/deepseek-v4-flash

### Debug Log References

- RED runs: test_reveal_api.py failed collection→URL resolve (12 failed, no endpoint); reveal-service/credit-provider/query-keys/use-reveal suites failed on missing modules; results-table/stacked-row suites failed on the inert slot (12 failed after the new assertions).
- GREEN fixes during implementation: the two-explicit-paths URL scheme could not reach the view's record_type whitelist (Django resolver 404s non-matching paths) → single generic `<str:record_type>/<str:record_id>/` pattern + view whitelist (400 `invalid_payload` contract preserved; URL-wiring deviation recorded); mypy strict cast() on the person/company fixtures (no django-stubs); E501 on the was_free count assertion; CreditProvider guest-guard extended to applyConfirmedBalance (null balance stays null); testing-library `rerender` replaced the provider tree (No QueryClient set) → renderTable/renderCards wrap `rerender` to re-render INSIDE the providers; company reveal test's `search.size.500_plus` matched the card meta line too → scoped to `[data-testid="reveal-fields"]`.
- useReveal returns `variables` in addition to the 3.7-shaped surface — per-row `isPending` needs the mutation's last variables (one mutation serves every row).
- E2E (docker PG16, live stack): seeded 3 users + person/company; login via curl cookie jars; reveal → 200 contact+balances, psql: free_signup 3 + reveal_debit -1/2, cache 2, one paid reveal row; re-reveal → 200 same balances, still ONE reveal_debit, reveals f+t; 0-credit → 402 insufficient_credits; frozen → 401 account_deleted; unknown id → 404 record_not_found; E2E rows cleaned (ledger+reveals+users+seed rows deleted).

### Completion Notes List

- Story 4.2 implemented end-to-end (TDD red→green for every task): backend `POST /api/reveal/{type}/{id}/` (RevealView — direct `reveal_contact` call per the 4.1 SERIALIZABLE-composition contract, exception mapping 402/404/400, trilingual messages, confirmed `balances` in the response), frontend data layer (RevealService + revealKeys + CreditProvider real-balance/delta/confirmed API + CompanyResultRow.revealed), `useReveal` (optimistic -1, rollback +1, confirmed balance, contact+search caches, checklistKeys.all invalidation), hand-rolled ToastProvider (role=status polite region), RevealControl (primary/aria-disabled/badge states, aria-expanded+aria-controls labeled region, auto-visible free-path fields, recovery stub), i18n ×3.
- Gates: backend 501 pytest / ruff 0 / mypy strict 0; frontend 517 vitest / lint 0 / typecheck 0 / check:i18n ✓ (436 keys ×3). Real-stack PG16 E2E verified (debit, free re-reveal, 402, 401, 404).

### File List

- `backend/apps/credits/views.py` (NEW — RevealView; review patch: 409 concurrent mapping)
- `backend/apps/credits/urls.py` (NEW)
- `backend/apps/credits/messages.py` (NEW — trilingual API messages; review patch: concurrent message)
- `backend/apps/credits/tests/test_reveal_api.py` (NEW — 14 tests; review patch: 409 tests + message-dict import)
- `backend/config/urls.py` (MODIFIED — api/reveal/ include)
- `frontend/src/lib/api/reveal-service.ts` (NEW)
- `frontend/src/lib/queryKeys/reveal.ts` (NEW; review patch: inFlight key, idle removed)
- `frontend/src/components/providers/CreditProvider.tsx` (MODIFIED — real balance + delta/confirmed API)
- `frontend/src/components/providers/ToastProvider.tsx` (NEW; review patch: timer cleanup)
- `frontend/src/components/providers/Providers.tsx` (MODIFIED — ToastProvider mount)
- `frontend/src/hooks/useReveal.ts` (NEW; review patch: in-flight flag, session guard, refresh reconcile)
- `frontend/src/components/search/RevealControl.tsx` (NEW; review patch: control/content split, in-flight guard, scheme guard, sr-only pending label)
- `frontend/src/components/search/ResultsTable.tsx` (MODIFIED — RevealControl in the people column; review patch: full-width expansion row)
- `frontend/src/components/search/ResultsTableStackedRow.tsx` (MODIFIED — RevealControl/RevealContent in cards; review patch: per-card state hook)
- `frontend/src/lib/api/search-service.ts` (MODIFIED — CompanyResultRow.revealed)
- `frontend/messages/en.json` / `fr.json` / `ar.json` (MODIFIED — search.reveal.* namespace; review patch: deducted wording)
- `frontend/src/__tests__/reveal-service.test.ts` (NEW)
- `frontend/src/__tests__/credit-provider.test.tsx` (NEW)
- `frontend/src/__tests__/query-keys-reveal.test.ts` (NEW; review patch: idle removed)
- `frontend/src/__tests__/use-reveal.test.tsx` (NEW; review patch: guard/reconcile/session tests)
- `frontend/src/__tests__/toast-provider.test.tsx` (NEW)
- `frontend/src/__tests__/results-table.test.tsx` (MODIFIED — RevealControl suite + provider harness; review patch: double-click guard test, sr-only label)
- `frontend/src/__tests__/results-table-stacked-row.test.tsx` (MODIFIED — RevealControl suite + provider harness; review patch: physical-class test restored)
- `frontend/src/__tests__/search-service.test.ts` (MODIFIED — company row revealed key)
- `frontend/src/__tests__/i18n-shape.test.ts` (MODIFIED — search.reveal shape block)

### Change Log

- 2026-08-07: Story created (ready-for-dev) from the epic 4.2 planning spec; the 4.1 deferred-work contracts (SERIALIZABLE composition, checklist event contract, payload shape, free re-view) recorded in Dev Notes D1–D3/D7; scope decisions recorded (pill = 4.3 state-level satisfaction D4, recovery dialog = Epic 5 stub D9, company desktop column = handoff D10); sprint-status 4-2 → ready-for-dev (epic-4 stays in-progress).
- 2026-08-07: Implemented (TDD) — Task 1 reveal endpoint (402/404/400 mapping, trilingual messages, confirmed balances), Task 2 reveal service + keys + credits context, Task 3 useReveal (optimistic/rollback/confirmed/cache/invalidate), Task 4 toast system, Task 5 RevealControl + table/card wiring, Task 6 i18n ×3, Task 7 full regression + real-PG16 E2E. 501 backend / 517 FE gates green. Status → review (sprint-status 4-2 → review).

### Review Findings

Code review (full mode — Blind Hunter + Edge Case Hunter + Acceptance Auditor, 2026-08-07). Blind: 17 findings (3 High). Edge: 13 findings (3 High). Auditor: 7 Low deviations + 4 interpretation flags (no High). Triage: 13 patch, 2 defer, 12 dismiss (4 auditor interpretations pre-sanctioned by the story contracts D2/D9 + Task 5.1). All patches applied; gates re-run green (backend 503 pytest / ruff 0 / mypy strict 0; frontend 522 vitest / lint 0 / typecheck 0 / check:i18n ✓).

- [x] [Review][Patch] Double-submit + interleaved rollback drift (two clicks / overlapping reveals → permanent pill drift vs the ledger) [frontend/src/components/search/RevealControl.tsx, hooks/useReveal.ts] — fixed: reveals are now serialized — a synchronous in-flight guard in `handleClick` (reads `revealKeys.inFlight` straight from the query cache, so a second click in the same tick is ignored) + the in-flight flag is written by `onMutate` and cleared by `onSettled` (per-row pending now derives from the SHARED cache flag, not the per-instance mutation). Tests: double-click → exactly one reveal call.
- [x] [Review][Patch] Ambiguous-failure rollback lies: a lost/timeout response (server committed) still rolled back +1 and toasted "credits restored" [hooks/useReveal.ts] — fixed: onError keeps the AC-literal immediate `+1` AND reconciles via `SessionProvider.refresh()` (the `/me` probe carries the authoritative `credits_balance`); `CreditProvider` re-seeds from the fresh session — the pill converges to server truth (self-heals the timeout-after-commit case; 402 case lands at 0).
- [x] [Review][Patch] Cross-session stale mutation callbacks: a logout/login mid-flight let the old user's onSuccess/onError write the new user's balance and flip search-cache rows (→ the new user's auto-visible fetch could DEBIT them) [hooks/useReveal.ts] — fixed: the dispatch-time `userKey` is captured in the in-flight payload and compared against the session at settle time; UI side effects are skipped when they differ. (Search query keys remain user-unscoped — pre-existing 3.x design, now harmless because the 4.2 write path is session-guarded.)
- [x] [Review][Patch] Unvalidated 200 (missing `balances` → TypeError inside onSuccess → "failed" toast while the server charged) [hooks/useReveal.ts, RevealControl.tsx] — fixed: `balances` presence-guard before `applyConfirmedBalance` and before the success toast; the contact cache + checklist invalidation still run (the reveal DID succeed).
- [x] [Review][Patch] Concurrent paid-path reveals after window expiry → partial-unique-index IntegrityError / PG serialization abort → raw 500 [backend/apps/credits/views.py] — fixed: `(IntegrityError, OperationalError)` → 409 `concurrent_reveal` with a trilingual message (retryable: the winner's window row makes the retry hit the free path). 2 tests (monkeypatched service).
- [x] [Review][Patch] Desktop expansion squeezed into the fixed `w-32` reveal cell (email/address stack unusable) [ResultsTable.tsx, RevealControl.tsx] — fixed: `RevealControl` split into control + `RevealContent`; the people table renders a full-width expansion row (`colSpan`) below the row; the stacked card renders the content inline. The shared state hook (`useRevealState`) also makes the table/card dual instances consistent (CSS-hidden twin can no longer diverge).
- [x] [Review][Patch] Pending button's accessible name collapses (bare spinner) [RevealControl.tsx] — fixed: sr-only reveal label alongside the spinner.
- [x] [Review][Patch] Company website emitted as a raw `href` (javascript:/data: link injection from seed/admin data) [RevealControl.tsx] — fixed: `https?://` scheme guard; non-URL values render as plain text.
- [x] [Review][Patch] `revealKeys.idle` dead entry [lib/queryKeys/reveal.ts] — removed + test updated.
- [x] [Review][Patch] Toast auto-dismiss timers never cleared (setState-after-unmount, manual-dismiss leaves armed timers) [ToastProvider.tsx] — fixed: per-toast timers tracked and cleared on dismiss + provider unmount.
- [x] [Review][Patch] `test_reveal_api.py` re-declared the trilingual message dict (assertions could stay green while production strings drifted) [test_reveal_api.py] — fixed: imports `apps.credits.messages`.
- [x] [Review][Patch] Success toast could claim "1 credit used" on the stale-flag free path [messages ×3] — reworded to the truthful "Balance updated — {balance} credits remaining" (still announces the credit change; `{balance}` keeps the String() Western-numeral rule).
- [x] [Review][Patch] Stacked-card physical-property regression test lost during Task 5 rewrites [results-table-stacked-row.test.tsx] — restored.
- [x] [Review][Defer] Dev-Notes NFR-1 "≤4 indexed queries" claim is inaccurate on the paid path (~7 statements) [4-2 story file] — the headroom claim is a Dev Notes wording matter (the ≤1.5s p95 budget still holds: single POST, small payload, indexed lookups); corrected here in the record; Dev Notes is not an editable section.
- [x] [Review][Defer] `setQueriesData` matches cached rows by `id` only (no record-type/user segment) [hooks/useReveal.ts] — a cross-table UUID collision is astronomically unlikely; the reachable user-scoping hole is closed by the cross-session patch above.
- [x] [Review][Dismissed] 30-day window self-extends via free rows / paid-row renewal unreachable (Blind High ×2) — the 4.1 D14 AC-literal semantics, adjudicated and dismissed in the 4.1 review ("already revealed within the past 30 days" counts ANY reveal row; free rows accumulate by AC).
- [x] [Review][Dismissed] Auto-visible re-view writes N `was_free` rows per page load — AC-mandated free-path re-view (4.1 D8/D9); bounded by PAGE_SIZE 100; session-cache dedupes in-session re-mounts.
- [x] [Review][Dismissed] 30-day re-charge is invisible to the user — 4.1 D14 window semantics; product behavior per the AC (button is a fresh reveal after the window).
- [x] [Review][Dismissed] `aria-controls` references a non-existent element when collapsed — conditional disclosure pattern; the reference is inert while collapsed (`aria-expanded="false"`); element exists whenever the region is shown.
- [x] [Review][Dismissed] `isInsufficientCreditsError` dead code — typed API surface for 4.3 consumers; the failure toast is intentionally uniform per the AC's verbatim text.
- [x] [Review][Dismissed] `CompanyResultRow.revealed` unused on the desktop table — D10 documented handoff (mobile card consumes it).
- [x] [Review][Dismissed] Free-path contact cache never expires — session-scoped snapshot; record corrections are rare and land on the next session; revalidation would re-fire the free-path POSTs per mount.
- [x] [Review][Dismissed] 0-credit users still trigger the auto-visible fetch — the fetch is FREE (no debit) and shows value the user already paid for; gating it would hide revealed data.
- [x] [Review][Dismissed] Recovery-dialog AC vs shipped stub (Auditor decision flag) — pre-sanctioned: Epic 5 owns the dialogs; the user's Step instructions specified the stub/handoff pattern (3.5 reveal-slot precedent); D9 records the contract.
- [x] [Review][Dismissed] "source link" absent on people rows (Auditor decision flag) — pre-sanctioned: the user's CRITICAL CONTRACTS pin the 4.1 `_contact_data` payload (no URL field for people); D2 records the interpretation (website link on the company payload).
- [x] [Review][Dismissed] 32px vs 44px button height (Auditor decision flag) — the AC's 32px holds on desktop (`md:min-h-8`); the 44px mobile touch target is the UX-DR22 a11y floor, sanctioned in Task 5.1.
- [x] [Review][Dismissed] `role="status"` vs a literal `aria-live="polite"` (Auditor decision flag) — `role="status"` IS the ARIA-implicit polite live region; D8 records the reading.

### Change Log (continued)

- 2026-08-07: Code review (full mode — Blind Hunter + Edge Case Hunter + Acceptance Auditor). Blind: 17 (3 High). Edge: 13 (3 High). Auditor: 7 Low + 4 interpretation flags. Triage: 13 patches (serialized reveals + in-flight flag, session-refresh reconcile, cross-session guard, 409 concurrent mapping, full-width expansion row split, scheme-guarded website link, toast timer hygiene, i18n truthfulness + others), 2 defers, 12 dismisses (4 auditor flags pre-sanctioned by story contracts). All gates re-run green (backend 503 / FE 522). Status stays review pending Step 3 close-out.
- 2026-08-07: Review resolved — all patch findings applied, defers recorded in the Review Findings section, gates fully green; Status → done (sprint-status 4-2 → done, epic-4 stays in-progress).
