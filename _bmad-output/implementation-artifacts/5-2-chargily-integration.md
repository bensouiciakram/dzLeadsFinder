---
story_id: 5.2
epic: 5
title: Story 5.2 — Chargily Integration
Status: done
frs: [FR-24, FR-25, FR-27]
ads: [AD-5, AD-14]
baseline_commit: 817f8a2
---

# Story 5.2: Chargily Integration

Status: done

## Story

As a **developer**,
I want **a Chargily API client that creates checkouts for subscriptions and packs, verifies webhook signatures via HMAC-SHA256, and processes payment events idempotently**,
So that **Algerian users can pay with CIB and EDahabia cards**.

## Acceptance Criteria

**Given** the Chargily API client
**When** I inspect `backend/apps/billing/chargily.py`
**Then** it provides:
- `create_checkout(plan_data)` — creates a Chargily checkout session and returns the redirect URL
- `verify_webhook_signature(payload, signature)` — HMAC-SHA256 verification against `CHARGILY_WEBHOOK_SECRET`

**Given** the create-checkout endpoint
**When** a user requests `POST /api/billing/create-checkout/`
**Then** the server creates a Chargily checkout with:
- CIB and EDahabia as the only payment methods
- Amount in DZD
- Metadata: user_id, type (subscription/pack), amount
**And** returns the Chargily checkout URL to the frontend for redirect

**Given** the webhook endpoint
**When** Chargily sends a POST to `/api/webhooks/chargily/`
**Then** the Django view:
1. Is `@csrf_exempt` (Chargily has no CSRF token)
2. Verifies the HMAC-SHA256 signature against `CHARGILY_WEBHOOK_SECRET`
3. Parses the event type and payload
4. Validates the `chargily_event_id` uniqueness (ON CONFLICT DO NOTHING)
5. If duplicate, returns 200 (already processed)
6. If new, enqueues a Celery task `grant_credits.delay(event_id)` for background processing (the 5.2 task body is a registered, idempotent bridge — recorded decision; the real grant logic lands in 5.3)
7. Returns 200 to Chargily within 5 seconds

**Given** the webhook event types
**When** Chargily sends events
**Then** they map to internal types:

| Chargily Event | Transaction Type | Action |
|---|---|---|
| `checkout.paid` (single) | `pack_purchase` | Grant pack credits (75 or 250) |
| `checkout.paid` (subscription creation) | `subscription_creation` | Grant 200 credits, create subscription |
| `checkout.paid` (subscription renewal) | `subscription_renewal` | Grant 200 credits, extend period |
| `subscription.payment_failed` | — | Set subscription `failed_renewal`, trigger persistent banner |

**And** the "Action" column is DEFERRED to 5.3+ (recorded decision — John PM verdict, 2026-08-09): 5.2 delivers the event→transaction-type mapping, the idempotent transaction-row insert, and the `grant_credits.delay(event_id)` enqueue. The actions land in 5.3 (grant 200 credits, create subscription, extend period, `failed_renewal` state write), 5.4 (pack grants), 5.7 (banner). `subscription.payment_failed` events are signature-verified, acknowledged 200, and enqueue no task (no transaction row — the type CHECK excludes it; the state write is 5.3).

**Given** security requirements
**When** the app starts
**Then** `CHARGILY_API_KEY` and `CHARGILY_WEBHOOK_SECRET` are loaded from server-only environment variables
**And** they never appear in the client bundle or application logs

## Tasks / Subtasks

- [x] **Task 1: Chargily API client — `backend/apps/billing/chargily.py`** (AC client clause; FR-24/25/27; AD-5)
  - [x] 1.1 RED: `backend/apps/billing/tests/test_chargily.py` — NEW — client tests:
    - `create_checkout` POSTs to the Chargily v2 checkouts endpoint with `Authorization: Bearer <api_key>`, JSON body carrying `amount` (int DZD), `currency: "dzd"`, `payment_methods: ["cib", "edahabia"]` ONLY, `metadata: {user_id, type, amount}`, success/failure URLs sourced from SETTINGS (the D8 env pattern — Winston Q4 addition); returns the `checkout_url` from the response (mock `requests.post`; assert the exact call).
    - `create_checkout` raises a typed error when the API returns non-2xx or times out (no silent failures).
    - `verify_webhook_signature(payload, signature)` — True for an HMAC-SHA256 computed against `CHARGILY_WEBHOOK_SECRET`; False for tampered payload, wrong secret, wrong case, empty/None signature.
    - the signature envelope (header name, hex encoding, raw body) is pinned EXECUTABLY: the mocked-contract test asserts the exact header name/encoding (Winston Q7 hardening).
  - [x] 1.2 GREEN: implement `chargily.py` (requests-based client; signature verification via `hmac.compare_digest`; payload/signature envelope pinned from the Chargily docs — D11; docstring records the pinned spec URL + date + format).
  - [x] 1.3 Add `requests` to `backend/requirements.txt` (user-approved dependency — D4) and `pip install` it locally.
  - [x] 1.4 Run backend gates — green.

- [x] **Task 2: Create-checkout endpoint — `POST /api/billing/create-checkout/`** (AC endpoint clause; FR-24/25; user-approved pass-through decision — D6)
  - [x] 2.1 RED: `backend/apps/billing/tests/test_checkout_view.py` — NEW — view tests (mocked client):
    - unauthenticated → 401; authenticated → 200 `{"checkout_url": ..., "checkout_id": ...}` (the checkout id is REQUIRED — Winston Q4 CHANGE + John scope addition: 5.6 polls by Chargily checkout id, and the URL may not embed a parseable id) with metadata `{user_id, type, amount}` matching the request.
    - `type` outside `{subscription, pack}` → 400; `amount` non-integer / ≤ 0 / > 2^31-1 → 400; missing body → 400.
    - the view NEVER writes a `payment_transactions` row (no DB row created at checkout time — D6).
    - Chargily API failure → 502 (honest error surface, no fake URL).
  - [x] 2.2 GREEN: `apps/billing/views.py` + `apps/billing/urls.py` (`app_name='billing'`) + route in `config/urls.py`.
  - [x] 2.3 Run backend gates — green.

- [x] **Task 3: Webhook endpoint — `POST /api/webhooks/chargily/`** (AC webhook clauses 1–7 + event mapping; FR-27; AD-5; deferred-work #4/#5/#6 resolutions — D5)
  - [x] 3.1 RED: `backend/apps/billing/tests/test_webhook.py` — NEW — view tests (computed HMAC signatures, task mocked/spied):
    - invalid signature → 400, no DB row, no task enqueued (signature verified FIRST, against the RAW body bytes).
    - valid `checkout.paid` subscription-creation event → 200; `payment_transactions` row created with the mapped type, amount from metadata, SHAPED `chargily_metadata` (never the raw payload), event id NORMALIZED (`strip().lower()`); `grant_credits` enqueued exactly once with the normalized event id.
    - duplicate event id (same payload replayed) → 200, still exactly ONE row, task enqueued ONCE (AD-5).
    - event mapping: metadata.type=pack → `pack_purchase`; subscription + subscription id present → `subscription_renewal`; subscription without → `subscription_creation` (AC table; the discriminator is pinned from the Chargily docs — D11, John's hazard note); AMBIGUOUS subscription event (no subscription id, no metadata type) → `subscription_creation` + loud log, never 500/drop (Winston Q5).
    - `subscription.payment_failed` → 200 ack, NO transaction row (type CHECK excludes it — D3), no grant task, structured log line carrying the event id (John S3 — 5.3 isn't blind).
    - unknown event type → 200 ack + no row (no retry loops — D8).
    - missing event id → 400; malformed JSON → 400.
    - mapped amount outside 0..2^31-1 or unnormalizable event id → 400 BEFORE the insert (prevents a CHECK-violation 500 → Chargily retry loop — Winston Q6b).
    - missing/anonymised user (deleted user, FK SET_NULL — 5.1 D2) → row still inserted with `user_id` NULL (financial auditability; historical user_id kept in the shaped metadata — Winston Q3).
    - view has NO outbound network calls (≤5s guarantee).
  - [x] 3.2 GREEN: `apps/billing/webhooks.py` — plain Django view (`@csrf_exempt`; signature over `request.body` raw bytes read BEFORE parse; header looked up case-insensitively — Winston Q7; raw-SQL `INSERT ... ON CONFLICT (chargily_event_id) DO NOTHING RETURNING id` — spine L620-621 — supplying `id=uuid4()`, `created_at`, `status='pending'` as parameters: Python-side defaults per 5.1 D6, the 5.1 E2E raw-SQL lesson; conflict detected via `fetchone() is None`, NEVER rowcount — Winston Q1); duplicate → 200; new → `grant_credits.delay(event_id)`; NO rest_framework imports in this module (plain view; DRF lives in views.py — Winston Q2); module-level imports limited to stdlib + `django.http` + `django.views.decorators.csrf` + `celery.shared_task` (models/settings reads deferred to runtime — the email_tasks precedent).
  - [x] 3.3 Run backend gates — green.

- [x] **Task 4: `grant_credits` bridge task + Celery registration** (AC webhook clause 6; AD-14; user-approved bridge decision — D7)
  - [x] 4.1 RED: `backend/apps/billing/tests/test_tasks.py` — NEW — the task is registered under its full name, is callable, and is idempotent/safe on a missing transaction row (no crash, no ledger writes yet); `config/celery.py` imports the module (registration).
  - [x] 4.2 GREEN: `grant_credits` `shared_task` in `apps/billing/tasks.py` (AMENDED by RC-1 — originally in `webhooks.py`; moved per user decision 2026-08-09, see Review Findings; Django imports deferred to runtime — the email_tasks precedent; bridge body per D7: re-query the transaction row, no ledger writes, missing row → safe return; full task name pinned: `apps.billing.tasks.grant_credits` — a 5.3 contract) + explicit `import apps.billing.tasks` in `config/celery.py` (MANDATORY — `autodiscover_tasks()` no-ops pre-`django.setup()` in this project, D18 amended).
  - [x] 4.3 Run backend gates — green.

- [x] **Task 5: Configuration + secret hygiene** (AC security clause; FR-27)
  - [x] 5.1 RED: `backend/tests/test_chargily_settings.py` — NEW — `CHARGILY_API_KEY`/`CHARGILY_WEBHOOK_SECRET`/`CHARGILY_MODE` resolve from env in `base.py` (empty defaults), test settings pin test values, `production.py` REQUIRES the two secrets (`KeyError` when absent); plus `CHARGILY_SUCCESS_URL`/`CHARGILY_FAILURE_URL` (the D8 redirect-URL settings — Winston Q4 + John scope addition).
  - [x] 5.2 GREEN: `base.py` + `test.py` + `production.py` settings.
  - [x] 5.3 Verify no secret can appear in logs (grep for logging of keys in the new modules) + run backend gates — green.

- [x] **Task 6: Real-stack verification (docker PG16) + full regression** (the 5.1/4.6 real-PG precedent; port-conflict lesson — host 5433)
  - [x] 6.1 Docker PG16 up (host port 5433) → `migrate` clean → E2E: create-checkout (mocked client) → webhook POST with computed HMAC → row on PG with shaped metadata + normalized id; duplicate POST → 200 + single row; `ON CONFLICT DO NOTHING RETURNING` proof on real PG; invalid signature → 400 + no row; cleanup + container removed.
  - [x] 6.2 Full regression: `pytest` (all apps), `ruff`, `mypy` strict, `manage.py check`, `makemigrations --check --dry-run` — green (FE gates NOT run — backend-only; exclusion per the 4.4/4.5 precedent — D10).

## Dev Notes

- **Source of truth — the planning spec**: `_bmad-output/planning-artifacts/epics/epic-05-billing-subscriptions/story-02-chargily-integration.md` (all ACs verbatim in this story). FR-24/25/27 details in `_bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L228-258`. Epic context in `_bmad-output/planning-artifacts/epics/epic-05-billing-subscriptions/index.md`.
- **Spine refs**: webhook flow `docs/ARCHITECTURE-SPINE.md#L600-631` (HMAC verify → guarded INSERT `ON CONFLICT (chargily_event_id) DO NOTHING RETURNING id` → `grant_credits.delay(event_id)` → 200 within 5s); idempotency diagram `#L616-627`; AD-5 (webhook idempotent on the UNIQUE constraint) `#L865-867`; AD-14 (Celery + Redis; tasks idempotent on the event/record id; 3 retries exponential for payment reconciliation) `#L286-290`; API table `#L480-485`; billing file layout `#L526-532` (`chargily.py` client, `webhooks.py` handler + Celery tasks).
- **Contracts this story honors (verbatim)**:
  - D1: model labels `apps.billing.PaymentTransaction` (+ `Subscription`) pinned by `maintenance_tasks.py` guarded lookups — never rename.
  - D2: billing `user` FKs are `SET_NULL` nullable (5.1 review decision — anonymised financial rows + 90-day purge): the webhook MUST tolerate a missing/anonymised user and still insert the financial row with `user_id` NULL.
  - D3: `payment_transactions.type` CHECK allows only `subscription_creation`/`subscription_renewal`/`pack_purchase` — `subscription.payment_failed` events have NO transaction row in 5.2 (the failed-renewal state write is 5.3/5.7).
  - D4: `chargily_event_id` is GLOBAL UNIQUE NOT NULL (AD-5); the webhook normalizes (`strip().lower()`) on write (deferred-work #5 resolved here — the 5.1 deferral named "the 5.3 webhook handler", which IS this story's view).
  - D5: `chargily_metadata` stores a SHAPED subset (checkout id, payment method, mode, type/amount from metadata) — NEVER the raw webhook payload (deferred-work #4 "payload shaping + redaction is a 5.2 webhook-design decision" resolved here).
  - D6: the guarded insert uses raw SQL `INSERT ... ON CONFLICT (chargily_event_id) DO NOTHING RETURNING id` (spine L620-621; SQLite-runnable for tests, real semantics on PG16) — sidesteps the ORM `bulk_create(ignore_conflicts=True)` backend divergence (deferred-work #6); no ORM row-return assumptions.
  - D7: webhook view = plain Django view (not DRF) — `@csrf_exempt`; signature verified against the RAW `request.body` bytes BEFORE any parsing; no outbound network calls in the request path (the ≤5s guarantee).
  - D8: secrets server-only: settings read via `os.environ`; `production.py` uses the required-var pattern; keys never logged; backend-only story — the client bundle is untouched (AC "never appear in the client bundle" holds structurally).
  - D9: Celery task modules defer Django imports to runtime (the `tasks/email_tasks.py` precedent — `config/celery.py` imports task modules before the app registry is ready).
  - D10: FE gates NOT run (backend-only story — the 4.4/4.5 exclusion precedent).
  - D11: Chargily signature/API envelope pinned from the official docs during implementation (header name, digest encoding, checkout payload shape); the adapter is isolated in `chargily.py` so a docs-pin correction is a single-file change.
  - D12: raw-SQL guarded insert supplies `id=uuid4()`, `created_at=timezone.now()`, `status='pending'` as parameters (Python-side defaults per 5.1 D6 — the 5.1 E2E raw-SQL lesson); conflict detected via `cursor.fetchone() is None` (NEVER rowcount — RETURNING rowcount semantics differ by driver; Winston Q1).
  - D13: pre-insert validation: mapped amount 0..2^31-1 and normalized event id validated BEFORE the insert → 400 on violation (a glitched payload otherwise hits the CHECK and 500-loops Chargily's retries; Winston Q6b). Pack prices (75/250) are NEVER hardcoded in 5.2 — 5.4 owns pack definitions (Winston Q6c); amount authority rule: provider-confirmed payload amount preferred, metadata amount is the fallback (Winston #7).
  - D14: create-checkout returns `{checkout_url, checkout_id}` — 5.6 polls by the Chargily checkout id (Winston Q4 CHANGE + John scope addition); 5.6's `chargily_metadata` lookup needs an index decision (GIN vs dedicated column) — noted now, decided in 5.6 (Winston #4).
  - D15: enqueue-failure window (row inserted → `delay()` raises with Redis down → view 500s → Chargily retries → duplicate path acks 200 WITHOUT re-enqueueing → grant never fires): the 5.3 pending-reconciliation sweep is the recovery path — 5.3 MUST keep that deliverable (Winston #5). Webhook view tests mock/spy `grant_credits` so eager-mode exceptions can't turn the view into a 500-after-insert (Winston #9).
  - D16: `payment_failed` events persist nothing in 5.2 (structured log line with the event id); 5.3's `failed_renewal` state write must be idempotent on its own (no unique guard exists since no row is written — Winston #6; John S3).
  - D17: missing/anonymised user → insert with `user_id` NULL + historical user_id kept in the shaped metadata; 5.3's grant task no-ops + logs loudly on NULL-user rows, and NULL-user rows must be settled/reconciled, not left `pending` forever (Winston Q3 + John S5 handoff).
  - D18: Celery registration — `grant_credits` lives in `apps/billing/tasks.py` with an EXPLICIT `import apps.billing.tasks` in `config/celery.py` (AMENDED 2026-08-09 by RC-1, user decision: the task moved out of webhooks.py into the app tasks module; see Review Findings). `app.autodiscover_tasks()` does NOT reliably register app tasks in this project — `config/__init__.py` imports the celery app during `django.setup()` (pre-registry), so autodiscovery no-ops; that is exactly why `tasks/email_tasks.py`/`maintenance_tasks.py` are explicitly imported. Task full name pinned as a contract: `apps.billing.tasks.grant_credits` (5.3). Spine L532 (webhooks.py = handler + tasks) vs L540 (tasks/billing_tasks.py) contradiction resolved toward the repo's tasks convention by RC-1.
  - D19: AC amendment (John S7, verbatim in the AC section): the event-table "Action" column is DEFERRED to 5.3+ (recorded decision) — 5.2 delivers the mapping + idempotent insert + enqueue; actions land in 5.3/5.4/5.7; `subscription.payment_failed` = 200 ack, no task, no row. Clause 6 note: the 5.2 task body is a registered, idempotent bridge.
  - D20: handoffs pinned for later stories: 5.3/5.4 enforce the server price table + FR-24 no-active-subscription precondition at create-checkout (the `subscriptions_active_unique` DB backstop exists); 5.3 settles NULL-user rows; 5.6 keys polling on the checkout id returned by 5.2 (John notes).
- **Persona consultation record (2026-08-09, parallel subagents — Winston architect + John PM; Sally EXCLUDED — backend-only story, no FE surface, per the 4.4/4.5 precedent)**:
  - Winston (architect): APPROVED the design with three mandatory fixes — (1) raw-SQL insert must supply `id`/`created_at`/`status` parameters (Python-side defaults, 5.1 D6) and detect conflicts via `fetchone() is None`, never rowcount; (2) create-checkout MUST return `checkout_id` alongside `checkout_url` (5.6 polling key — the URL may not embed a parseable id); (3) pre-validate the mapped amount + normalized event id → 400 before insert (prevents CHECK-violation 500 retry loops). Also: explicit `config/celery.py` import mandatory (autodiscover misses webhooks.py); webhooks.py module-level imports limited to stdlib/django.http/django.views.decorators.csrf/celery (models + settings reads deferred to runtime; NO rest_framework in webhooks.py); ambiguous subscription event → `subscription_creation` + loud log, never 500; missing/anonymised user → insert with NULL user_id (D2 contract) + historical user_id kept in shaped metadata; 5.3 grant no-ops loudly on NULL-user rows; amount authority = provider payload first, metadata fallback; no pack-price hardcodes in 5.2; redirect URLs from settings; envelope adapter isolated + docstring-pinned + executable mocked-contract test; header lookup case-insensitive.
  - John (PM): RATIFIED all scope decisions (bridge task S1, pass-through S2, payment_failed 200-ack S3, unknown-event 200-ack S4, NULL-user insert S5, first-write-wins S6) and MANDATED one AC amendment (S7, verbatim in the AC section): the Action column + payment_failed carve-out are deferred to 5.3+ (recorded decision) so the Acceptance Auditor never finds a VIOLATION-as-written (the 5.1 F1 precedent). Scope additions: `checkout_id` in the create-checkout response + test; redirect URLs as settings. Handoffs pinned: 5.3/5.4 enforce price table + FR-24 precondition at the endpoint; 5.3 settles NULL-user rows; 5.6 keys polling on the 5.2-returned checkout id. Hazard note: the creation-vs-renewal discriminator (subscription-id presence) is provisional — pin from Chargily docs (D11); a creation event carrying its new subscription id would misclassify; the DB-existence discriminator is unavailable in 5.2 (no subscription rows until 5.3).
  - Sally (UX): NOT consulted — 5.2 is backend-only (no FE surface, no user-facing copy). Exclusion recorded per the 4.4/4.5 precedent. Sally's 5.1-era notes for 5.5-5.7 (null-redirect error states, pending-timeout contract, failed_renewal exit path) remain handoffs for those stories.

## Dev Agent Record

### Agent Model Used

opencode-go/deepseek-v4-flash

### Debug Log References

- Task 1 RED: collection error `ModuleNotFoundError: No module named 'apps.billing.chargily'` (confirmed before GREEN); 2 test-fake bugs fixed during GREEN (the fake `raise_for_status` raised ValueError instead of `requests.exceptions.HTTPError`; the pack-type fake's response lacked the `id` field the client requires) — the client is stricter than the fakes, so the fakes were corrected.
- Chargily docs pin (D11): docs.chargily.com unreachable from the dev environment (transport errors), dev.chargily.com 404s, PyPI blocked by a JS challenge — the envelope is implemented per the publicly documented Chargily Pay v2 spec and pinned in the module docstring + executable tests; the risk is recorded and the adapter isolated for a single-file correction. `create_checkout` returns the URL string exactly per the AC client clause; `create_checkout_details` adds the checkout id for the 5.6 polling key (D14).
- Settings landed in Task 1.2 (base.py + test.py) because the client reads `CHARGILY_*` at runtime (Winston's settings-from-env requirement); production.py required-var enforcement + the dedicated settings test land in Task 5.
- Task 1 gates: 722 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations --check clean.
- Task 2 RED: 11 failed (no view/routes — expected); one test-convention fix: my tests used `format='json'` (Django test-client kwarg) but the repo convention is `content_type='application/json'` — with `format='json'` the payload arrived form-encoded (amount as str), so every "valid" payload failed validation with 400 and the None-amount case raised the client's TypeError. Rewrote with the repo convention → GREEN 11/11. Also: Write-tool round-trip left a UTF-8 BOM on the rewritten test file (EF BB BF — the exact hygiene issue the 5.1 review patched) — stripped via UTF8Encoding(false); BOM scan of the tests dir now clean.
- Task 2 gates: 733 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations --check clean.
- Task 3 RED: 19 failed (no webhook module/route). GREEN fixes during development: (a) raw-SQL on SQLite can't bind `uuid.UUID` objects directly (the ORM adapter doesn't apply to raw cursors — `sqlite3.InterfaceError: Error binding parameter 0`) → pass `str(uuid.uuid4())` (works on SQLite AND PG); (b) missing `django_db` marks on the no-fixture webhook tests (RuntimeError: Database access not allowed) → module-level `pytestmark = pytest.mark.django_db` (the 5.1 idempotency precedent); (c) `_resolve_user` assumed UUID user ids per the spine DDL, but the ACTUAL users table pk is BigAutoField (accounts `User` has no explicit pk field → DEFAULT_AUTO_FIELD) — the 5.1 DDL's `users(id) UUID` is aspirational; resolution now filters `pk=<str>` with a ValueError/TypeError guard (works for int and uuid pks); (d) the ambiguous-event log carries the NORMALIZED event id (correlates with the DB row) — test assertion updated; (e) `_post` helper's None-signature sentinel clobbered the missing-signature case → `omit_signature` flag.
- Task 3 gates: 752 pytest / ruff 0 / mypy strict 0 (19 billing files) / check clean / makemigrations --check clean.
- Task 4: bridge task already defined in webhooks.py (the view references `grant_credits.delay`); Task 4 added the MANDATORY explicit import in config/celery.py (Winston Q2 — autodiscover only scans `<app>.tasks`) + 6 task tests (name pinned as a 5.3 contract, registry probe `grant_credits registered: True`, missing-row/anonymised-row safety, no ledger writes). One ruff fix: import block ordering in celery.py (apps.* before tasks.*).
- Task 5: production.py now REQUIRES `CHARGILY_API_KEY`/`CHARGILY_WEBHOOK_SECRET` (KeyError pattern), `CHARGILY_MODE` defaults 'live'; settings tests (pin test values, requires-the-secrets, env-resolution via `importlib.reload` — the module cache would otherwise mask the KeyError); secret-hygiene tests (no secrets in frontend src/messages/public, no logger lines referencing the keys in chargily.py/webhooks.py); `.env.example` gained CHARGILY_SUCCESS_URL/FAILURE_URL.
- Task 5 gates: 763 pytest / ruff 0 / mypy strict 0 (143 files) / check clean / makemigrations --check clean.
- Phase 5 E2E (docker PG16, host 5433 — the 4.6 port-conflict lesson): clean migrate (full chain incl. billing 0001+0002); billing suite on real PG 97/97; E2E script 20/20 — create-checkout (mocked Chargily client; API login — DRF uses cookie-JWT, `force_login` sessions are not honored) → 200 {checkout_url, checkout_id}, no DB row, correct CIB/EDahabia+DZD+metadata POST; webhook valid checkout.paid → row on PG (normalized id `evt_e2e_1`, type subscription_creation, amount, pending, user resolved, shaped metadata); raw psycopg2 SELECT returns the JSONB as TEXT (unregistered jsonb loader) → parsed and compared equal; duplicate replay → 200 single row; bad signature → 400 no row; payment_failed → 200 no row; unknown event → 200; raw `ON CONFLICT DO NOTHING RETURNING` on PG returns no row for a duplicate event id (AD-5 proof on real PG). E2E rows cleaned; container removed; temp script deleted. Final regression (SQLite): 763 pytest / ruff 0 / mypy strict 0 (151 files) / check clean / makemigrations --check clean.
- Review phase (after the story commit): 14 patches applied (full list in Review Findings) — including the registry-test fix (the CLI probe became a shipped `test_task_registered_in_celery_registry`; celery's shared_task returns a proxy so identity was dropped for membership+name), the production-KeyError test env setup, and 8 new webhook/view tests. Gates after patches: 775 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations --check clean; PG16 (host 5433) re-verification of the patched DB path: billing + settings suite 114/114; container removed. One review-test fix cycle: ruff I001 import order (django.db before the local webhooks import) + a merged line from my edit (SyntaxError) — both fixed before the final gates.
- RC-1 (interactive review, user decision 2026-08-09): `grant_credits` relocated from `webhooks.py` to `apps/billing/tasks.py`; celery.py explicit import retargeted; task name re-pinned `apps.billing.tasks.grant_credits`; test_tasks.py updated (import, name pin, positive explicit-import contract, new regression guard `test_webhooks_module_holds_no_task_definitions`). KEY DISCOVERY during the patch: `app.autodiscover_tasks()` does NOT register app tasks in this project — `config/__init__.py` imports the celery app during `django.setup()` (pre-registry) so autodiscovery no-ops; the project's own "explicit import so Celery registers tasks" comments confirm the authors hit this before. RC-1 as first planned relied on autodiscovery — corrected mid-patch to keep the explicit import (D18 amended). Gates after RC-1: 776 pytest / ruff 0 / mypy strict 0 (32 billing+config files) / check clean / makemigrations --check clean; registry probe: `apps.billing.tasks.grant_credits registered: True`, old webhooks name gone. PG16 re-verify EXCLUDED — RC-1 changes no DB path (the raw-SQL insert in webhooks.py is untouched; the previous 114/114 PG run covered it) and the Docker daemon was down at patch time (recorded per the 4.4/4.5 exclusion precedent).

### Completion Notes List

- (populated at completion)

### File List

- `backend/apps/billing/chargily.py` (NEW — Task 1: client + signature verification + CheckoutDetails)
- `backend/apps/billing/tests/test_chargily.py` (NEW — Task 1: 12 client tests)
- `backend/requirements.txt` (MODIFIED — Task 1: `requests>=2.31,<3.0`, user-approved)
- `backend/config/settings/base.py` (MODIFIED — Task 1: CHARGILY_* settings, env-sourced)
- `backend/config/settings/test.py` (MODIFIED — Task 1: pinned test CHARGILY_* values)
- `backend/apps/billing/views.py` (NEW — Task 2: CreateCheckoutView)
- `backend/apps/billing/urls.py` (NEW — Task 2: billing routes, app_name='billing')
- `backend/config/urls.py` (MODIFIED — Task 2: /api/billing/ route)
- `backend/apps/billing/tests/test_checkout_view.py` (NEW — Task 2: 11 view tests)
- `backend/apps/billing/webhooks.py` (NEW — Task 3: webhook view; the grant_credits task moved out to tasks.py by RC-1)
- `backend/apps/billing/tasks.py` (NEW — Task 4/RC-1: `grant_credits` bridge task, home of the 5.3 grant logic)
- `backend/apps/billing/webhooks_urls.py` (NEW — Task 3: /api/webhooks/chargily/ route)
- `backend/config/urls.py` (MODIFIED — Task 3: /api/webhooks/ route)
- `backend/apps/billing/tests/test_webhook.py` (NEW — Task 3: 19 webhook tests)
- `backend/config/celery.py` (MODIFIED — Task 4: explicit `import apps.billing.webhooks`)
- `backend/apps/billing/tests/test_tasks.py` (NEW — Task 4: 6 bridge-task tests)
- `backend/config/settings/production.py` (MODIFIED — Task 5: required CHARGILY secrets)
- `backend/tests/test_chargily_settings.py` (NEW — Task 5: 5 settings + hygiene tests)
- `.env.example` (MODIFIED — Task 5: CHARGILY_SUCCESS_URL/FAILURE_URL)

### Change Log

- 2026-08-09: Story created (ready-for-dev) from the epic 5.2 planning spec; sprint-status 5-2 → ready-for-dev → in-progress (UTF-16 LE preserved); epic-5 already in-progress.
- 2026-08-09: Persona consultations (parallel subagents — Winston/John; Sally excluded, backend-only): design APPROVED with 3 mandatory fixes (raw-SQL Python-side defaults + fetchone-detection, `checkout_id` in the create-checkout response, pre-insert amount/event-id validation → 400); scope RATIFIED (bridge task, pass-through, payment_failed 200-ack, unknown-event 200-ack, NULL-user insert, first-write-wins); ONE AC amendment recorded verbatim (John S7 — Action column deferred to 5.3+; clause-6 bridge note). Dev Notes D12-D20 + consultation record added.
- 2026-08-09: Implemented (TDD) — Task 1 client (requests dep user-approved, docs envelope pinned with D11 risk, 12 tests), Task 2 create-checkout (11 tests), Task 3 webhook (19 tests; raw-SQL guarded insert, shaped metadata, event-id normalization, payment_failed/unknown 200-acks), Task 4 grant_credits bridge + celery.py explicit registration (6 tests, worker registry probe), Task 5 settings + secret hygiene (5 tests). Gates green after every task (722 → 763 pytest). Phase 5 real-stack: PG16 (host 5433) migrate clean, billing suite 97/97 on PG, E2E 20/20, cleanup, container removed; final regression green. Status → review (sprint-status 5-2 → review).
- 2026-08-09: Code review (full mode — Blind Hunter 18 + Edge Case Hunter 12 + Acceptance Auditor: all ACs SATISFIED, 763 reproduced, no checkbox discrepancies; review subagents ran on the same model family — the different-LLM preference was unavailable and is noted). Triage: 14 patches + 3 defers + 5 dismissed; no decision-needed items; user approved applying all patches. All 14 applied (Review Findings): amount-fallback, user-deletion-race NULL-user fallback, non-dict-body 400s, payment_failed-without-id ack, real registry test, production-KeyError test env, 413 body cap, global-requests no-outbound test, numeric user_id, server_mode in shaped metadata, AD-14 retry on the bridge, chargily.py JSON/shape guards, event-type lowercasing + subscription_id strip, ERROR logs on business-400 paths. 3 defers → deferred-work.md (envelope conformance pre-prod gate, checkout_id metadata semantics → 5.6, replay-after-purge re-grant window). Gates re-run green: 775 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations --check clean; PG16 re-verification of the patched DB path 114/114. Status → done (sprint-status 5-2 → done; epic-5 stays in-progress). NOTE on commits: the review ran on the working tree BEFORE the story commit (per Phase 7's "target = current working tree"), so the implementation and its review-hardening patches land in the story commit; the review-follow-up commit carries the findings documentation, defers, and status flips — a synthetic split of the code across two commits would falsify history.
- 2026-08-09: RC-1 applied (interactive code review, user decision — task relocation to `apps/billing/tasks.py`; see Review Findings + Debug Log; the autodiscovery assumption was disproved mid-patch and the explicit celery.py import kept/retargeted — D18 amended). Gates: 776 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations --check clean; registry probe True under the new task name. Committed as its own review-patch commit.

## Review Findings

Full-mode review 2026-08-09 (parallel: Blind Hunter 18 + Edge Case Hunter 12 + Acceptance Auditor — all ACs SATISFIED, 763 reproduced, no checkbox discrepancies; review subagents ran as fresh-context agents on the same model family — the "different LLM" preference was not available and is noted). Triage: 14 patches + 3 defers + 5 dismissed; no decision-needed items (user approved applying all patches). Patches re-verified: 775 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations clean; PG16 billing suite 114/114 after the DB-path patches (P1/P2/P9/P10).

- [x] [Review][Patch] Amount fallback (B1+E9): a glitched provider `amount` (0 or >2^31-1) with a valid metadata amount rejected the whole event with 400 — the paid transaction was never recorded. Fix: pick the FIRST VALID candidate in provider→metadata order. [backend/apps/billing/webhooks.py] + `test_glitched_provider_amount_falls_back_to_metadata`.
- [x] [Review][Patch] User-deletion race (B2+E11): the `_resolve_user` SELECT → INSERT window; the daily anonymise+purge task can delete the user in between → FK IntegrityError → 500 → Chargily retry storm. Fix: catch IntegrityError → re-insert with user_id NULL (the 5.1 D2 anonymised posture) → 200. [backend/apps/billing/webhooks.py] + `test_user_vanishing_before_insert_falls_back_to_null_user`.
- [x] [Review][Patch] create-checkout non-dict body → 500 (B4+E4/E5): `request.data` trusted as a dict — array/scalar bodies AttributeError'd (the custom exception handler passes non-APIExceptions through); unhashable `type` (list) raised TypeError. Fix: non-dict body → 400; `type` must be a str. [backend/apps/billing/views.py] + array/scalar/unhashable-type tests.
- [x] [Review][Patch] payment_failed without an event id → 400 retry loop (B6): the ack carve-out only held when the payload carried `data.id`. Fix: event-type dispatch precedes the id requirement; payment_failed/unknown types ack 200 unconditionally (id logged when present). [backend/apps/billing/webhooks.py] + `test_payment_failed_without_event_id_is_acked`.
- [x] [Review][Patch] Real registry test (B8): the record's "worker registry probe" was a CLI one-off, not a shipped test. Fix: `test_task_registered_in_celery_registry` asserts registry membership + name (celery's `shared_task` returns a proxy, so `is`-identity was dropped for membership+name — honest check); `test_task_retry_policy_matches_ad14` pins max_retries=3 + autoretry. [backend/apps/billing/tests/test_tasks.py]
- [x] [Review][Patch] Vacuous production-KeyError test (B9): passed even if the CHARGILY required-var lines were deleted (DJANGO_SECRET_KEY raised first in the test env). Fix: set the other required env vars so the KeyError must come from the CHARGILY lines. [backend/tests/test_chargily_settings.py]
- [x] [Review][Patch] Unbounded webhook body DoS (B10+E12): raw POST body read with no size cap on the only public unauthenticated endpoint (Django's DATA_UPLOAD_MAX_MEMORY_SIZE does not bound raw bodies). Fix: Content-Length pre-check → 413 before reading the body (MAX_WEBHOOK_BYTES = 1MB). [backend/apps/billing/webhooks.py] + `test_oversized_body_rejected_before_signature`.
- [x] [Review][Patch] Vacuous no-outbound test (B11): patched `apps.billing.chargily.requests.post`, which the webhook path never touches. Fix: patch global `requests.post`. [backend/apps/billing/tests/test_webhook.py]
- [x] [Review][Patch] Numeric user_id bypass (B14+E7): a JSON-number user_id silently produced a NULL-user row (str-only guard) → 5.3 grant refused for a live user. Fix: coerce to str before resolution. [backend/apps/billing/webhooks.py] + `test_numeric_user_id_still_resolves`.
- [x] [Review][Patch] Dead `CHARGILY_MODE` config (B15): defined in settings, never read. Fix: the SERVER-configured mode is recorded in the shaped metadata (`server_mode`) — the payload's own `mode` is Chargily's view; the server mode is the operator's key mode. [backend/apps/billing/webhooks.py, backend/apps/billing/tests/test_webhook.py]
- [x] [Review][Patch] Bridge task missing AD-14 retry (B17): AD-14 mandates 3 retries with exponential backoff for payment reconciliation; the task had none (default ack-early path). Fix: `autoretry_for=(Exception,), retry_kwargs={'max_retries': 3}, retry_backoff=True` (the email_tasks precedent shape). [backend/apps/billing/webhooks.py]
- [x] [Review][Patch] chargily.py response guards (E1/E2/E3): 2xx non-JSON body → JSONDecodeError 500; non-dict root → AttributeError 500; whitespace-only URLs passed truthiness. Fix: typed ChargilyError + strip() checks. [backend/apps/billing/chargily.py]
- [x] [Review][Patch] Event-type case + empty subscription_id (E6/E8): 'Checkout.Paid' was silently acked as unknown (revenue lost — the mapping never ran); '' subscription_id misclassified as a renewal. Fix: event_type lowercased before dispatch; subscription_id must be non-whitespace. [backend/apps/billing/webhooks.py] + tests.
- [x] [Review][Patch] Business-400 paths now log ERROR (B5 partial): valid-signature events rejected (missing id, invalid amount) log ERROR with correlation before the 400 — a glitched-but-paid event is at least visible. Full dead-letter/audit surface deferred to 5.3 (below). [backend/apps/billing/webhooks.py]
- [x] [Review][Defer] Chargily envelope conformance (B3): the executable pin tests are self-consistent, not docs-conformant (docs.chargily.com unreachable at pin time — D11). PRE-PROD GATE: verify the X-Signature scheme (header name, digest encoding, raw-body semantics) and the checkout payload against the live Chargily docs before enabling webhooks in production; the adapter is isolated for a single-file correction. — deferred (deferred-work.md)
- [x] [Review][Defer] Shaped-metadata `checkout_id` semantics (B13): the field stores `data.id` (the same value normalized into chargily_event_id); the REAL Chargily checkout id from the create-checkout response is the 5.6 polling key. The 5.6 status-polling lookup must not rely on the metadata `checkout_id` field until the payload semantics are pinned. — deferred to 5.6 (deferred-work.md)
- [x] [Review][Defer] Replay-after-purge re-grant window (E10): the 90-day retention purge (5.1 D2) deletes the AD-5 guard row; a replayed event id becomes insertable again → double grant. Tombstone/retention design needed (5.3+/ops). — deferred (deferred-work.md)
- [x] [Review][Dismiss] Case-normalization collapse (B7): `.strip().lower()` collapses case-differing event ids — but the normalization was the RECORDED resolution of deferred-work #5 (5.1 review) and Chargily-generated ids are case-stable; first-write-wins is the AD-5 semantics.
- [x] [Review][Dismiss] 200-masks-lost-enqueue (B16): exactly the documented D15 window (enqueue failure → duplicate ack → recovery via the 5.3 pending-reconciliation sweep); the AC mandates 200 on duplicates.
- [x] [Review][Dismiss] Planning-spec AC not amended (B12 + Auditor note): the amendment lives in the implementation record — the 5.1 F1 precedent (the record is the authoritative contract; planning specs stay draft).
- [x] [Review][Dismiss] amount 0-vs-1 divergence (B18): the webhook rejects < 1 DZD while the schema CHECK allows 0 — deliberate D13 validation (a 0-DZD checkout cannot exist; the CHECK lower bound predates 5.2 and covers other writers).
- [x] [Review][Dismiss] Envelope self-consistency (B3 second half): covered by the conformance defer + D11.
- [x] [Review][Patch] RC-1 — relocate `grant_credits` from `webhooks.py` to `apps/billing/tasks.py` (interactive review, user decision 2026-08-09): the task's name is derived from its module path and pinned as a 5.3 contract — moving now (pre-deployment, nothing wired) is the cheapest moment; 5.3 grows the task substantially and webhooks.py should hold only the HTTP view. The spine's L532/L540 contradiction resolves toward the repo's tasks convention. KEY mid-patch discovery: `app.autodiscover_tasks()` no-ops in this project (config/__init__ imports celery during django.setup, pre-registry) — the explicit `import apps.billing.tasks` in config/celery.py is MANDATORY (D18 amended; the email_tasks/maintenance_tasks precedent), so the initial "autodiscovery covers it" plan was corrected before landing. Tests: import/name pins updated, positive explicit-import contract, new `test_webhooks_module_holds_no_task_definitions` regression guard. Gates: 776 pytest / ruff 0 / mypy strict 0 / check clean / makemigrations clean; registry probe True under the new name. PG16 re-verify excluded (no DB-path change; Docker daemon down at patch time). [backend/apps/billing/tasks.py, backend/apps/billing/webhooks.py, backend/config/celery.py, backend/apps/billing/tests/test_tasks.py]
