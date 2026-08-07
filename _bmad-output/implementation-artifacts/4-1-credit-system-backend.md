---
story_id: 4.1
epic: 4
title: Story 4.1 — Credit System Backend
Status: done
frs: [FR-14, FR-15, FR-16]
ads: [AD-3, AD-4, AD-7, AD-8, AD-12]
baseline_commit: d4ecd52
---

# Story 4.1: Credit System Backend

Status: done

## Story

As a **developer**,
I want **the credit ledger table, atomic deduction logic (SERIALIZABLE), pool-based balance computation, and re-reveal idempotency**,
So that **credit metering is provably correct and auditable**.

## Acceptance Criteria

**Given** the `credit_ledger` table exists via migration
**When** I inspect the database
**Then** the table has: id, user_id, event_type (enum), amount, balance_after, pool ('subscription'/'pack'), reference_id, description, created_at
**And** `credit_event_type` enum includes: `free_signup`, `subscription_grant`, `pack_grant`, `promotional_grant`, `reveal_debit`, `export_row_debit`, `expiry`

**Given** the atomic debit function
**When** a reveal is requested for a user with sufficient balance
**Then** in a SERIALIZABLE transaction:
1. Balance is computed: `SELECT SUM(amount) FROM credit_ledger WHERE user_id = $1`
2. If balance < 1: ROLLBACK, return error
3. Drawdown pool = 'subscription' if subscription_balance ≥ 1, else 'pack'
4. INSERT into credit_ledger (event_type='reveal_debit', amount=-1, pool=computed_pool)
5. INSERT into reveals (user_id, record_type, record_id)
6. UPDATE users SET credits_balance = credits_balance - 1
7. RETURN contact data
**And** the balance is computed from the ledger, never from a denormalized column alone

**Given** the re-reveal idempotency check
**When** a user reveals a record they already revealed within the past 30 days
**Then** the system returns contact data WITHOUT deducting a credit
**And** inserts a reveal row with `was_free=TRUE`
**And** the initial results API returns `revealed: true` per row when a ≤30d reveal exists

**Given** the balance computation (read)
**When** a balance check is performed
**Then** the SQL computes:
- subscription_balance = SUM(amount) WHERE pool='subscription'
- pack_balance = SUM(amount) WHERE pool='pack'
- display_balance = subscription_balance + pack_balance

**Given** the `reveals` table
**When** a reveal occurs
**Then** a row is inserted with: id, user_id, record_type (people/company), record_id, credit_cost (default 1), was_free (boolean), created_at
**And** a unique partial index exists: `(user_id, record_type, record_id) WHERE was_free = FALSE` for idempotency lookup

**Given** the `users.credits_balance` cache
**When** a ledger insert occurs
**Then** `users.credits_balance` is updated atomically in the same transaction
**And** on any audit, the ledger is queried directly (the source of truth)

## Tasks / Subtasks

- [x] **Task 1: Models — `CreditLedger` + `Reveal` in `apps/credits` + 0001 migration** (ACs: ledger table + enum, reveals table + partial index)
  - [x] 1.1 RED: `backend/apps/credits/tests/test_models.py` — NEW — schema tests (the 3.7 `test_checklist.py` TestSchema precedent — `connection.introspection.get_table_description` + `_meta.get_field`):
    - `credit_ledger` table columns: id, user_id, event_type, amount, balance_after, pool, reference_id, description, created_at.
    - `credit_event_type` values (assert via the model field `choices` + a DB-level CHECK constraint name — see Dev Notes D3): free_signup, subscription_grant, pack_grant, promotional_grant, reveal_debit, export_row_debit, expiry.
    - `pool` DB CHECK allows only 'subscription'/'pack', default 'subscription' (spine DDL).
    - **`CreditLedger.user` FK is `null=True, on_delete=SET_NULL`** (Dev Notes D1 — the 2.6 account-deletion contract; `_meta.get_field('user').null is True`, `remote_field.on_delete is SET_NULL`).
    - `reveals` table columns: id, user_id, record_type, record_id, credit_cost (default 1), was_free (default False), created_at; record_type CHECK allows 'people'/'company'.
    - `Reveal.user` FK `on_delete=CASCADE` (Dev Notes D2).
    - Partial unique index `(user_id, record_type, record_id) WHERE was_free = FALSE` exists (spine `idx_reveals_user_record`) — assert via `connection.introspection.get_constraints(cursor, 'reveals')` (SQLite exposes partial index names) or the model Meta constraint presence.
    - `Reveal` model is importable as `apps.credits.Reveal` and `CreditLedger` as `apps.credits.CreditLedger` — the `maintenance_tasks.py` guarded lookups (Dev Notes D13) depend on these exact labels.
  - [x] 1.2 GREEN: `backend/apps/credits/models.py` — NEW — `CreditEventType(models.TextChoices)` with the 7 AC values; `CreditLedger(models.Model)` (`db_table='credit_ledger'`): `user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='credit_ledger')` (D1), `event_type` (TextChoices), `amount = models.IntegerField()`, `balance_after = models.IntegerField()`, `pool` (TextChoices `CreditPool` 'subscription'/'pack', default 'subscription'), `reference_id = models.TextField(null=True, blank=True)`, `description = models.TextField(null=True, blank=True)`, `created_at = models.DateTimeField(default=timezone.now)`; Meta constraints: CheckConstraint `event_type IN (...)` (the 7 values), CheckConstraint `pool IN ('subscription','pack')`; `Reveal(models.Model)` (`db_table='reveals'`): `user` FK CASCADE `related_name='reveals'`, `record_type` TextChoices ('people'/'company') + CheckConstraint, `record_id = models.TextField()` (D8 — stringified UUID of the people/companies PK), `credit_cost = models.IntegerField(default=1)`, `was_free = models.BooleanField(default=False)`, `created_at = models.DateTimeField(default=timezone.now)`; Meta constraints: CheckConstraint record_type + `models.UniqueConstraint(fields=['user','record_type','record_id'], condition=Q(was_free=False), name='reveals_user_record_paid_unique')` — the partial index; ordering `['-created_at']`.
  - [x] 1.3 GREEN: run `makemigrations credits` → `0001_initial.py` (verify no model drift); migration must be SQLite-runnable (CheckConstraints, no PG-only DDL — D3).
  - [x] 1.4 Run backend gates (pytest/ruff/mypy strict) — green.

- [x] **Task 2: Reveal service — atomic debit (SERIALIZABLE) + re-reveal idempotency** (AC: atomic debit + balance-from-ledger + re-reveal; FR-14; spine 635-664)
  - [x] 2.1 RED: `backend/apps/credits/tests/test_reveal.py` — NEW — unit suite (`pytestmark = pytest.mark.django_db`; fixtures: `create_user` (conftest), a `Person` + a `Company` row; helper `grant(user, amount, pool='subscription')` writing a ledger row directly):
    - **paid debit**: user with ledger total 3 → `reveal_contact(user, 'people', person_id)` returns the contact dict; exactly one new ledger row `event_type='reveal_debit'`, `amount=-1`, `pool='subscription'`, `balance_after=2`; one `Reveal` row `credit_cost=1`, `was_free=False`; `user.credits_balance == 2` (cache decremented in the same transaction).
    - **drawdown subscription-first (AD-7)**: subscription=3 + pack=5 → pool='subscription'; subscription=0 + pack=5 → pool='pack'.
    - **insufficient balance**: ledger total 0 → raises `InsufficientCredits` (custom exception); NO ledger row, NO reveal row, cache unchanged.
    - **balance-from-ledger, never the cache (the AC's critical line)**: user with `credits_balance=5` cache but EMPTY ledger → debit FAILS (`InsufficientCredits`) — the denormalized column alone is never the source (AD-4).
    - **SERIALIZABLE block**: the debit runs inside `transaction.atomic()` with a vendor-guarded `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` (D7) — assert the guard emits the statement on PostgreSQL and is a no-op on SQLite (the 3.1 vendor-guard precedent; test via a spy on the cursor execute or by asserting the service returns correctly under SQLite).
    - **re-reveal free (30d window)**: after a paid reveal, a second `reveal_contact` for the SAME record → returns contact data, NO new reveal_debit row, one NEW `Reveal` row `was_free=True` (AC literal — D9), cache unchanged (no second -1).
    - **re-reveal outside 30d window**: paid reveal created 31 days ago (freeze `created_at` via `Reveal.objects.filter(...).update(created_at=...)`) → a new call DEBITS again (paid, was_free=False).
    - **boundary**: reveal exactly 30 days old counts as within-window (`created_at >= now - 30 days` — document in Dev Notes).
    - **free re-reveal of a free re-reveal**: three calls in a row → one paid row + two free rows; only one credit ever spent.
    - **record not found**: unknown record_id → raises `RevealRecordNotFound`; nothing written.
    - **contact data shape**: people → dict with name/role/company_name/email/phone/address; company → dict with name/industry/website/wilaya_code/size_band (the 4.2 reveal surface contract).
  - [x] 2.2 GREEN: `backend/apps/credits/services.py` — NEW — `class InsufficientCredits(Exception)`, `class RevealRecordNotFound(Exception)`, `def reveal_contact(user, record_type, record_id)`:
    - resolve the record (people/company by record_type; raise `RevealRecordNotFound` if missing) — contact dict built from the row.
    - idempotency pre-check (the ≤30d EXISTS — spine 655-664) INSIDE the transaction: `Reveal.objects.filter(user_id=user.id, record_type=..., record_id=..., created_at__gte=now - timedelta(days=30)).exists()` → if yes: create `Reveal(was_free=True)` row and return contact data — NO debit.
    - paid path: `with transaction.atomic():` + vendor-guarded `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` (D7 — `cursor.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')` only when `connection.vendor == 'postgresql'`, and it must run before any query in the transaction — use `transaction.atomic()` then set isolation immediately); ledger sums via `CreditLedger.objects.filter(user_id=...).aggregate(Sum('amount'))`; `subscription_balance`/`pack_balance` via `Sum('amount', filter=Q(pool='subscription'))` (SQLite-compatible); total < 1 → raise `InsufficientCredits` (nothing written — the exception unwinds the atomic block); pool = subscription if sub ≥ 1 else pack; `balance_after = total + amount`; create ledger row (`event_type='reveal_debit'`, `amount=-1`, `pool`, `balance_after`, `reference_id=str(reveal_id)`); create `Reveal` row (paid); `User.objects.filter(pk=user.id).update(credits_balance=F('credits_balance') - 1)`; refresh `user.credits_balance`; return contact dict.
  - [x] 2.3 Run backend gates — green.

- [x] **Task 3: Balance read computation — pool-based** (AC: balance computation; spine 670-678)
  - [x] 3.1 RED: `backend/apps/credits/tests/test_balance.py` — NEW — `user_balances(user)` returns `{'subscription_balance': int, 'pack_balance': int, 'display_balance': int}`:
    - empty ledger → all zero (COALESCE semantics).
    - only subscription rows (+3, -1) → sub=2, pack=0, display=2.
    - only pack rows (+10, -4) → sub=0, pack=6, display=6.
    - mixed (+15 sub, +10 pack, -1 sub, -2 pack) → sub=14, pack=8, display=22.
    - balance_after on the LAST row equals display_balance (reconciliation invariant — ledger audit AC).
    - a user's rows never leak into another user's balances (two users, distinct sums).
  - [x] 3.2 GREEN: `backend/apps/credits/services.py` — UPDATE — `user_balances(user) -> dict[str, int]`: two `Sum('amount', filter=Q(pool=...))` aggregates from the ledger (NEVER `credits_balance`) + display sum. (4.3 consumes this for the pill/ledger page; FR-15.)
  - [x] 3.3 Run backend gates — green.

- [x] **Task 4: Signup free-credit ledger row + backfill migration** (AC: every ledger insert updates the cache; closes the 2.2 defer; AD-4 source of truth)
  - [x] 4.1 RED: `backend/apps/credits/tests/test_signup_ledger.py` — NEW — (the accounts `test_verify_email.py` precedent):
    - **verify → grant + ledger row**: unverified user POSTs the verify email flow → `credits_balance == 15` AND exactly one `CreditLedger` row `event_type='free_signup'`, `amount=15`, `balance_after=15`, `pool='subscription'` (D5), `user_id` set.
    - **no double grant**: verifying twice (idempotent verify) → still exactly one ledger row.
    - **unverified signup**: plain signup without verification → NO ledger row, cache stays 0 (grant happens only at verification — current behavior preserved).
    - **reconciliation invariant**: after verify, `display_balance` (Task 3) == `credits_balance` == 15.
  - [x] 4.2 GREEN: `backend/apps/accounts/views/auth.py` — UPDATE — inside the existing verify-email grant branch (line ~247): wrap the grant in `transaction.atomic()` and create the `free_signup` ledger row (amount 15, balance_after 15, pool 'subscription') in the SAME transaction as `credits_balance += 15` (the AC: cache updated atomically with every ledger insert; no more cache-only grants).
  - [x] 4.3 GREEN: `backend/apps/credits/migrations/0002_backfill_free_signup_ledger.py` — NEW — `RunPython` (SQLite-safe, pure ORM): for every user with `credits_balance > 0` and NO existing `credit_ledger` rows, insert one `free_signup` row (amount=15, balance_after=15, pool='subscription', description='Free signup credits (backfill)'). Reverse = removes exactly the backfill-marked rows (reversible — better than a no-op).
  - [x] 4.4 Run backend gates — green.

- [x] **Task 5: Search results `revealed` flag (≤30d EXISTS)** (AC: results API returns `revealed: true` per row; closes the 3-2 placeholder; spine 664)
  - [x] 5.1 RED: `backend/apps/search/tests/test_revealed_flag.py` — NEW — (the `test_people_search.py`/`test_company_search.py` fixtures precedent — authenticated client + seeded Person/Company):
    - **people**: a person with a ≤30d reveal → `revealed: true` in `GET /api/search/people/`; a person with no reveal → `false`.
    - **30d window**: reveal `created_at` frozen 31 days ago → `revealed: false`.
    - **free re-reveal rows count**: a was_free=True reveal (no paid) → still `revealed: true` (any ≤30d reveal counts — D9 semantics).
    - **per-user isolation**: user A's reveal does not flag the row for user B.
    - **companies**: company rows now carry `revealed` (D10) — `true` with a ≤30d company reveal, `false` otherwise.
    - **pagination**: revealed flags correct on page 2 (the IN set is per-page, not global).
  - [x] 5.2 GREEN: `backend/apps/search/views.py` — UPDATE — in `PeopleSearchView.get` and `CompanySearchView.get`: after building `rows`, compute the revealed set in ONE query: `Reveal.objects.filter(user_id=request.user.id, record_type='people', created_at__gte=now - timedelta(days=30), record_id__in=[str(r.id) for r in rows]).values_list('record_id', flat=True)` → pass to `_people_row`/`_company_row` (add a `revealed_ids` parameter; replace the literal `'revealed': False` at views.py:128 with the membership lookup; add `'revealed': ...` to `_company_row` — D10).
  - [x] 5.3 Run backend gates — green.

- [x] **Task 6: Checklist `step_reveal` EXISTS extension** (the 3-7 documented Epic-4 event contract — deferred-work.md; views.py:290-295)
  - [x] 6.1 RED: `backend/apps/search/tests/test_checklist.py` — UPDATE — `TestGet`: after a reveal row exists for the user, `GET /api/search/checklist/` → `step_reveal: true`; `step_export` STILL `false` (the exports table does not exist until 4.4 — the contract splits); a fresh user → `step_reveal: false`; cumulative first-EVER semantics (a 10-day-old reveal still → true — the John PM2 pattern from 3.7 applies to reveals).
  - [x] 6.2 GREEN: `backend/apps/search/views.py` — UPDATE — `ChecklistView._state`: replace the literal `'step_reveal': False` with `Reveal.objects.filter(user_id=request.user.id).exists()` (cumulative, no window — first-ever reveal; the checkbox is a journey step, not a metering window); keep `step_export` False with the updated comment (exports land in 4.4).
  - [x] 6.3 Run backend gates — green.

- [x] **Task 7: Read-only admin for `CreditLedger` + `Reveal`** (audit AC — "on any audit, the ledger is queried directly"; ops visibility precedent 3.7 Task 1.3)
  - [x] 7.1 RED: `backend/apps/credits/tests/test_admin.py` — NEW — `admin.site.get_model_admin`/`_get_admin` lookups: `CreditLedgerAdmin` and `RevealAdmin` registered; both `readonly_fields` cover every model field (no in-place admin edits — the ledger is append-only by design); `list_display` includes user/event_type/amount/balance_after/pool/created_at.
  - [x] 7.2 GREEN: `backend/apps/credits/admin.py` — NEW — read-only admins (`list_display` + `readonly_fields = [all fields]` + `has_add_permission`/`has_change_permission`/`has_delete_permission` → False — append-only audit surface).
  - [x] 7.3 Run backend gates — green.

- [x] **Task 8: Real-stack verification (docker PG16) + full regression** (the 3.1/3.6/3.7 real-PG precedent)
  - [x] 8.1 Docker stack up (PG16) → `migrate` applies `credits` 0001/0002 cleanly → `psql` assertions: `credit_ledger` + `reveals` tables exist; `credit_event_type`/`pool` CHECK constraints enforced (insert an invalid pool → rejected); the partial unique index `(user_id, record_type, record_id) WHERE was_free=FALSE` exists and rejects a duplicate PAID reveal while allowing a `was_free=TRUE` twin (D9).
  - [x] 8.2 Concurrency proof on PG: user with exactly 1 credit → two parallel `reveal_contact` calls (two shell processes) on the SAME record → exactly ONE succeeds with a paid row; the other either raises `InsufficientCredits` or lands the free re-reveal; final state: ledger sum == cache == 0, one reveal_debit row, no negative balance. (The SERIALIZABLE guarantee — D7.)
  - [x] 8.3 Full regression: `pytest` (all apps), `ruff`, `mypy` strict — green; frontend gates `vitest run` + `lint` + `typecheck` + `check:i18n` — green (no FE changes expected — 4.1 is backend-only; 4.2 owns the reveal UI).

## Dev Notes

- **Source of truth — the planning spec**: `_bmad-output/planning-artifacts/epics/epic-04-reveal-credit-export/story-01-credit-system-backend.md` (all 6 ACs verbatim in this story). FR-14/15/16 details in `_bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L125-153`.
- **Spine refs**: users DDL (incl. `credits_balance`) `docs/ARCHITECTURE-SPINE.md#L135-147`; credit_ledger DDL `#L149-160`; reveals DDL + partial index `#L212-223`; credit event enum `#L127-129`; Atomic Debit `#L637-653`; Re-Reveal Idempotency `#L655-664`; Balance Computation `#L670-678`; AD-3 (PG single store, SERIALIZABLE payments/credits) + AD-4 (balance computed from ledger, `credits_balance` is transactional cache) `#L865-866`; AD-7 subscription-first drawdown `#L678`.
- **Prior-story contracts this story closes**:
  - 2.2 (`2-2-signup-free-credits.md`): the `free_signup` ledger row was DEFERRED to 4.1 — Task 4 wires it + backfills.
  - 2.6 (`2-6-account-deletion.md`): **`CreditLedger.user` FK must be `null=True, on_delete=SET_NULL`** — Task 1 D1 (this is why the spine's NOT NULL DDL is deviated from).
  - 3-2 (`3-2-search-api-endpoints.md` decision 6): `revealed: False` constant placeholder — Task 5 replaces it.
  - 3-7 (`3-7-checklist-card.md` D4 + `deferred-work.md`): the step-2/step-3 Epic-4 event contract — backend EXISTS extension — Task 6 delivers the step_reveal half; step_export stays False (4.4 owns exports).
  - `backend/tasks/maintenance_tasks.py:12-19,65-82`: guarded lookups `apps.get_model('credits', 'CreditLedger')` + `('credits', 'Reveal')` and the `user_id=None` anonymisation — the model labels and null-able FK are non-negotiable (D13).
- **Decisions (recorded for the review):**
  - D1: `CreditLedger.user` = `null=True, blank=True, on_delete=SET_NULL` — required by the 2.6/`maintenance_tasks.py` anonymisation (sets `user_id=None` before user delete, 90-day purge for anonymised rows). Documented deviation from spine `NOT NULL REFERENCES users(id)`.
  - D2: `Reveal.user` = CASCADE (spine reveals DDL; `maintenance_tasks.py` deletes dependent rows BEFORE `user.delete()` — no SET_NULL needed).
  - D3: event_type/pool enforced via Django TextChoices + CheckConstraint (runs on BOTH SQLite test DB and PG16 — the spine's `CREATE TYPE credit_event_type` is PG-only; the 3.1 vendor-guard precedent applies only where SQLite cannot express the constraint; here it can).
  - D4: `record_id = TextField` storing `str(uuid)` of the people/companies PK (spine DDL `TEXT`; search models use UUIDField PKs — `backend/apps/search/models.py:66,103`).
  - D5: `free_signup` pool = 'subscription' (spine pool default + AD-7 subscription-first drawdown — free credits are account-level grants like subscription grants).
  - D6: `balance_after` = post-event running total computed inside the transaction (AC-literal column; the reconciliation invariant — last `balance_after` == `display_balance`).
  - D7: SERIALIZABLE — `transaction.atomic()` + vendor-guarded `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` (PG only; SQLite unit tests validate logic, Task 8.2 proves isolation on real PG16 — the 3.1 vendor-guard precedent). The isolation statement must be the FIRST query in the transaction.
  - D8: re-reveal inserts a NEW `was_free=True` row (AC literal) — the partial unique index dedupes only PAID rows, free rows accumulate; the 30d window check uses `created_at >= now - 30 days` (boundary inclusive).
  - D9: the ≤30d EXISTS counts ANY reveal row (paid or free) — a free re-reveal still flags `revealed: true`; a fresh reveal after 31 days becomes paid again.
  - D10: company rows GAIN a `revealed` key (people rows already have it) — computed with the same ≤30d EXISTS; the 3.5 companies column set does not render it (harmless, contract-ready for 4.2).
  - D11: checklist `step_reveal` = cumulative EXISTS over ALL reveal rows (first-ever semantics — the John PM2 pattern from 3.7; no 30d window for the journey step).
  - D12: backfill migration inserts `free_signup` rows (15/15/subscription) for users with `credits_balance > 0` and no ledger rows — restores AD-4 source-of-truth for the 2.2-era signups.
  - D13: model labels `apps.credits.CreditLedger` + `apps.credits.Reveal` are pinned by `maintenance_tasks.py` guarded lookups — never rename.
  - D14: **rolling 30-day window** — the AC set forces it: (a) re-reveals within 30 days are free (FR-14 consequence "within 30 days"), (b) after 30 days the reveal must cost again (the results-API flag flips to false), and (c) the partial unique index allows exactly ONE paid row per (user, record, type) forever. A paid reveal after the window therefore RENEWS the existing paid row's `created_at` (each charge buys 30 more days — "limits over-charging" per the PRD constraint) instead of inserting a second paid row. Any reveal row (paid OR free) anchors the window (AC: "already revealed within the past 30 days" — so a user who re-reveals every <30 days is never re-charged; the renewal branch fires only after a 30-day access gap). Boundary is inclusive (`created_at >= now - 30 days`).
- **Out of scope (handoff)**: POST /api/reveal + reveal UI = story 4.2; credits pill + /credits ledger page = 4.3; exports + export_row_debit = 4.4; contact-data encryption at rest (3.1 decision 7: "encryption belongs to the Epic 4 reveal surface") is NOT in the 4.1 ACs — raise it when 4.2 ships the reveal surface; `subscription_grant`/`pack_grant`/`promotional_grant`/`expiry` events are used by Epic 5 — the enum values exist now, the writers land later.
- **Testing standards**: pytest + `django_db`; the `test_migrations`/`test_checklist.py` TestSchema precedent for schema assertions; the `search_session` fixture pattern for authenticated API tests; vendor-guarded PG DDL; real-stack E2E on docker PG16 (docker-compose.yml); gates = backend `pytest` + `ruff` + `mypy` (strict, pyproject.toml) and frontend `vitest run` + `lint` + `typecheck` + `check:i18n` (frontend/package.json) — run ALL gates after EVERY task.

## Dev Agent Record

### Agent Model Used

opencode-go/deepseek-v4-flash

### Debug Log References

- RED runs: test_models.py failed collection (no models module); test_reveal.py failed collection (no services module); test_signup_ledger.py 3 ledger tests failed (no ledger row); backfill tests failed (no 0002 migration); test_admin.py failed collection (no admin module); test_revealed_flag.py 6 failed (company rows had no `revealed` key, people rows hard-coded False); test_checklist.py 2 new tests failed (step_reveal hard-coded False).
- Test-only fixes during GREEN: partial-index test asserted list vs tuple fields; user_with fixture synced the cache column with ledger grants; reveal test asserted `event_type='reveal_debit'` counts (not total); boundary tests use ±1s epsilon backdating (deterministic); shared api_client re-login in the cross-user test replaced with a fresh Client; company row-shape test updated for the new `revealed` key; test_admin import order fixed by ruff.
- N818: exceptions renamed to `InsufficientCreditsError` / `RevealRecordNotFoundError`; TextChoices member comparisons replaced with literal strings (mypy strict — Django stub limitation; matches quota.py/views.py convention).
- E2E (docker PG16): migrations applied; psql schema + CHECK + partial-index assertions; backfill created 7 free_signup rows for pre-ledger users on the real DB; concurrency race (2 parallel reveals, 1 credit) → OUTCOME OK/OK, `debits=1 ledger=0 cache=0 paid=1 free=1`; E2E rows cleaned.

### Completion Notes List

- Story 4.1 implemented end-to-end (TDD red→green for every task): credit_ledger + reveals models with DB-level CHECKs and the partial unique index (0001), atomic SERIALIZABLE reveal debit with subscription-first drawdown + ledger-only balance + re-reveal idempotency (rolling 30-day window, paid-row renewal — D14), pool-based balance reads, free_signup ledger row in the verify flow + backfill migration (0002, 7 real rows), search-results `revealed` flag (people + company), checklist step_reveal EXISTS extension, read-only append-only admins.
- Gates: backend 484 pytest / ruff 0 / mypy strict 0; frontend 482 vitest / lint 0 / typecheck 0 / check:i18n ✓. Real-stack verified on PG16 (schema, constraints, concurrency invariants).

### File List

- `backend/apps/credits/models.py` (NEW)
- `backend/apps/credits/services.py` (NEW)
- `backend/apps/credits/admin.py` (NEW)
- `backend/apps/credits/migrations/0001_initial.py` (NEW)
- `backend/apps/credits/migrations/0002_backfill_free_signup_ledger.py` (NEW)
- `backend/apps/credits/migrations/0003_creditledger_credit_ledger_user_created_idx_and_more.py` (NEW — review patch)
- `backend/apps/credits/tests/__init__.py` (NEW)
- `backend/apps/credits/tests/test_models.py` (NEW)
- `backend/apps/credits/tests/test_reveal.py` (NEW)
- `backend/apps/credits/tests/test_balance.py` (NEW)
- `backend/apps/credits/tests/test_signup_ledger.py` (NEW)
- `backend/apps/credits/tests/test_admin.py` (NEW)
- `backend/apps/accounts/views/auth.py` (MODIFIED — free_signup ledger row in the verify grant)
- `backend/apps/accounts/admin.py` (MODIFIED — review patch: credits_balance read-only)
- `backend/apps/search/views.py` (MODIFIED — revealed flags + checklist step_reveal EXISTS)
- `backend/apps/search/tests/test_revealed_flag.py` (NEW)
- `backend/apps/search/tests/test_checklist.py` (MODIFIED — step_reveal suite, contract split)
- `backend/apps/search/tests/test_company_search.py` (MODIFIED — row shape + `revealed`)

### Change Log

- 2026-08-06: Story created (ready-for-dev) from the epic 4.1 planning spec; sprint-status 4-1 → ready-for-dev (epic-4 → in-progress).
- 2026-08-07: Implemented (TDD) — Task 1 models+migration, Task 2 atomic debit + idempotency (D14 rolling window), Task 3 balance reads, Task 4 signup ledger row + backfill, Task 5 revealed flag, Task 6 checklist step_reveal, Task 7 read-only admins, Task 8 real-PG16 verification + full regression. 484 backend / 482 FE gates green. Status → review (sprint-status 4-1 → review).
- 2026-08-07: Code review (full mode — Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor: clean. Blind Hunter: 8 findings. Edge Case Hunter: 11 findings. Triage: 5 patch (concurrency lock, invariant-restoring backfill, record_id canonicalization + unparseable-UUID guard, credits_balance read-only in User admin, composite indexes) + 1 defer (SERIALIZABLE-under-composition) + 5 dismissed (AC-literal window anchoring, in-memory cache mutation, verify-drift assert folded into patches, frozen migration constant, deleted-user policy in 4.2 views). All patches applied; gates re-run green (489 backend / 482 FE); PG16 concurrency race re-verified with the lock (debits=1 ledger=0 cache=0 paid=1 free=1).
- 2026-08-07: Review resolved — all patch findings applied, defer recorded in deferred-work.md, gates fully green; Status → done (sprint-status 4-1 → done, epic-4 stays in-progress).

### Review Findings

- [x] [Review][Patch] Concurrent reveal race → unhandled IntegrityError/serialization-failure (500) + renewal double-charge + stale balance_after [backend/apps/credits/services.py:106-116] — fixed: user-row `select_for_update().get(pk=user.id)` immediately after the SERIALIZABLE guard (the 3.6 saved-search-cap precedent); per-user mutation serialization works on ANY isolation level (SQLite tests included); concurrent same-record reveals now deterministically resolve to paid+free; concurrent different-record debits get correct running balance_after; regression covered by E2E race re-run (1 credit → paid=1 free=1, no negative balance).
- [x] [Review][Patch] Backfill hardcoded 15 → double-grant for spent users + skipped users with unrelated ledger rows → permanent ledger↔cache drift [backend/apps/credits/migrations/0002_backfill_free_signup_ledger.py] — fixed: per-user reconciliation — amount = `credits_balance − ledger_sum` (skip when ≤ 0), balance_after = credits_balance; exclusion now by `credit_ledger__event_type='free_signup'`; 4 new tests (spent user, promo-gap user, covered user, existing-row skip).
- [x] [Review][Patch] Non-canonical record_id stored verbatim → duplicate paid rows per casing variant, false `revealed` flag, re-charge; unparseable UUID → 500 [backend/apps/credits/services.py:84-103] — fixed: `record_id = str(record.id)` canonicalization after lookup + (ValueError/TypeError/ValidationError) guard → `RevealRecordNotFoundError`; tests for uppercase/braced forms (1 paid + 1 free, single debit) and garbage input (no crash, nothing written).
- [x] [Review][Patch] User admin still edits `credits_balance` — the drift source that makes the ledger untrustworthy [backend/apps/accounts/admin.py] — fixed: `credits_balance` moved to `readonly_fields` (corrections go through the append-only ledger admin).
- [x] [Review][Patch] Window EXISTS + admin changelist lack supporting indexes [backend/apps/credits/models.py] — fixed: `credit_ledger_user_created_idx` (user, created_at) + `reveals_user_type_created_idx` (user, record_type, created_at) — migration 0003, applied on PG16.
- [x] [Review][Defer] SERIALIZABLE guard breaks under outer-`transaction.atomic()` composition (SET TRANSACTION must be the first statement) [backend/apps/credits/services.py:36-46] — deferred, pre-existing design contract: 4.2 must call `reveal_contact` directly (never inside an outer atomic block); the per-user lock now carries the correctness load, so the guard is defense-in-depth, not the single point of failure.
- [x] [Review][Dismissed] Free re-reveal rows anchor the 30-day window → active users may never re-pay (renewal fires only after 30-day silence) — AC-literal ("already revealed within the past 30 days" counts ANY reveal row; D14 documents); unbounded free-row growth is AC-mandated.
- [x] [Review][Dismissed] In-memory `user.credits_balance -= 1` on possibly stale instances — keeps the passed instance consistent with the DB update in the same request; tests assert on refreshed values; removing it would leave callers with a MORE stale cache.
- [x] [Review][Dismissed] Verify-grant invariant assert (current == credits_balance − 15) — an assert would 500 signups with pre-existing drift; the drift sources are closed by the backfill reconciliation + admin read-only patches.
- [x] [Review][Dismissed] Duplicated FREE_SIGNUP_CREDITS constant in the migration — a migration is a frozen historical snapshot by design; its values must not track live code.
- [x] [Review][Dismissed] Soft-deleted (grace-period) users could reveal — sessions are already blocked at login/refresh (accounts/auth.py); the reveal view (4.2) is the policy layer for API-level enforcement.
