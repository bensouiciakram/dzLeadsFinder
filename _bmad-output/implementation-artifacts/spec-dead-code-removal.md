---
title: 'Dead Code Removal — Backend'
type: 'refactor'
created: '2026-08-14'
baseline_commit: '90c67dd'
status: 'done'
review_loop_iteration: 0
context:
  - 'docs/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Django backend (`config/`, `apps/*`, `tasks/`, `scrapers/`, `tests/`) has accumulated dead, unused, or obsolete code across five delivered epics; this makes the codebase harder to navigate and masks real issues.

**Approach:** Audit the backend module-by-module, classify every candidate (CONFIRMED DEAD / LIKELY DEAD / INTENTIONALLY UNUSED / UNCERTAIN), remove only CONFIRMED DEAD code in small batches with a test/lint/type verification gate per batch, commit each batch separately, and produce a final report. No refactoring, renaming, or consolidation during this pass.

## Boundaries & Constraints

**Always:**
- Audit one module fully (audit → classify → remove → verify) before moving to the next. Order: `config/` → `apps/accounts` → `apps/credits` → `apps/search` → `apps/exports` → `apps/billing` → `tasks/` → `scrapers/` → `tests/`.
- Consider ALL usage types before declaring anything dead: direct imports, re-exports, dynamic imports, runtime discovery, framework conventions, config files, CLI/management commands, tests/fixtures, URL routing, serialization, dependency injection, plugin/registry systems, generated code, env-based behavior, Celery task registration, Django admin registration, settings imports.
- Tie confidence to test coverage. A candidate that would be CONFIRMED DEAD but has zero test coverage is downgraded to LIKELY DEAD.
- Remove only CONFIRMED DEAD. Never remove LIKELY DEAD, INTENTIONALLY UNUSED, or UNCERTAIN. Record file:line for every LIKELY DEAD and UNCERTAIN item in the final report.
- Clean up imports/exports/references that become unused as a direct consequence of a deletion, within that same batch.
- Commit each removal batch separately, message stating what was removed and why. Commit locally only — NEVER push to the remote.
- Run verification after each batch: `pytest`, `ruff check .`, `mypy .`, plus `pytest --cov --cov-report=term-missing` (after pytest-cov install) to confirm coverage does not drop unexpectedly.
- Strictly ignore: `migrations/`, `node_modules`, `.venv`, `__pycache__`, build artifacts, `manage.py`, `Dockerfile`, `pyproject.toml`. Exception (human-renegotiated 2026-08-14): `requirements.txt` may be edited ONLY to add the dev-tooling lines authorized in Tasks (`pytest-cov`, `coverage`).
- If a verification failure is caused by the cleanup, fix it within scope. If pre-existing and unrelated, note the distinction, do not fix it.
- Protect code referenced by `docs/ARCHITECTURE-SPINE.md`, `_bmad-output/implementation-artifacts/deferred-work.md`, or `_bmad-output/implementation-artifacts/manual-review-notes.md`.

**Ask First:**
- Any candidate the agent wants to remove that crosses a module boundary or touches public API surface (URLs, serializers, admin registrations) — present evidence, HALT for approval.
- Any LIKELY DEAD candidate the human might want to remove anyway — always list in the report, never auto-delete.

**Never:**
- Do not refactor, redesign, optimize, rename, or reorganize code during this phase.
- Do not consolidate duplicates or extract shared modules — that is a separate future pass.
- Do not remove code reserved for future/planned work (scrapers scaffolding for Epic 6, deferred-work items, TODO-marked intent).
- Do not delete tests, test fixtures, or the conftest.
- Do not modify frontend code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| UNUSED_FILE | file with no references anywhere in backend | classified, removed in batch | if zero test coverage → LIKELY DEAD, kept |
| UNUSED_SYMBOL | function/class/const with no references | classified CONFIRMED, removed | if framework-registered (admin/URL/task/command) → preserved |
| FUTURE_INTENT | scraper scaffolding, deferred-work targets, TODO code | INTENTIONALLY UNUSED, preserved | recorded in report |
| UNCERTAIN | insufficient evidence | preserved, file:line recorded | listed in report |
| VERIFY_FAIL | tests/lint/type fail after batch | fix within scope, re-verify | pre-existing failure → noted, not fixed |

</frozen-after-approval>

## Code Map

- `backend/config/` -- settings split (base/development/production/test/ci_pg), celery, urls, wsgi/asgi; check for obsolete settings/urls
- `backend/apps/{accounts,credits,search,exports,billing}/` -- Django apps: models, views, serializers, admin, urls, services, tasks, messages, pricing, filters, fts, quota, data/ (wilayas, industries)
- `backend/apps/*/migrations/` -- strictly ignored
- `backend/apps/search/management/commands/seed_demo_data.py` -- CLI command, framework-registered, preserve unless dead
- `backend/tasks/email_tasks.py`, `maintenance_tasks.py` -- Celery tasks, referenced by beat schedule and webhook paths
- `backend/scrapers/` -- Epic 6 scaffolding (empty `__init__` + management/commands stubs) — audit only, all INTENTIONALLY UNUSED
- `backend/tests/` -- root-level tests (health, email, maintenance, chargily settings)
- `backend/conftest.py`, `backend/manage.py`, `backend/pyproject.toml`, `backend/requirements.txt` -- infrastructure, never modify except pytest-cov add
- `docs/ARCHITECTURE-SPINE.md` -- authoritative list of live endpoints/tasks/commands; anything referenced here is preserved

## Tasks & Acceptance

**Execution:**
- [x] `backend/requirements.txt` -- add `pytest-cov>=5.0,<7.0` -- coverage tooling for the confidence rule
- [x] `backend/` -- run green baseline: `pytest`, `ruff check .`, `mypy .`, `pytest --cov --cov-report=term-missing` -- record baseline results + coverage % in final report
- [x] `backend/config/` -- audit → classify → remove CONFIRMED DEAD in small batches → verify → commit per batch
- [x] `backend/apps/accounts/` -- same cycle (repeat for credits, search, exports, billing)
- [x] `backend/tasks/` -- same cycle
- [x] `backend/scrapers/` -- audit only; everything preserved as INTENTIONALLY UNUSED (Epic 6)
- [x] `backend/tests/` -- audit; tests themselves never deleted
- [x] `backend/` -- final verification sweep + write Final Report section to this spec

**Acceptance Criteria:**
- Given the backend before any change, when baseline verification runs, then pytest/ruff/mypy pass and coverage % is recorded.
- Given a module being audited, when all its dead-code candidates are classified, then only CONFIRMED DEAD items are removed.
- Given a removal batch, when verification runs, then pytest/ruff/mypy all pass before the batch is committed.
- Given the cleanup run, when it completes, then `pytest`, `ruff check .`, `mypy .` all pass with no new coverage drop vs baseline.
- Given the final report, when presented, then it lists Removed (with commits), Preserved, and Uncertain (with file:line).
- Given the whole run, when git history is inspected, then every commit is a local-only batch commit with what/why in the message, and no push occurred.

## Spec Change Log

- **2026-08-14 — finding: frozen intent self-contradiction (Edge Case Hunter).** The Never-list's "Strictly ignore ... requirements.txt" contradicted the execution task adding pytest-cov to it. Amended: the Always list now carries a human-renegotiated exception permitting `requirements.txt` edits ONLY for the dev-tooling lines authorized in Tasks. Avoids: ambiguous rules inherited by the follow-up frontend pass. KEEP: the exception's narrow scope (only pytest-cov/coverage lines); the frozen section remains human-owned.

## Final Report (2026-08-14)

**Execution context:** baseline_commit `90c67dd`; coverage baseline measured at `5fd8ecf` (post pytest-cov install); HEAD at pass start `5fd8ecf`. The `deferred-work.md` dead-code entry and the spec file are artifacts of this pass (untracked at pass start). One removal was executed; the full report below reflects the pass as completed, including review-loop corrections.

### Removed

- `backend/apps/billing/chargily.py` — `create_checkout` (legacy pre-5.6 wrapper returning only the URL string, superseded by `create_checkout_details` which also returns the checkout id). CONFIRMED DEAD: zero production references (views import only `create_checkout_details`), covered by 11 test call sites — coverage confirmed removal safety per the confidence rule. The 11 call sites in `apps/billing/tests/test_chargily.py` were updated to `create_checkout_details` (asserting `.checkout_url`); tests retained, no test deleted. Commit: `b074783`.

No other CONFIRMED DEAD code existed. Evidence base per module: full reads of every non-test, non-migration backend file; `ruff check --select F401,F841,F811` (clean — no low-hanging fruit); an AST zero-reference scan (every hit framework-registered by name or test-pinned); plus targeted greps for every suspicious constant/field (`credits_banner_dismissed_at`, `MAX_KEYWORD_LENGTH`, `SENIORITY_BANDS`, `SEARCH_FILTER_KEYS`, `EXPORT_PEOPLE/COMPANY_COLUMNS`, `LEDGER_RETENTION_DAYS`, `DEPENDENT_MODELS`, `chargily_checkout_url`, `PROMOTIONAL_GRANT`).

Module results:
- `config/` — all URLs wired (`health_check`/`health_live` both routed), all celery imports + beat entries live (`apps.billing.tasks`, `tasks.email_tasks`, `tasks.maintenance_tasks`; 5 of 5 schedule entries resolve to registered tasks), settings keys all consumed (framework-registered by name; `ci_pg.py` is the documented PG CI job). Nothing dead.
- `apps/accounts/` — all views routed; `check_email_verified`/`touch_activity`/`validate_user_token`/`TokenWithVersion*`/`SignupSerializer`/`custom_exception_handler`/admin all referenced; model fields all used by views/admin/tasks (incl. `checklist_dismissed_at`, `credits_banner_dismissed_at` → `apps/search/views.py`). Nothing dead.
- `apps/credits/` — every enum member exercised (`EXPIRY`/`PACK_GRANT`/`SUBSCRIPTION_GRANT` in `apps/billing/tasks.py`, `PROMOTIONAL_GRANT` in tests — and schema-pinned, see Preserved); every service function and view helper referenced; admin surfaces append-only-registered. Nothing dead.
- `apps/search/` — all views wired; `MAX_KEYWORD_LENGTH`/`MAX_SAVED_SEARCH_NAME_LENGTH` consumed by serializers; `SENIORITY_BANDS`/`SIZE_BANDS` by serializers + seed command; `SEARCH_FILTER_KEYS` pinned by tests; data files consumed by migrations 0003/0004 + parity tests; `seed_demo_data` management command framework-registered + tested. Nothing dead.
- `apps/exports/` — registry/dispatch/mime all live; `EXPORT_PEOPLE_COLUMNS`/`EXPORT_COMPANY_COLUMNS` are test-pinned column-order contracts; all messages consumed; `EXPORT_DAILY_ROW_LIMIT` consumed. Nothing dead.
- `apps/billing/` — all views wired; webhook helpers all called; all tasks registered + beat-scheduled (or called via `.delay`); pricing table fully consumed by views/tasks. Nothing dead beyond `create_checkout` (removed).
- `tasks/` — all 5 email tasks + `hard_delete_expired` registered and called/beat-scheduled; `check_low_credits` is beat-scheduled and RUNS daily (live no-op stub, see Preserved). `DEPENDENT_MODELS` entry see Preserved.
- `scrapers/` — audit only: three empty `__init__.py` files, zero code. INTENTIONALLY UNUSED (Epic 6), preserved.
- `tests/` — audit only; tests never deleted (root-level health/email/maintenance/chargily-settings suites all pass).

### Preserved (suspicious-but-kept)

- `backend/apps/billing/models.py:113` — `PaymentTransaction.chargily_checkout_url`: no production read/write path (the webhook INSERT omits it; no view reads it; the admin's `readonly_fields` enumerates it only under `has_change_permission=False`). Protected on three axes: pinned in `migrations/0001_initial` (Never touch migrations), asserted by `apps/billing/tests/test_models.py:232,346` (Never delete tests), and listed in the spine DDL (`docs/ARCHITECTURE-SPINE.md` payment_transactions table). Dead column, non-removable within this pass's constraints.
- `backend/apps/credits/models.py:13` — `CreditEventType.PROMOTIONAL_GRANT`: production-unused, referenced only by tests — but **schema-pinned**: migration `0001_initial`'s `credit_ledger_event_type_check` constraint allows `promotional_grant`, and `apps/credits/tests/test_models.py:55-57` pins the enum to exactly the DB-allowed set. Removing the member while the constraint stands would desync enum and schema. INTENTIONALLY UNUSED — removable only in a future pass that also alters the migration constraint.
- `backend/tasks/maintenance_tasks.py:15` — `('search', 'Search')` in `DEPENDENT_MODELS`: provably inert today (`apps.get_model('search','Search')` raises `LookupError` → `continue`), but `docs/ARCHITECTURE-SPINE.md:191` documents a planned `searches` table — forward wiring for the Search model. INTENTIONALLY UNUSED; keep (removal would silently stop cleaning that app's rows when the model lands).
- `backend/tasks/email_tasks.py:422` — `check_low_credits`: beat-scheduled daily stub with TODO (Story 4.x intent) — scheduled and running as a no-op, not "unused"; kept.
- `backend/apps/search/data/wilayas.py`, `industries.py` — consumed by migrations 0003/0004 and the wilaya/industry parity tests.
- `backend/apps/exports/messages.py:12-20` — `EXPORT_PEOPLE_COLUMNS`/`EXPORT_COMPANY_COLUMNS`: production-unused (headers flow from `EXPORT_CSV_HEADERS`), pinned by `test_generation.py:193-205` as the stable-order contract.
- `backend/apps/search/filters.py:19` — `SEARCH_FILTER_KEYS`: production-unused, pinned by `test_filters.py:38`.
- `backend/scrapers/*` — all empty scaffolding — INTENTIONALLY UNUSED (Epic 6).

### LIKELY DEAD (kept, recorded per spec rule)

None remaining — the only item initially flagged LIKELY (`('search','Search')`) was reclassified INTENTIONALLY UNUSED after review (spine documents the planned `searches` table).

### Uncertain

None — every candidate resolved to a definitive classification.

### Ask-First gate

Not triggered during the pass (no removal candidate touched URLs, serializers, or admin registrations). `create_checkout` was confirmed dead within the spec's rules (covered by tests = safe to remove; tests updated, not deleted). `chargily_checkout_url` and `PROMOTIONAL_GRANT` remain removal candidates ONLY under relaxed constraints (migration edits permitted) — flagged for human awareness.

### Review-loop corrections (2026-08-14)

Applied from the adversarial review pass: `create_checkout` removed (was under-classified as Preserved); `PROMOTIONAL_GRANT` and `('search','Search')` reclassified INTENTIONALLY UNUSED with corrected evidence; `chargily_checkout_url` rationale corrected (admin readonly_fields note); `check_low_credits` reclassified (scheduled no-op, not unused); `.coverage` added to `.gitignore`; transitive `coverage` pinned in `requirements.txt`; coverage command scoped to explicit source paths; frozen-intent contradiction resolved (pytest-cov exception recorded in Always list).

### Verification (final sweep, 2026-08-14)

- `pytest` → **963 passed**, 1032 warnings (pre-existing, unchanged from baseline).
- `ruff check .` → **All checks passed**.
- `mypy .` → **Success: no issues found in 164 source files**.
- `pytest --cov --cov-report=term-missing` → **99% (10143 stmts, 110 missed)** — 2-statement drop vs baseline (10145) = exactly the removed `create_checkout` function body; no live-code drop.
- Per-batch verification: full suite green after the removal batch (963 passed before and after).
- Introduced vs pre-existing: no failures were introduced; all warnings pre-existing.

### Commits

- `5fd8ecf` — chore: add pytest-cov (+coverage pin follows) for the coverage gate
- `b074783` — refactor: remove dead `create_checkout` wrapper, tests updated to `create_checkout_details`

All commits local; **no push occurred**. Post-pass `git status`: `deferred-work.md` (this pass's deferral entry) + untracked spec file + `.coverage` (now gitignored).

## Verification

**Commands:**
- `pytest` (workdir `backend/`) -- expected: all tests pass
- `ruff check .` (workdir `backend/`) -- expected: no violations
- `mypy .` (workdir `backend/`) -- expected: no errors
- `pytest --cov=config --cov=apps --cov=tasks --cov=scrapers --cov=conftest.py --cov-report=term-missing` (workdir `backend/`) -- expected: coverage >= baseline, no unexpected drops

## Suggested Review Order

**Dead code removal (entry point)**

- Legacy pre-5.6 wrapper gone — `create_checkout_details` is the only live checkout contract; the shared `_create_checkout` helper is untouched
  [`chargily.py:100`](../../backend/apps/billing/chargily.py#L100)

- The 11 former `create_checkout` call sites now target the live API and assert `.checkout_url` — same payload assertions, same error paths
  [`test_chargily.py:43`](../../backend/apps/billing/tests/test_chargily.py#L43)

**Coverage-gate tooling**

- `pytest-cov` enables the confidence rule (coverage = removal safety); `coverage` pinned so the transitive dep cannot break the py3.10 venv
  [`requirements.txt:16`](../../backend/requirements.txt#L16)

- `.coverage` artifact gitignored so the per-batch gate no longer dirties `git status`
  [`.gitignore:41`](../../.gitignore#L41)