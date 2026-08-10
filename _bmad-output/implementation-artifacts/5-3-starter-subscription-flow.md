---
story_id: 5.3
epic: 5
title: Story 5.3 — Starter Subscription Flow
Status: done
frs: [FR-24, FR-28]
ads: [AD-7]
baseline_commit: a7e7484c9ecfc8c73302a1d7f1e5bc2934db2fe8
---

# Story 5.3: Starter Subscription Flow

Status: done

## Story

As a **user ready to pay for DZLeads**,
I want **to subscribe to the Starter tier (1,500 DZD/mo for 200 credits) via Chargily checkout using my CIB or EDahabia card**,
So that **I can access the product at the local price point with my local payment method**.

## Acceptance Criteria

**Given** a user with a free account clicks "Upgrade" or similar CTA
**When** they are redirected to the Chargily checkout via `POST /api/billing/create-checkout/`
**Then** the Chargily checkout shows:
- Amount: 1,500 DZD
- Payment methods: CIB and EDahabia only (no foreign-card fallback)
- Description: "DZLeads Starter — 200 credits/mo"

**Given** the payment succeeds (subscription creation)
**When** Chargily sends `checkout.paid` webhook with type subscription_creation
**Then** the `grant_credits` Celery task:
1. Creates a subscription with status 'active', current_period_start = now, current_period_end = now + 1 month
2. Grants 200 credits (credit_ledger event_type='subscription_grant', pool='subscription')
3. Sets user tier to 'starter'
4. Updates payment_transactions status to 'succeeded'
5. Sends a payment receipt email (localized)

**Given** the monthly renewal
**When** Chargily sends `checkout.paid` with type `subscription_renewal` (the 5.2 event mapping — subscription id present; the trigger is the webhook, not a time-based job) [AMENDED 2026-08-10, John PM verdict — AC amendment recorded, 5.1 F1 precedent]
**Then** on success: 200 fresh credits are granted, the period is extended (`current_period_end = max(previous end, now) + 1 month`)
**And** unused credits from the previous cycle do NOT roll over: the remaining subscription-pool balance is zeroed via a `credit_ledger` `expiry` entry and the fresh 200-credit `subscription_grant` lands in the same transaction (AD-3; the pack pool is untouched)

**Given** the payment fails at renewal
**When** Chargily sends `subscription.payment_failed` (5.2: signature-verified 200-ack, no transaction row)
**Then** the 5.3 webhook handler sets the subscription status to 'failed_renewal' (idempotent on the event id — 5.3 owns the state write)
**And** credits from the previous cycle remain usable until the next cycle would have begun — enforced by the 5.3 expiry task: at `current_period_end` the remaining subscription-pool balance is expired (`expiry` ledger entry) and the subscription transitions to 'expired' (the documented exit path; retry re-activates the same row via a new `subscription_creation`)
**And** a persistent non-dismissible banner appears on all app surfaces (Story 5.7 owns the banner UI and copy; 5.3 owns the state write that drives it)

**Given** the subscription state in the header
**When** a Starter user views any page
**Then** `GET /api/billing/plan/` (the 5.1-deferred endpoint; the 5.3 deliverable) returns the authenticated user's current tier, subscription status, and renewal date — the forward contract the 5.7 Subscription Chip and the 5.5 billing page consume [AMENDED 2026-08-10, John PM verdict — AC amendment recorded, 5.1 F1 precedent]
**And** the Credits Pill shows the current balance from both subscription and pack pools (already satisfied by the 4.3 CreditsPill — 5.3 owns no FE component work)
**And** the Subscription Chip (Story 5.7 deliverable) renders "Starter — renews on {date}" (localized month + Western numerals) from the 5.3 `GET /api/billing/plan/` contract

## Tasks / Subtasks

- [x] **Task 1: Server pricing table + calendar-month helper — `apps/billing/pricing.py`** (AC amount/description clauses; D20; Winston Q3/Q4/Q9)
  - [x] 1.1 RED: `backend/apps/billing/tests/test_pricing.py` — NEW — `SUBSCRIPTION_PRICE_DZD == 1500`, `SUBSCRIPTION_CREDITS == 200`, `SUBSCRIPTION_DESCRIPTION == 'DZLeads Starter — 200 credits/mo'` (em-dash exact, John Q5); `_add_month(now)` calendar semantics (Jan 31 → Feb 28/29 clamped, Dec → next year, leap years, mid-month passthrough); module has ZERO Django imports (importable at module level by tasks.py per the D9 constraint).
  - [x] 1.2 GREEN: `pricing.py` (stdlib only).
  - [x] 1.3 Run backend gates — green.

- [x] **Task 2: Create-checkout server-side enforcement** (AC clause 1; D20; Winston Q4/Q9)
  - [x] 2.1 RED: extend `backend/apps/billing/tests/test_checkout_view.py`:
    - subscription with `amount != 1500` → 400 `code='subscription_price_mismatch'` (tampered/glitched client input);
    - user WITH an active subscription → 409 `code='active_subscription_exists'` (state conflict — DRF Conflict, repo pins ≥3.14); a `failed_renewal`/`cancelled`/`expired` row does NOT block (FR-24 + `subscriptions_active_unique` block only ACTIVE);
    - plan_data for subscription carries the SERVER amount (client amount overridden, never trusted) + `description`; pack passthrough unchanged (5.4 owns pack prices).
  - [x] 2.2 GREEN: `views.py` — subscription branch: price validation → 400; active-sub check → 409; `create_checkout_details({'user_id', 'type', 'amount': SERVER_PRICE, 'description'})`.
  - [x] 2.3 `chargily.py`: echo `description` into the checkout payload when `plan_data` carries it (packs untouched); UPDATE the 5.2 mocked-contract pin tests in `test_chargily.py` (subscription payload now includes the description — the D11 envelope risk rides the existing isolated-adapter + pre-prod gate).
  - [x] 2.4 Run backend gates — green.

- [x] **Task 3: `grant_credits` full implementation** (AC clause 2; D15/D17; deferred-work tier split-brain + credits/status coupling)
  - [x] 3.1 RED: rewrite the bridge tests in `backend/apps/billing/tests/test_tasks.py` (new class, old bridge tests amended):
    - creation happy path: subscription row created (status 'active', periods now..now+1 month via `_add_month`), 200-credit `subscription_grant` ledger row (pool='subscription', reference_id=txn id), `user.tier` → 'starter', txn status → 'succeeded', credits_granted=200, reconciled_at set;
    - receipt email enqueued on commit (`captureOnCommitCallbacks`, spy `send_payment_receipt.delay`);
    - renewal: period extended from `max(end, now)` + 1 month, old subscription-pool balance zeroed via `expiry` ledger entry (balance_after chained from a ledger SUM inside the transaction — AD-4), fresh 200 grant, pack pool untouched;
    - creation with an existing `failed_renewal` row: SAME row re-activated (status 'active', periods from now, new chargily_subscription_id) + full grant (John Q3);
    - creation with an existing ACTIVE row (re-send/race): ERROR alarm log, NO grant, txn still → 'succeeded' (Winston Q8);
    - orphan renewal (no active/failed_renewal row): row created + grant + alarm log (paid events never silently skipped);
    - idempotency: second run on a 'succeeded' row → no-op, no double grant (the sweep double-enqueue case; status check UNDER the row lock);
    - anonymised row (user NULL): SETTLED — status → 'failed' + reconciled_at + ERROR log (D17 — Winston Q6 mandate, both grant + sweep paths);
    - `pack_purchase` row → logged skip, stays 'pending' (5.4 owns pack grants; the 5.2 bridge behavior preserved).
  - [x] 3.2 GREEN: `apps/billing/tasks.py` — full grant task: `transaction.atomic()` → `select_for_update()` on the txn row → status check UNDER the lock (early return, never raise) → `select_for_update()` on the user row (serializes vs concurrent reveals — the credits precedent) → dispatch by `row.type` (subscription_creation / subscription_renewal / pack_purchase-skip) → branch logic (create / re-activate / renew / orphan) → ledger + cache writes (credits_balance via `F()` net) → txn 'succeeded' + reconciled_at + credits_granted → `transaction.on_commit(lambda: send_payment_receipt.delay(str(row.id)))`. NO SERIALIZABLE guard in the task (recorded decision — the guard breaks under pytest-django's atomic wrapper on the PG CI job, 5.1 D13 precedent; the row locks carry correctness; concurrency proof = Phase 5 E2E-race).
  - [x] 3.3 Run backend gates — green.

- [x] **Task 4: `subscription.payment_failed` state write in the webhook view** (AC clause 4; D16; Winston Q5)
  - [x] 4.1 RED: extend `backend/apps/billing/tests/test_webhook.py`:
    - payment_failed with metadata.user_id + active subscription → 200, subscription → 'failed_renewal', NO transaction row, NO task;
    - replay → idempotent no-op (the `WHERE status='active'` predicate);
    - no metadata user_id → 200 ack + ERROR log + no change (never 400-loop Chargily);
    - user with no subscription row → 200 no-op;
    - failed_renewal user with future period end: credits untouched (no ledger writes).
  - [x] 4.2 GREEN: `webhooks.py` payment_failed branch — `_resolve_user(metadata.user_id)` + `UPDATE subscriptions SET status='failed_renewal' WHERE user_id=%s AND status='active'` (single indexed statement, ≤5s guarantee holds).
  - [x] 4.3 Run backend gates — green.

- [x] **Task 5: Reconciliation sweep + expiry task + status index + beat** (D15/D17; deferred-work status index; John Q2/Q7)
  - [x] 5.1 RED: `backend/apps/billing/tests/test_tasks.py` (extend):
    - `reconcile_pending_payments`: stale pending rows (created_at backdated via `UPDATE`, portability) with a user → re-enqueues `grant_credits.delay(event_id)`; fresh rows (< 30 min) untouched; NULL-user stale rows SETTLED 'failed' + reconciled_at + ERROR log; 'succeeded'/'failed' rows untouched; task name pinned (`apps.billing.tasks.reconcile_pending_payments`);
    - `expire_failed_renewals`: failed_renewal sub with `current_period_end <= now` → status 'expired' + `expiry` ledger entry zeroing the remaining subscription-pool balance (transactional; pack pool untouched); active subs untouched; failed_renewal with future period end untouched; task name pinned.
  - [x] 5.2 GREEN: tasks in `apps/billing/tasks.py` + `config/celery.py` beat entries (`reconcile-pending-payments-hourly` crontab(minute=0); `expire-failed-renewals-daily` crontab(hour=4, minute=0)) + migration 0003: partial index on `payment_transactions` (`created_at`) WHERE `status='pending'` (name `payments_pending_created_idx`, ≤30 chars).
  - [x] 5.3 Run backend gates — green.

- [x] **Task 6: `GET /api/billing/plan/`** (AC clause 3 — the 5.1-deferred endpoint; Sally Q1/Q2)
  - [x] 6.1 RED: `backend/apps/billing/tests/test_plan_view.py` — NEW:
    - starter + active sub → `{tier:'starter', status:'active', renews_on:'YYYY-MM-DD'}` (localdate of current_period_end; RAW data, no pre-formatting — AD-8 FE formatting);
    - free user → `{tier:'free', status:null, renews_on:null}` (200 always, never 404 — the header renders on every surface);
    - failed_renewal → status 'failed_renewal' + renews_on still present (the banner grace copy reads it);
    - unauthenticated → 401;
    - latest-row-wins: expired history + active row → the active row (ordering via `subscriptions_user_created_idx`).
  - [x] 6.2 GREEN: `PlanView` in `views.py` + `plan/` route in `urls/billing.py` (tier = user.tier — the split-brain owner; status + renews_on from the latest subscription row).
  - [x] 6.3 Run backend gates — green.

- [x] **Task 7: Localized payment receipt email** (AC clause 2.5; John Q6; Sally Q3)
  - [x] 7.1 RED backend: `backend/apps/billing/tests/test_email_receipt.py` — NEW — `send_payment_receipt` (tasks/email_tasks.py):
    - txn with user → `render_email('payment_receipt', user.locale, context)` with `{amount, currency:'DZD', creditsGranted, date}` + localized subject from `PAYMENT_RECEIPT_SUBJECTS` (ar/fr/en, 'en' fallback — the RESET_SUBJECTS precedent), differentiated creation vs renewal (`isRenewal` from row.type);
    - NULL-user txn → skip + log; missing txn → skip + log; retry policy = 1 retry (AD-14 email policy).
  - [x] 7.1 RED frontend: `frontend/src/__tests__/email-render-route.test.ts` (extend) + NEW `frontend/src/__tests__/payment-receipt.test.tsx` — locale prop threads through the render route; `PaymentReceipt` renders localized strings for ar/fr/en; amount/date use Western numerals (`Intl.NumberFormat('en')` + `numberingSystem:'latn'` — AD-8); renewal variant mentions the 200 fresh credits.
  - [x] 7.2 GREEN backend: `send_payment_receipt` implementation in `tasks/email_tasks.py` (fetch txn by pk, user; `render_email`; localized subject).
  - [x] 7.2 GREEN frontend: `PaymentReceipt.tsx` — `locale` + `isRenewal` props, per-locale copy dictionary, latn numeral formatting.
  - [x] 7.3 Run backend + frontend gates — green (FE gates RUN — this task touches FE files).

- [x] **Task 8: Real-stack verification (docker PG16, host 5433) + full regression + E2E-race** (the 4.1/5.1/5.2 precedent; deferred-work concurrent-webhook deliverable)
  - [x] 8.1 Docker PG16 up (host 5433 — the 4.6 port-conflict lesson) → clean `migrate` (incl. billing 0003) → E2E script: create-checkout (mocked Chargily client) → webhook creation → grant task runs → assert subscription row (period math), ledger 200 (pool subscription, reference_id), user.tier='starter', txn 'succeeded'; renewal event → pool reset (expiry entry) + fresh grant; payment_failed → failed_renewal; sweep re-enqueues a backdated pending row; expiry task → 'expired' + pool zeroed; CONCURRENT double-webhook race (two connections) → exactly ONE txn row + ONE ledger grant; E2E rows cleaned; container removed.
  - [x] 8.2 Full regression: backend gates + (FE gates only if Task 7 files changed after the last FE run) — green.

## Dev Notes

- **Source of truth — the planning spec**: `_bmad-output/planning-artifacts/epics/epic-05-billing-subscriptions/story-03-starter-subscription-flow.md` (ACs verbatim + 2 recorded amendments in this record — the 5.1 F1 precedent). FR-24/28 in `_bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L228-266`. Epic context in the epic-5 `index.md`.
- **Spine refs**: webhook flow `docs/ARCHITECTURE-SPINE.md#L600-631`; `grant_credits` task spec `#L627` (ledger insert + status → succeeded + credits_balance update + receipt email, transactional, 3 retries exponential — AD-14); AD-7 drawdown `#L276,678`; AD-3/AD-4/AD-5 `#L865-869`; AD-8 numerals `#L590-596`.
- **Contracts this story honors (verbatim)**:
  - D1: task full name pinned `apps.billing.tasks.grant_credits` (5.2 D18) — the grant logic replaces the bridge body in the same module; explicit `import apps.billing.tasks` in config/celery.py stays MANDATORY.
  - D2: `payment_transactions.type` CHECK allows only subscription_creation/subscription_renewal/pack_purchase — payment_failed events still write NO transaction row (5.2 D3); the failed_renewal state write is an UPDATE on `subscriptions`.
  - D3: model labels `apps.billing.Subscription`/`PaymentTransaction` pinned by `maintenance_tasks.py` (5.1 D1); user FKs SET_NULL (5.1 D2) — grant on a NULL-user row SETTLES it (D17), never grants.
  - D4: FR-24 precondition = no ACTIVE subscription (`subscriptions_active_unique` backstop — 5.1 D14b); failed_renewal/cancelled/expired do NOT block re-subscription; re-subscription re-activates the SAME row (never a duplicate — `subscriptions_chargily_id_uniq` 5.1 D14c).
  - D5: server price table in `apps/billing/pricing.py` (stdlib-only module — importable by tasks.py at module level per 5.2 D9): 1500 DZD → 200 credits; description "DZLeads Starter — 200 credits/mo" (em-dash exact); client-supplied amount for subscription is NEVER trusted (validated equal, then the server constant ships).
  - D6: no-rollover = ledger `expiry` entry zeroing the previous subscription-pool balance + fresh 200 `subscription_grant` in ONE transaction (AD-3/AD-4); `balance_after` chained from ledger SUMs inside the transaction (never `user.credits_balance`); both rows carry `reference_id` = the payment txn id.
  - D7: calendar-month math via stdlib `_add_month` (day-clamped, `calendar.monthrange`); NO new dependency (HALT avoided — python-dateutil not in requirements); renewal extends from `max(current_period_end, now)` (anchor preservation — the "next cycle would have begun" AC language).
  - D8: grant idempotency = `select_for_update()` on the txn row + status check UNDER the lock (early return on non-pending, never raise); user row also locked (serializes grants vs concurrent reveals/expiry — the credits `select_for_update` precedent). NO SERIALIZABLE guard in the task: the guard breaks under pytest-django's per-test atomic wrapper on the PG CI job (5.1 D13 — the 51 excluded credits/export tests); the row locks carry correctness on any isolation level; the concurrency proof is the Phase 5 E2E-race (the documented 4.1 pattern — deferred-work "concurrent double-webhook" deliverable).
  - D9: `payment_failed` state write = inline single UPDATE in the webhook view (`WHERE user_id=%s AND status='active'` — idempotent by predicate, microseconds, ≤5s holds); metadata.user_id is the lookup key; missing → ERROR log + 200 ack (never 400-loop Chargily); credits untouched on failure (usable until next cycle).
  - D10: reconciliation sweep `apps.billing.tasks.reconcile_pending_payments` — `status='pending' AND created_at < now − 30 min` (≫ the 5s webhook + AD-14 3-retry window), hourly beat; NULL-user stale rows SETTLED 'failed' + reconciled_at + ERROR log (in BOTH grant_credits at encounter and the sweep backstop — D15/D17); partial index `payments_pending_created_idx` on (created_at) WHERE status='pending' (deferred-work status-index deliverable; migration 0003, SQLite-compatible).
  - D11: expiry task `apps.billing.tasks.expire_failed_renewals` — daily beat (4:00, after the 3:00 hard-delete); failed_renewal subs with `current_period_end <= now` → status 'expired' + `expiry` ledger entry zeroing the remaining subscription-pool balance (the documented exit path — Sally 5.1 note; retry → active via a new subscription_creation re-activation, else → expired).
  - D12: `GET /api/billing/plan/` contract (the 5.1-deferred endpoint): `{tier, status, renews_on}` — tier = `user.tier` (the split-brain owner: the grant writes it; 5.7 owns the cancel sync), status = latest subscription row's status (`subscriptions_user_created_idx` ordering — never a dead row) or null, renews_on = `timezone.localdate(current_period_end)` ISO 'YYYY-MM-DD' or null; 200 always (free → `{tier:'free', status:null, renews_on:null}`); RAW data, FE formats per AD-8 (`Intl.DateTimeFormat` + `numberingSystem:'latn'`); NO balance fields (the pill endpoint already owns balances — no read duplication).
  - D13: receipt email — `send_payment_receipt` implemented in `tasks/email_tasks.py` (the established D9 home); triggered via `transaction.on_commit` INSIDE grant_credits (an inline delay() after commit would be lost on the task's autoretry re-run — the status check early-returns and the email never fires); context `{amount, currency:'DZD', creditsGranted, date}` + localized subject per locale (creation vs renewal variants); FE `PaymentReceipt.tsx` gains `locale` + `isRenewal` props with per-locale copy + Western numerals (the ONLY FE change in 5.3 — the AC mandates a localized receipt and no later story touches receipts).
  - D14: credits/status coupling DB checks stay deferred (5.1 deferral): the 5.4 refunded path must legally keep `credits_granted` on a non-succeeded row; 5.3 pins the write order (INSERT pending → grant → succeeded, all in the task transaction) — checks would fight 5.4.
  - D15: FE surfaces excluded: SubscriptionChip + Upgrade CTA + failed-renewal banner = 5.7 (epic index); CreditsPill = 4.3 (already shows both pools); 5.3 ships the data contracts (plan endpoint + state writes) they consume. Recorded John PM verdict + AC amendments (verbatim, above).
  - D16: `pack_purchase` rows: grant_credits logs + skips (stays 'pending') — 5.4 owns pack grants; the sweep does NOT re-enqueue pack rows to a 5.3 task that can't grant them... (recorded: the sweep filters subscription-type rows? NO — the sweep re-enqueues pending rows and grant_credits dispatches by type; a pack row re-enqueued would be skipped again by the type dispatch and remain pending → 5.4's sweep interaction is a 5.4 handoff; the sweep must not loop packs forever → pack rows are excluded from the sweep predicate in 5.3? DECISION: the sweep re-enqueues ALL stale pending rows; pack rows skipped by the type dispatch stay pending and are re-enqueued hourly until 5.4 lands — acceptable 5.3 window (≤1 production day between 5.3 and 5.4), noted as a 5.4 handoff.)
  - D17: E2E-race pattern (the 4.1 precedent) is the concurrent-webhook proof vehicle on real PG16 (deferred-work deliverable); the CI PG job already runs `apps/billing` wholesale — the grant tests must stay PG-green, hence D8's no-SERIALIZABLE ruling.
- **Persona consultation record (2026-08-10, parallel subagents — Winston architect + John PM + Sally UX; Sally INCLUDED — the AC's header clause + receipt-email clause touch FE surfaces and user-facing copy)**:
  - Winston (architect): APPROVED with rulings — (1) grant task: lock + status check is sufficient idempotency; if a serializable guard is used it must be the first statement and the status check must sit UNDER the lock (never a pre-lock read); user row also locked. MANDATORY ordering: guard → txn-row lock → status check → user lock → writes. (2) No-rollover via EXPIRY debit + fresh grant in one atomic is correct; balance_after from in-transaction ledger SUMs; reference_id = txn id on both rows. (3) stdlib `_add_month` (calendar.monthrange clamping); timedelta(days=30) rejected (drift + anchor misalignment); renewal extends from current_period_end (anchor preservation). (4) pricing.py module (zero Django imports); 400 `subscription_price_mismatch` for amount mismatch; 409 `active_subscription_exists` for the FR-24 precondition; failed_renewal/cancelled/expired do NOT block; packs unowned (5.4). (5) payment_failed = inline UPDATE with the status='active' predicate (idempotent by predicate); missing user → ERROR log + skip + ack. (6) sweep threshold 30 min + hourly beat; NULL-user rows settled 'failed' + reconciled_at + ERROR log in BOTH the task and the sweep; partial index on (created_at) WHERE status='pending'. (7) plan endpoint `{tier, subscription_status, renews_on}` — tier = user.tier; renews_on ISO date; no balances. (8) branch rules: creation+ACTIVE → alarm + skip grant + still mark succeeded; creation+failed_renewal → re-activate same row + full grant; orphan renewal → grant anyway + alarm. (9) description MUST be a payload field (metadata can't satisfy the AC); update the 5.2 pin tests; the D11 envelope risk rides the isolated adapter. (10) receipt email in tasks/email_tasks.py via transaction.on_commit; localized subject per locale; 1 retry. (11) migration 0003 = partial index only — coupling checks stay deferred (5.4 refunded path). (12) portability clean; the concurrent double-webhook PG proof lands as the E2E-race. ONE deviation recorded (D8): the SERIALIZABLE guard is NOT used in the task — Winston's mandate assumed pytest compatibility; the 5.1 D13 precedent (PG CI job + pytest-django atomic wrapper) makes the guard unrunable there; the row locks carry correctness and the E2E-race proves it on real PG.
  - John (PM): RATIFIED all scope decisions and MANDATED two AC amendments (verbatim in the AC section, 5.1 F1 precedent): (1) header clause → the plan-endpoint contract + 4.3 pill + 5.7 chip split; (2) renewal + failed-renewal clauses → webhook-triggered renewal semantics, no-rollover via expiry entry, the exit-path expiry task, 5.7 owns the banner UI while 5.3 owns the state write. Verdicts: NO FE component work in 5.3 beyond the receipt template; credit expiry enforcement + 'expired' transition LIVE IN 5.3 (a daily beat task — 5.7 copy must not lock in before the exit path exists); failed_renewal users MAY re-subscribe (FR-24 blocks only ACTIVE) and re-activate their row; no-rollover confirmed; description string exact; receipt subject per locale + creation/renewal differentiation; NULL-user rows settled 'failed' + reconciled_at (a NULL-user row renders in no user's payment history — 'failed' is the honest terminal state for a paid-but-ungrantable row); plan endpoint is a forward contract, fully implemented (no dead endpoint); fixed 1,500 DZD, no promo/proration in V1.
  - Sally (UX): CONFIRMED the plan endpoint contract (raw ISO fields only, no pre-formatting; 200 always incl. the free shape; single carrier for chip AND banner; latest-row-wins; status from the subscription enum so cancelled/expired stay future-proof). Receipt email gaps to fix in 5.3: locale prop (render route already threads it), raw ISO date + `numberingSystem:'latn'` (AD-8 AR-digit hazard — `toLocaleString()` must not emit Eastern-Arabic digits), amount via `Intl.NumberFormat('en')`, copy gaps (plan name, "200 fresh credits" on renewal), no FE pre-formatted strings. Pill traps handed off to 5.6/5.7: renewal can announce a false DECREASE (pool 250 → 200) — the 5.6 success flow must reset the pill's diff baseline; the invisible-renewal case (200+50 = 250 before and after) means the receipt is the only notification. Tier source note: `user.tier` drives the pill warning threshold — the grant's atomic `user.tier='starter'` write keeps it alive.

## Dev Agent Record

### Agent Model Used

opencode-go/deepseek-v4-flash

### Debug Log References

- Task 1 RED: collection error (no `apps.billing.pricing` module) — confirmed before GREEN. One test-expectation bug caught during GREEN review: April 30 → May 30 (May has 31 days — NO clamp; my first assertion expected a clamp that doesn't exist). mypy: `_add_month` needed `@overload`s (date/datetime narrowing) — added. First gate: 788 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations clean.
- Task 2 RED: 4 failing (old passthrough assertion + price/409 enforcement). GREEN: 400 `subscription_price_mismatch` + 409 `active_subscription_exists` (DRF Conflict); plan_data ships the server amount + description; chargily.py echoes description only when provided (packs untouched — 5.4). The 5.2 pin tests needed NO change (payload echoes conditionally) — added 2 new pin tests (description present for subscription, absent for pack). Gate: 796 pytest / ruff 0 / mypy 0 / clean. One botched edit mid-GREEN (a nonsense `_validation_response(...).__class__(...)` expression I wrote by mistake) — replaced with a plain Response before running.
- Task 3 RED: 10 failing (all new grant behaviors; the pack-skip bridge test stays green). GREEN (tasks.py full rewrite): the first on_commit-receipt test failed because `captureOnCommitCallbacks` doesn't exist in django.test.utils (it's a TestCase method — pytest-django's rolled-back transaction never runs callbacks) → wrote a `CaptureOnCommit` helper patching `connection.on_commit`; then a second failure — the test Fake's `delay` lambda bound as an instance method (2 args) → `SimpleNamespace` instead. The renewal test exposed a CACHE BUG in my first design: `user.credits_balance += net_delta` diverges from the ledger when the cache is stale (test fixture wrote ledger rows without touching the cache) → rewrote `_update_user_cache` to set the cache = the in-transaction ledger FINAL total (self-healing per AD-4 — also applied to the expiry task's F()-based update). Gate: 806 pytest / ruff 0 / mypy 0 / clean.
- Task 4 RED: 3 failing (state write + replay + missing-metadata ERROR). GREEN: `_apply_payment_failed_state` inline UPDATE (idempotent by predicate). Gate: 812 pytest / ruff 0 / mypy 0 / clean.
- Task 5 RED: only the 2 beat-registration tests failing (the sweep/expiry tasks themselves were already implemented in the Task-3 GREEN file — honest RED for the remaining bits). GREEN: beat entries + model partial index + migration 0003 (SQLite-compatible). Gate: 827 pytest / ruff 0 / mypy 0 / clean.
- Task 6 RED: 6 failing (no route). GREEN: PlanView + route. One test bug: `test_latest_row_wins` — both rows created with identical `created_at` timestamps (Windows microsecond resolution) so `order_by('-created_at')` picked the expired row → backdated the expired row's created_at explicitly (matches reality). Gate: 833 pytest / ruff 0 / mypy 0 / clean.
- Task 7 backend RED: import error (PAYMENT_RECEIPT_SUBJECTS missing). GREEN fixes during development: `max_retries=1` must be a task OPTION, not retry_kwargs (celery's default max_retries is 3 — the 5.2 test passed by coincidence); `'not-a-uuid'` pk raises ValidationError (added to the catch tuple); renewal-subject test needed an en-locale user (fixture default is 'ar'). FE RED: my direct `render(<PaymentReceipt/>)` tests returned `[]` — @react-email/render's `render` is async in this version (the route test awaited it) → awaited everywhere. FE test-file round-trip left a UTF-8 BOM (the 5.1 BOM hygiene lesson) → stripped via byte rewrite. Gates: 842 pytest / ruff 0 / mypy 0 / check clean / makemigrations clean + FE 676 vitest / lint 0 / tsc 0 / check:i18n clean.
- Phase 5 E2E (docker PG16, host 5433 — the 4.6 port-conflict lesson): docker daemon was DOWN at start → started Docker Desktop and waited for the engine; container `dzleads-pg16-e2e`; clean migrate (full chain incl. billing 0003). Script iterations: (a) `config` import failure → PYTHONPATH=backend; (b) leftover users from the first aborted run (UniqueViolation — the 5.1 leftover-user lesson) → self-clean at script start; (c) `/api/auth/jwt/create/` 404 — the cookie-JWT login IS `/api/auth/login/` (accounts urls/auth.py); (d) login 200 but create-checkout 401 — `check_email_verified` (CookieJWTAuthentication) → seeded users verified; (e) leftover billing rows from aborted runs survived user deletion (SET_NULL anonymises, does not delete) → full self-clean of billing/credits tables; (f) check 28 asserted a French subject for an en-locale user → fixed to the EN renewal variant. Final run: 45/45 — create-checkout payload (server price + description + CIB/EDahabia), wrong-price 400, creation grant (subscription row + ledger 200 + tier + txn succeeded + receipt email), plan endpoint, replay no-double-grant, renewal pool reset (expiry −195 → 0, fresh 200), renewal receipt, payment_failed → failed_renewal (no row, credits untouched), sweep recovery + NULL-user settlement, expiry task (expired + pool zeroed + cache synced), CONCURRENT double-webhook race (2 threads) → exactly ONE txn row + ONE grant + ONE subscription, schema columns + partial index `payments_pending_created_idx` on real PG. Rows cleaned (self-clean + container removed); temp script deleted. Final regression (SQLite): 842 pytest / ruff 0 / mypy 0 / check clean / makemigrations clean.

### Completion Notes List

- Story 5.3 implemented end-to-end (TDD red→green per task): server price table + `_add_month` (pricing.py, stdlib-only — no new dependency), create-checkout enforcement (server price + FR-24 precondition + description payload), the full `grant_credits` grant flow (creation/re-activation/renewal/orphan branches, no-rollover via ledger expiry entries, tier write, txn succeeded, on_commit receipt), inline `payment_failed` state write, reconciliation sweep + expiry task + beat entries + `payments_pending_created_idx` partial index (migration 0003), `GET /api/billing/plan/`, and the localized payment receipt (backend task + FE PaymentReceipt locale/isRenewal + latn numerals).
- Deferred-work items resolved: tier split-brain (grant writes user.tier atomically — 5.7 owns cancel sync), `payment_transactions.status` index (partial pending index), concurrent double-webhook PG proof (Phase 5 E2E-race — 2 threads on real PG16), credits/status coupling write order pinned (INSERT pending → grant → succeeded — DB checks still deferred to 5.4's refunded path).
- Persona decisions all implemented: Winston's rulings (D1-D17) incl. the recorded D8 deviation (no SERIALIZABLE in the task — the PG CI job's pytest-django wrapper); John's 2 AC amendments verbatim; Sally's contract + receipt fixes.
- Gates: 842 backend pytest / ruff 0 / mypy strict 0 / check clean / makemigrations clean; FE 676 vitest / lint 0 / tsc 0 / check:i18n clean; real-PG16 E2E 45/45 (creation→renewal→failed→sweep→expiry→race).

### File List

- `backend/apps/billing/pricing.py` (NEW — Task 1: price table + `_add_month`)
- `backend/apps/billing/tests/test_pricing.py` (NEW — Task 1: 12 tests)
- `backend/apps/billing/views.py` (MODIFIED — Task 2/6: price+precondition enforcement, PlanView)
- `backend/apps/billing/chargily.py` (MODIFIED — Task 2: conditional description echo)
- `backend/apps/billing/tests/test_checkout_view.py` (MODIFIED — Task 2: 7 enforcement tests + updated pin)
- `backend/apps/billing/tests/test_chargily.py` (MODIFIED — Task 2: description pin tests)
- `backend/apps/billing/tasks.py` (MODIFIED — Task 3/5: full grant flow + sweep + expiry tasks)
- `backend/apps/billing/tests/test_tasks.py` (MODIFIED — Task 3/5: grant-flow/sweep/expiry suites; bridge tests amended)
- `backend/apps/billing/webhooks.py` (MODIFIED — Task 4: `_apply_payment_failed_state`)
- `backend/apps/billing/tests/test_webhook.py` (MODIFIED — Task 4: 6 state-write tests)
- `backend/apps/billing/models.py` (MODIFIED — Task 5: partial pending index)
- `backend/apps/billing/migrations/0003_paymenttransaction_payments_pending_created_idx.py` (NEW — Task 5)
- `backend/config/celery.py` (MODIFIED — Task 5: 2 beat entries)
- `backend/apps/billing/urls/billing.py` (MODIFIED — Task 6: plan route)
- `backend/apps/billing/tests/test_plan_view.py` (NEW — Task 6: 6 tests)
- `backend/tasks/email_tasks.py` (MODIFIED — Task 7: `send_payment_receipt` real implementation + subjects)
- `backend/apps/billing/tests/test_email_receipt.py` (NEW — Task 7: 9 tests)
- `frontend/emails/components/PaymentReceipt.tsx` (MODIFIED — Task 7: locale + isRenewal, per-locale copy, latn numerals)
- `frontend/src/__tests__/email-render-route.test.ts` (MODIFIED — Task 7: 3 localized-render tests)
- `frontend/src/__tests__/payment-receipt.test.tsx` (NEW — Task 7: 6 component tests)
- `_bmad-output/implementation-artifacts/5-3-starter-subscription-flow.md` (NEW — this story record)

### Change Log

- 2026-08-10: Story created (in-progress) from the epic 5.3 planning spec; sprint-status 5-3 → in-progress (UTF-16 LE preserved); epic-5 already in-progress. Baseline commit a7e7484c.
- 2026-08-10: Persona consultations (parallel subagents — Winston architect + John PM + Sally UX): design APPROVED with rulings (grant idempotency via row locks — no SERIALIZABLE in the task, D8 deviation recorded; no-rollover via expiry entry; stdlib _add_month — no new dependency; pricing.py server table; 400/409 create-checkout enforcement; inline payment_failed UPDATE; 30-min hourly sweep + 'failed' settlement for NULL-user rows; plan endpoint contract; description payload field + 5.2 pin-test updates; on_commit receipt email). TWO AC amendments recorded verbatim (John — header clause and renewal/failed-renewal clauses; 5.1 F1 precedent). Dev Notes D1-D17 + consultation record added.
- 2026-08-10: Implemented (TDD) — Task 1 pricing (12 tests), Task 2 create-checkout enforcement (7 tests + pin updates), Task 3 grant flow (10 new grant tests; cache self-healing fix), Task 4 payment_failed state write (6 tests), Task 5 sweep + expiry + beat + partial index migration 0003 (12 tests), Task 6 plan endpoint (6 tests), Task 7 localized receipt (backend 9 tests + FE 9 tests; @react-email/render async awaited; BOM stripped). Gates green after every task (788 → 842 pytest; FE 676 vitest / lint 0 / tsc 0 / i18n clean). Phase 5 real-stack: PG16 (host 5433) migrate clean incl. 0003, E2E 45/45 (creation → renewal pool reset → payment_failed → sweep → expiry → concurrent double-webhook race: exactly one txn/grant/subscription; partial index verified on PG), cleanup + container removed. Status → review (sprint-status 5-3 → review; epic-5 stays in-progress).

## Review Findings

Full-mode review 2026-08-10 (parallel: Blind Hunter 13 + Edge Case Hunter 6 + Acceptance Auditor — all 6 ACs SATISFIED, 0 VIOLATED, 0 PARTIAL; 851 tests reproduced on SQLite + the billing suite on real PG16; review subagents ran on the same model family — the "different LLM" preference was not available and is noted). Triage: 1 decision + 9 patches + 3 defers + 2 dismissed. User decisions 2026-08-10: double-payment = LAST PAYMENT WINS (never honor the older payment; never a 0-credit success receipt); apply all patches. Patches re-verified: 851 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations clean; FE 677 vitest / lint 0 / tsc 0 / check:i18n clean; review E2E on real PG16 18/18.

- [x] [Review][Decision][Patch] P1 — Double-payment policy (B1+E4): a distinct second PAID creation while ACTIVE was recorded succeeded/credits_granted=0 with a misleading success receipt. USER DECISION: don't honor the older payment — the LAST payment wins: the active row is re-anchored (period from now) and the fresh cycle granted with the no-rollover reset; no double-grant, no payment left un-granted, no 0-credit receipts anywhere. Same-event replays never reach the branch (ON CONFLICT + status-check guards). [backend/apps/billing/tasks.py] + test rewritten (`test_creation_with_active_subscription_last_payment_wins`).
- [x] [Review][Patch] P2 — Persist `chargily_subscription_id` (B2 first half): the webhook-shaped metadata now stores `subscription_id` (renewal payloads); the grant task persists it onto the subscription row (re-anchor/re-activate/create/orphan branches) — the recovery key for subscription-keyed payment_failed lookups when metadata.user_id is absent (the D11 envelope risk is now two-keyed instead of one-keyed). [backend/apps/billing/webhooks.py, backend/apps/billing/tasks.py] + tests (`test_renewal_persists_chargily_subscription_id`, metadata pins updated).
- [x] [Review][Patch] P3 — payment_failed subscription guard + fallback (B2 second half + B5 + E3): a stale payment_failed retry for a PREVIOUS Chargily subscription can no longer regress the fresh paid cycle (the UPDATE matches only the named subscription id, or legacy NULL-id rows); when metadata.user_id is absent, the Chargily subscription id is the fallback lookup key. [backend/apps/billing/webhooks.py] + 5 tests (`test_subscription_id_fallback_lookup`, `test_subscription_id_fallback_no_match_skips`, `test_stale_subscription_retry_does_not_flip_fresh_cycle`, `test_legacy_null_id_row_still_flips`, missing-metadata test updated to the no-key case).
- [x] [Review][Patch] P4 — Expiry task lock order + active-past-due coverage (B3 + E2): the task now locks the USER row first (the grant/reveal order — no ABBA deadlock cycle, no lost cache update vs concurrent reveals) and ALSO expires ACTIVE-past-due rows — a renewal that never lands (no card retry, no payment_failed event) must not leave the user permanently 409-blocked from re-subscribing. The late-renewal race lands on the documented orphan path (grants + creates). [backend/apps/billing/tasks.py] + tests (`test_active_past_due_subscription_is_expired`, `test_active_row_with_future_end_untouched`).
- [x] [Review][Patch] P5 — User deleted mid-flight settles immediately (B4): `select_for_update().get(pk=row.user_id)` DoesNotExist now settles the row as failed instead of burning the 3 AD-14 retries and looping the hourly sweep forever. [backend/apps/billing/tasks.py] + `test_user_deleted_mid_flight_settles_immediately`.
- [x] [Review][Patch] P6 — Sweep excludes pack rows (E5): 5.3's grant task cannot grant packs (5.4 owns pack semantics) — re-enqueueing them hourly was unbounded churn; they now wait in 'pending' for 5.4 (D16 amended accordingly). [backend/apps/billing/tasks.py] + `test_pack_rows_excluded_from_sweep`.
- [x] [Review][Patch] P7 — Receipt enqueue failure visibility (B7+E1): the on_commit callback now catches delay() failures with an ERROR log (the receipt can never be re-fired by the retry path — the status check early-returns — so a receipt-resend sweep for succeeded-no-receipt rows is recorded as a 5.4+ deliverable, D3 defer). [backend/apps/billing/tasks.py]
- [x] [Review][Patch] P8 — Deterministic plan-endpoint ordering (B9): `order_by('-created_at', '-id')` — two rows created in the same microsecond otherwise resolved nondeterministically (the test suite tripped this exact tie on Windows). [backend/apps/billing/views.py]
- [x] [Review][Patch] P9 — Receipt invalid-date guard (B12): an unparseable date fell back to `Intl.DateTimeFormat.format(Invalid Date)` → render-route 500 → lost email; now renders the raw string. [frontend/emails/components/PaymentReceipt.tsx] + test.
- [x] [Review][Defer] D1 — FREE_SIGNUP unlocked write races the grant's absolute cache set (B8): the 2.2 verify-email path writes `credits_balance += 15` with no row lock; interleaved with a grant it can leave the cache off the ledger by 15. PRE-EXISTING 2.2 code, out of 5.3's scope — recommendation recorded: lock the user row in the verify path. — deferred (deferred-work.md)
- [x] [Review][Defer] D2 — Chunked/missing Content-Length bypasses the webhook body cap (B10): pre-existing 5.2 residual; the real fix is a proxy-level `client_max_body_size` cap (nginx). — deferred to ops (deferred-work.md)
- [x] [Review][Defer] D3 — Receipt dedupe + resend sweep (B11 + P7 residual): `send_payment_receipt` is not idempotent (ambiguous SMTP failure → 1 retry → possible duplicate; exhausted retries → no re-send path; broker-down-at-commit → no receipt at all). A receipt-resend sweep for succeeded-no-receipt rows + a dedupe key is a 5.4+ deliverable. — deferred (deferred-work.md)
- [x] [Review][Dismiss] Sweep-never-rescues-succeeded rows (E1 second half): P7 makes the loss visible; the resend path is the D3 defer.
- [x] [Review][Dismiss] Receipt double-send bounded by AD-14 email policy (B11): 1 retry max — the documented policy; part of D3.

### Change Log (review additions)

- 2026-08-10: Full-mode code review (Blind Hunter 13 + Edge Case Hunter 6 + Acceptance Auditor — all ACs SATISFIED). Triage: 1 decision + 9 patches + 3 defers + 2 dismissed. User decisions: LAST-PAYMENT-WINS for the double-payment path; apply all patches. All 9 applied + re-verified: 851 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations clean; FE 677 vitest / lint 0 / tsc 0 / check:i18n clean; review E2E on real PG16 18/18 (re-anchor, sub-id persistence + fallback/guard, active-past-due expiry, 409-unblock, sweep pack exclusion); container removed. Status → done (sprint-status 5-3 → done; epic-5 stays in-progress). NOTE on commits: the review ran on the working tree BEFORE the story commit — implementation + review patches land in the story commit; the review-follow-up commit carries findings docs, defers, and status flips (the 5.2 precedent).
