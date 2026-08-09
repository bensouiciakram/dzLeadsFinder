---
story_id: 5.1
epic: 5
title: Story 5.1 — Billing Database Schema
Status: review
frs: [FR-24, FR-25, FR-26, FR-27]
ads: [AD-3, AD-5]
baseline_commit: 2a29145
---

# Story 5.1: Billing Database Schema

Status: review

## Story

As a **developer**,
I want **PostgreSQL tables for subscriptions, payment transactions, and Chargily webhook idempotency created via Django migrations**,
So that **the billing subsystem has a reliable data foundation**.

## Acceptance Criteria

**Given** the migrations run
**When** I inspect the database
**Then** these tables exist:

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'failed_renewal', 'cancelled', 'expired');

CREATE TABLE subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES users(id),
  tier                        user_tier NOT NULL DEFAULT 'starter',
  status                      subscription_status NOT NULL DEFAULT 'active',
  current_period_start        TIMESTAMPTZ NOT NULL,
  current_period_end          TIMESTAMPTZ NOT NULL,
  chargily_subscription_id    TEXT,
  cancelled_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE payment_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  chargily_event_id       TEXT UNIQUE NOT NULL,
  type                    TEXT NOT NULL CHECK (type IN ('subscription_creation', 'subscription_renewal', 'pack_purchase')),
  amount_dzd              INTEGER NOT NULL,
  status                  payment_status NOT NULL DEFAULT 'pending',
  credits_granted         INTEGER,
  chargily_checkout_url   TEXT,
  chargily_metadata       JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at           TIMESTAMPTZ
);
```

**Given** the idempotency constraint
**When** a Chargily webhook with a duplicate `chargily_event_id` arrives
**Then** `INSERT ... ON CONFLICT (chargily_event_id) DO NOTHING` prevents duplicate processing
**And** the webhook returns 200 without granting credits twice

**Given** the billing API endpoints
**When** I inspect the routes
**Then** these exist:
- `GET /api/billing/plan/` — current plan + renewal date
- `GET /api/billing/packs/` — available add-on packs
- `POST /api/billing/create-checkout/` — Chargily redirect URL
- `GET /api/billing/status/{txnId}/` — payment polling

## Tasks / Subtasks

- [x] **Task 1: Models — `Subscription` + `PaymentTransaction` in `apps/billing` + 0001 migration** (AC: both tables; contracts: AC DDL exact, user_tier reuse, SQLite-runnable DDL, maintenance_tasks.py labels)
  - [x] 1.1 RED: `backend/apps/billing/tests/test_models.py` — NEW — schema tests (the 4.1 `test_models.py` TestSchema precedent — `connection.introspection.get_table_description` + `_meta.get_field`):
    - `subscriptions` table columns: id (UUID PK), user_id, tier, status, current_period_start, current_period_end, chargily_subscription_id, cancelled_at, created_at.
    - `payment_transactions` table columns: id (UUID PK), user_id, chargily_event_id, type, amount_dzd, status, credits_granted, chargily_checkout_url, chargily_metadata, created_at, reconciled_at.
    - `subscription_status` values via the model field `choices` + a DB-level CHECK: active, failed_renewal, cancelled, expired; default 'active'.
    - `payment_status` values: pending, succeeded, failed, refunded; default 'pending'.
    - `type` DB CHECK allows only 'subscription_creation'/'subscription_renewal'/'pack_purchase'.
    - `tier` reuses the accounts `TIER_CHOICES` ('free'/'starter'), default 'starter' — never a re-created enum.
    - `chargily_event_id` is unique + NOT NULL (the idempotency guard — assert via `_meta.get_field('chargily_event_id').unique` and DB constraint introspection).
    - the `payment_transactions` composite index `(user, created_at DESC)` exists (Winston consultation item 6 — the 5.5 payment-history surface; 4.1 `credit_ledger_user_created_idx` precedent) — assert via the model Meta `indexes` presence, name `payments_user_created_idx` (Django's 30-char index-name limit).
    - `Subscription.user` / `PaymentTransaction.user` FK → `settings.AUTH_USER_MODEL` (users table); on_delete consistent with the `maintenance_tasks.py` hard-delete contract (D2).
    - nullable columns: chargily_subscription_id, cancelled_at, credits_granted, chargily_checkout_url, chargily_metadata, reconciled_at.
    - NOT NULL columns: user_id, tier, status, current_period_start, current_period_end, chargily_event_id, type, amount_dzd, status, created_at.
    - model labels importable as `apps.billing.Subscription` / `apps.billing.PaymentTransaction` (the `maintenance_tasks.py` guarded lookups — D1).
  - [x] 1.2 GREEN: `backend/apps/billing/models.py` — NEW — `SubscriptionStatus`/`PaymentStatus`/`PaymentType` TextChoices; `Subscription(models.Model)` (`db_table='subscriptions'`): UUID PK `default=uuid.uuid4`, `user` FK CASCADE `related_name='subscriptions'`, `tier` (choices=TIER_CHOICES imported from `apps.accounts.models`, default 'starter'), `status` (SubscriptionStatus, default 'active'), `current_period_start`/`current_period_end` (DateTimeField), `chargily_subscription_id` (TextField null/blank), `cancelled_at` (DateTimeField null/blank), `created_at` (default timezone.now); Meta: CheckConstraints for status + tier, ordering `['-created_at']`; `PaymentTransaction(models.Model)` (`db_table='payment_transactions'`): UUID PK, `user` FK CASCADE `related_name='payment_transactions'`, `chargily_event_id` (TextField unique), `type` (PaymentType + CheckConstraint), `amount_dzd` (IntegerField), `status` (PaymentStatus default 'pending'), `credits_granted` (IntegerField null/blank), `chargily_checkout_url` (TextField null/blank), `chargily_metadata` (JSONField null/blank), `created_at`, `reconciled_at` (DateTimeField null/blank); Meta: CheckConstraints, `Index(fields=['user', '-created_at'], name='payments_user_created_idx')` (Winston consultation item 6 — 30-char Django limit), ordering `['-created_at']`; `__str__` on both.
  - [x] 1.3 GREEN: run `makemigrations billing` → `0001_initial.py` (verify no model drift); migration must be SQLite-runnable (CheckConstraints, no PG-only DDL — the 4.1 D3 precedent).
  - [x] 1.4 Run backend gates (pytest/ruff/mypy strict/manage.py check/makemigrations --check) — green.

- [x] **Task 2: Idempotency semantics — ON CONFLICT guard** (AC: duplicate chargily_event_id → no second row, no double grant; FR-27; AD-5)
  - [x] 2.1 RED: `backend/apps/billing/tests/test_idempotency.py` — NEW — module-level `pytestmark = pytest.mark.django_db`; fixtures: the conftest `create_user`; local `txn(user, event_id)` helper:
    - **duplicate create raises**: two `PaymentTransaction.objects.create` with the same `chargily_event_id` → second raises `IntegrityError` (the DB is the guard).
    - **ON CONFLICT DO NOTHING**: `PaymentTransaction.objects.bulk_create([...], ignore_conflicts=True)` with duplicate event ids → exactly ONE row survives, and a pinned `PaymentTransaction.objects.count()` assert (the Winston guard: surprising conflicts surface instead of vanishing silently).
    - **duplicate never double-grants**: with a `credits_granted` column present, the conflict-path insert cannot produce two granted rows (assert row count == 1 and single credits_granted value).
    - **per-user isolation**: same event id for two different users → both rows persist (the unique constraint is per event id, not per user).
    - **FK behavior**: deleting the user (the `maintenance_tasks.py` hard-delete flow — `filter(user_id=...).delete()` before `user.delete()`) removes subscription + payment rows; CASCADE allows a direct `user.delete()` too.
  - [x] 2.2 GREEN: any model adjustments needed (expected none beyond Task 1 — the unique field carries the guard).
  - [x] 2.3 Run backend gates — green.

- [ ] **Task 3: Read-only admin for `Subscription` + `PaymentTransaction`** (financial-rows audit precedent — 4.1 Task 7)
  - [ ] 3.1 RED: `backend/apps/billing/tests/test_admin.py` — NEW — `admin.site._registry` lookups: `SubscriptionAdmin` and `PaymentTransactionAdmin` registered; both `readonly_fields` cover every model field (no in-place admin edits — financial rows are append-only); `list_display` includes user/status/tier (subscriptions) and user/chargily_event_id/type/amount_dzd/status (payments).
  - [ ] 3.2 GREEN: `backend/apps/billing/admin.py` — NEW — read-only admins (`list_display` + `readonly_fields = [all fields]` + `has_add_permission`/`has_change_permission`/`has_delete_permission` → False — append-only audit surface).
  - [ ] 3.3 Run backend gates — green.

- [x] **Task 4: PG-backed CI job** (epic-4 retro action item #4 — target "before 5.1")
  - [x] 4.1 NEW: `backend/config/settings/ci_pg.py` — settings module for PG-backed CI: inherits `.test`, `DATABASES['default']` = PostgreSQL via `POSTGRES_*` env vars (defaults matching the CI service container).
  - [x] 4.2 UPDATE: `.github/workflows/ci.yml` — backend job gains `services: postgres:16-alpine` (health-checked) + a second pytest run with `DJANGO_SETTINGS_MODULE=config.settings.ci_pg`, **scoped to the billing + concurrency tests** (`apps/billing apps/accounts apps/search/tests/test_daily_usage.py apps/search/tests/test_quota.py`): a local real-PG16 run of the FULL suite proved 648/700 pre-existing tests pass on PG; the 51 SERIALIZABLE-service tests (reveal/export debit — the documented SET-TRANSACTION-first composition contract, deferred-work.md) and 1 explicitly-SQLite FTS test cannot run under pytest-django's transaction-wrapped fixtures (the 4.1 E2E-race pattern is their PG proof). Handoff recorded in Dev Notes (D13).
  - [x] 4.3 Run backend gates locally — green; PG behavior verified on real PG16 via Task 5 (GitHub Actions cannot run locally — the workflow is validated by inspection).

- [x] **Task 5: Real-stack verification (docker PG16) + full regression** (the 4.1/4.6 real-PG precedent; port-conflict lesson — host 5433)
  - [x] 5.1 Docker PG16 up (host port 5433 — native Windows PG17 holds 5432) → `migrate` applies `billing` 0001 cleanly → psql assertions: `subscriptions` + `payment_transactions` tables exist; CHECK constraints reject an invalid status/type; unique constraint on `chargily_event_id` rejects a duplicate; `INSERT ... ON CONFLICT (chargily_event_id) DO NOTHING` inserts exactly one row (the AD-5 guard on real PG).
  - [x] 5.2 Full regression: `pytest` (all apps), `ruff`, `mypy` strict, `manage.py check`, `makemigrations --check` — green (frontend gates NOT run — 5.1 is backend-only; exclusion recorded per the 4.4/4.5 precedent).
  - [x] 5.3 E2E rows cleaned up; docker stack stopped.

## Dev Notes

- **Source of truth — the planning spec**: `_bmad-output/planning-artifacts/epics/epic-05-billing-subscriptions/story-01-billing-database-schema.md` (all ACs verbatim in this story). FR-24/25/26/27 details in `_bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L228-258`. Epic context in `_bmad-output/planning-artifacts/epics/epic-05-billing-subscriptions/index.md`.
- **Spine refs**: subscriptions DDL `docs/ARCHITECTURE-SPINE.md#L162-173`; payment_transactions DDL `#L175-188`; webhook idempotency flow `#L616-627`; AD-3 (PG single store, SERIALIZABLE payments/credits) + AD-5 (webhook idempotent on chargily_event_id UNIQUE) `#L865-867`.
- **Contracts this story honors (verbatim)**:
  - D1: model labels `apps.billing.Subscription` + `apps.billing.PaymentTransaction` are pinned by `maintenance_tasks.py:17-18` guarded lookups (hard-deleted via `filter(user_id=...).delete()` before user delete) — never rename; both models MUST expose `user_id`.
  - D2: `user` FK `on_delete=CASCADE` (the maintenance task deletes dependent rows BEFORE `user.delete()`; CASCADE also permits direct deletion — the 4.1 D2 precedent).
  - D3: status/type/tier enforced via Django TextChoices + CheckConstraint (runs on BOTH SQLite test DB and PG16 — the spine's `CREATE TYPE` is PG-only; the 4.1 D3 precedent).
  - D4: `tier` field REUSES `TIER_CHOICES` imported from `apps.accounts.models` — never re-creates the user_tier enum.
  - D5: **NO credit_ledger schema change** — verified `credit_event_type` already carries `subscription_grant`/`pack_grant` (`backend/apps/credits/models.py:11-12`, credits 0001; epic-4 retro: "5.1/5.3/5.4 grant flows need NO ledger schema change — 5.1 is thinner than planned").
  - D6: UUID PKs use the repo precedent `default=uuid.uuid4` (Python-side; search models + 4.1) — the spine's DB-side `gen_random_uuid()` is not emitted; semantically equivalent, SQLite-compatible.
  - D7: `chargily_event_id` unique NOT NULL is the idempotency guard (AD-5). The webhook view (5.2/5.3) will use `INSERT ... ON CONFLICT (chargily_event_id) DO NOTHING`; 5.1 proves the DB-level semantics via `bulk_create(ignore_conflicts=True)` (the ORM's ON CONFLICT DO NOTHING — works on SQLite AND PG).
  - D8: billing API endpoints (plan / packs / create-checkout / status) are **DEFERRED to 5.2+** — decision recorded via the John/Winston persona consultation (dead endpoints without their backing services violate the no-dead-endpoints rule; 5.2 owns the Chargily client + create-checkout, 5.3 the subscription flow, 5.4 packs, 5.6 polling). John: "This verdict IS the recorded decision satisfying constraint (a). Caveat: 5.1's endpoint AC clause must be amended to 'deferred to 5.2+ (recorded decision)' or 5.1 can never be honestly Done." Winston endorsed: "Schema-first is the right order — the tables are the contract the later stories build on."
  - D9: `chargily_metadata` = `JSONField` (spine JSONB — Django maps JSONField → jsonb on PG, TEXT-validated on SQLite).
  - D10: frontend gates NOT run in 5.1 (backend-only story) — exclusion recorded per the 4.4/4.5 precedent.
  - D11: PG-backed CI job lands in 5.1 (epic-4 retro action item #4 target: "before 5.1").
  - D12: `payment_transactions` carries `Index(fields=['user', '-created_at'], name='payments_user_created_idx')` — Winston consultation item 6 (the 5.5 payment-history surface: `filter(user=...).order_by('-created_at')`; the 4.1 `credit_ledger_user_created_idx` precedent; name shortened for Django's 30-char limit). `subscriptions` needs nothing beyond the auto FK index.
  - D13: PG CI job scope — a full-suite run on real PG16 lands 648/700 passing; the 51 SERIALIZABLE-service tests (test_reveal, test_export_debit, test_reveal_api, test_export_api) fail with `ActiveSqlTransaction: SET TRANSACTION ISOLATION LEVEL must be called before any query` — the DOCUMENTED deferred-work.md composition contract (pytest-django wraps every `django_db` test in a transaction, so the vendor-guarded first-statement guard can never run under pytest; 4.1 proved SERIALIZABLE via the E2E two-process race, not pytest). `TestSqliteKeywordBehavior::test_operator_words_are_treated_as_literals` is explicitly SQLite-behavior. The CI PG job therefore runs the billing + concurrency scope (205 tests locally on PG16: billing ON-CONFLICT/unique/CHECK proofs + accounts select_for_update paths + daily-usage upsert race + quota TOCTOU). Webhook-concurrency tests land with the 5.2/5.3 webhook view — the 5.3 story should extend this job or use the E2E-race pattern.
- **Persona consultation record (2026-08-09, parallel subagents)**:
  - Winston (architect): OK on TextChoices+CheckConstraint (SQLite-runnable), Python-side uuid4 (gen_random_uuid needs pgcrypto on PG16 / no SQLite equivalent), CASCADE FK (redundant-but-harmless defense in depth; financial auditability lives in credit_ledger), JSONField (jsonb on PG); guard on `ignore_conflicts` — pin a rowcount assert so surprising conflicts surface; CHANGE: composite index (D12); endorsed endpoint deferral; note: tier `DEFAULT 'starter'` is intentional (subscription = inherently paid), distinct from `User.tier`'s 'free' default — do not harmonize.
  - John (PM): **DECISION — defer all 4 endpoints to 5.2+; do not wire stubs in 5.1**. FR-24..27 impose NO schema obligations beyond the AC DDL: no rollover needs no object (grant computation in the ledger); free-tier pack purchases need only `user_id` (schema MUST NOT add a subscription-enforcing constraint); `cancelled_at` suffices for no-refund-of-current-cycle; unique `chargily_event_id` is the sufficient DB guard, but the transaction-row insert must be the FIRST write in the reconciliation transaction (app responsibility, 5.3).
  - Sally (UX): CONFIRM — no missing obligation; notes for 5.5-5.7: PaymentHistory "payment date" = `created_at` (keep `reconciled_at` internal); `pack_purchase` rows carry no pack reference — display pack name from `chargily_metadata` with a "—" fallback; `chargily_checkout_url` nullable → cancel/retry CTA needs a null-redirect error state; `pending` default has no terminal contract → 5.6 spinner needs its own timeout + support CTA; `failed_renewal` needs a documented exit path (retry → active, or → expired) before 5.7 copy locks in; request a backend status-state diagram for the "renews on {date}" copy.
- **Out of scope (handoff)**: Chargily API client + HMAC webhook verification = 5.2; subscription grant flow (200 credits, `subscription_grant`) = 5.3; pack purchases (`pack_grant`) = 5.4; billing UI = 5.5; status-card polling = 5.6; state banners = 5.7; webhook concurrency proof on PG CI = exercised by the full-suite PG job (5.3+ adds the webhook view).
- **Testing standards**: pytest + `django_db`; the 4.1 `test_models.py` TestSchema precedent for schema assertions; the conftest `create_user` fixture; SQLite-compatible DDL; real-stack E2E on docker PG16 (host port 5433 — the 4.6 port-conflict lesson); gates = backend `pytest` + `ruff` + `mypy` (strict, pyproject.toml) + `manage.py check` + `makemigrations --check` — run ALL gates after EVERY task; sprint-status.yaml is UTF-16 LE — edits via PowerShell `-Encoding Unicode` (the 4.4/4.3 lesson).

## Dev Agent Record

### Agent Model Used

opencode-go/deepseek-v4-flash

### Debug Log References

- RED runs: test_models.py failed collection (no `apps.billing.models` module — collection error confirmed before GREEN); test_admin.py 8 failed (no admin module); the E2E script had 3 rounds of seeding fixes (raw-SQL inserts must supply Django's Python-side defaults — `created_at`/`is_superuser`/`status`; the app's DEFAULTs are ORM-level per the D6 precedent — Winston's raw-SQL caveat), then 2 rounds of expecting-the-expected (CheckViolation/UniqueViolation must be caught inside the check, not escape to the harness), then a leftover-user cleanup (aborted first run left `e2e-billing-51@example.com`).
- Test-only fixes during GREEN: index name `payment_transactions_user_created_idx` (36 chars) rejected by Django (`models.E034` — 30-char limit) → renamed `payments_user_created_idx`; migration import block un-sorted per ruff I001 → auto-fixed; `_txn` helper return annotation `-> PaymentTransaction` flagged by mypy strict (Django stub `objects.create` → Any) → `-> Any` (the 4.1 `_grant` helper convention); test_admin lookups use `admin.site._registry` (the 4.1 pattern).
- PG CI job proof: full suite on real PG16 = 648 passed / 52 failed; the 52 = 51 SERIALIZABLE-service tests (`ActiveSqlTransaction: SET TRANSACTION ISOLATION LEVEL must be called before any query` — pytest-django's per-test atomic wrapper vs the documented SET-first composition contract) + 1 explicitly-SQLite FTS test; scoped PG run (`apps/billing apps/accounts apps/search/tests/test_daily_usage.py apps/search/tests/test_quota.py`) = 205/205 pass (D13).
- E2E (docker PG16, host 5433): migrate clean (full chain incl. billing 0001); 10/10 checks — tables exist, 4 CHECK rejections (status/tier/type/payment-status), UniqueViolation on duplicate chargily_event_id, ON CONFLICT DO NOTHING → exactly one row, composite index present, cleanup verified. Docker container removed after verification.

### Completion Notes List

- Story 5.1 implemented end-to-end (TDD red→green per task): `subscriptions` + `payment_transactions` models (AC DDL exact: UUID PKs, TextChoices + DB CHECKs, user FK CASCADE, `chargily_event_id` TEXT UNIQUE NOT NULL — the AD-5 idempotency guard, JSONB metadata, reconciled_at, composite `payments_user_created_idx`), billing 0001 migration (SQLite-runnable), ON CONFLICT DO NOTHING semantics proven (unit: `bulk_create(ignore_conflicts=True)` → exactly one row, IntegrityError on duplicate create, no double-grant; real PG16: raw-SQL UniqueViolation + ON CONFLICT single-row), append-only read-only admins, PG-backed CI job (ci_pg settings + postgres service in ci.yml, scoped to billing + concurrency — D13), real-PG16 E2E 10/10.
- Persona consultation record: endpoints DEFERRED to 5.2+ (John PM decision + Winston endorsement — D8); Winston CHANGE adopted (composite index — D12); Sally confirmed no schema gaps (5.5-5.7 handoff notes in Dev Notes).
- Gates: backend 700 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations --check clean; real-PG scoped suite 205/205; PG16 E2E 10/10. Frontend gates not run (backend-only — 4.4/4.5 exclusion precedent, D10).

### File List

- `backend/apps/billing/models.py` (NEW)
- `backend/apps/billing/admin.py` (NEW)
- `backend/apps/billing/migrations/0001_initial.py` (NEW)
- `backend/apps/billing/tests/__init__.py` (NEW)
- `backend/apps/billing/tests/test_models.py` (NEW)
- `backend/apps/billing/tests/test_idempotency.py` (NEW)
- `backend/apps/billing/tests/test_admin.py` (NEW)
- `backend/config/settings/ci_pg.py` (NEW)
- `.github/workflows/ci.yml` (MODIFIED — postgres service + PG-scoped pytest run)
- `_bmad-output/implementation-artifacts/5-1-billing-database-schema.md` (NEW — this story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — 5-1 → review; pre-existing retro updates preserved)

### Change Log

- 2026-08-09: Story created (ready-for-dev) from the epic 5.1 planning spec; sprint-status 5-1 → ready-for-dev, epic-5 → in-progress (UTF-16 LE preserved).
- 2026-08-09: Persona consultations (parallel subagents — Winston/John/Sally) completed; recorded decision: **the 4 billing API endpoints are DEFERRED to 5.2+** (John PM verdict + Winston endorsement; no dead endpoints in 5.1); Winston CHANGE adopted — `payments_user_created_idx` composite index (D12); Sally confirmed no schema obligation gaps (handoff notes for 5.5-5.7 recorded in Dev Notes).
- 2026-08-09: Implemented (TDD) — Task 1 models+migration (index renamed `payments_user_created_idx` for the Django 30-char limit), Task 2 idempotency semantics (8 tests), Task 3 read-only admins (8 tests), Task 4 PG CI job (ci_pg settings + postgres service; full-suite PG proof → scoped billing+concurrency run, D13), Task 5 real-PG16 E2E (10/10 checks incl. ON CONFLICT single-row + UniqueViolation). 700 backend gates green / real-PG scoped 205 green / FE gates excluded (backend-only). Status → review (sprint-status 5-1 → review).
