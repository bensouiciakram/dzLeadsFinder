---
story_id: 3.1
epic: 3
title: Story 3.1 — Search Database Schema
status: done
frs: [FR-5, FR-6, FR-7, FR-9, FR-10, FR-11, FR-12, FR-13]
ads: [AD-3, AD-11]
baseline_commit: 060c11b5f21e0f723f52eba9a2cbac70c0f9b2b2
---

# Story 3.1: Search Database Schema

Status: done

## Story

As a **developer**,
I want **the PostgreSQL schema for people, companies, daily rate limits, and enumeration tables created via Django migrations**,
So that **search, filter, and rate-limiting features have a data foundation**.

## Acceptance Criteria

**Given** the migrations run
**When** I inspect the database
**Then** these tables exist with the specified schema:

```sql
companies
  id UUID PRIMARY KEY
  name TEXT NOT NULL
  industry_id INTEGER REFERENCES industries(id)
  wilaya_code SMALLINT REFERENCES wilayas(code)
  size_band TEXT
  website TEXT
  source TEXT NOT NULL
  last_verified_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
  search_vector tsvector (GIN index)

people
  id UUID PRIMARY KEY
  company_id UUID REFERENCES companies(id)
  name TEXT NOT NULL
  role TEXT
  seniority TEXT
  email TEXT
  phone TEXT
  address TEXT
  source TEXT NOT NULL
  last_verified_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
  search_vector tsvector (GIN index)

daily_usage
  user_id UUID REFERENCES users(id)
  date DATE NOT NULL
  search_count INTEGER DEFAULT 0
  export_rows INTEGER DEFAULT 0
  PRIMARY KEY (user_id, date)

wilayas
  code SMALLINT PRIMARY KEY (1-58)
  name_ar TEXT NOT NULL
  name_fr TEXT NOT NULL
  name_en TEXT NOT NULL

industries
  id SERIAL PRIMARY KEY
  name_ar TEXT NOT NULL
  name_fr TEXT NOT NULL
  name_en TEXT NOT NULL
  is_active BOOLEAN DEFAULT TRUE
```

**Given** the search index setup
**When** I inspect the `search_vector` columns
**Then** they use PostgreSQL `tsvector` with per-language text search configurations
**And** `unaccent` extension is enabled for French diacritic-insensitive matching
**And** Arabic diacritics (tashkeel) are stripped at write time to a normalized search column

**Given** the enumerations are seeded
**When** I check the `wilayas` table
**Then** exactly 58 rows exist with codes 1-58 and trilingual names

**Given** the `industries` table
**When** I check the seed data
**Then** at least 30 industries are seeded with trilingual names and `is_active = TRUE`

**Given** the `daily_usage` table
**When** a query checks rate limits
**Then** reset happens naturally at 00:00 Africa/Algiers via `CURRENT_DATE` key

## Tasks / Subtasks

- [x] **Task 1: Backend — `search_index.py` normalization module** (AC: search index setup)
  - [x] 1.1 RED: `backend/apps/search/tests/test_search_index.py` — NEW — `strip_tashkeel('شَرِكَةُ التِّجَارَةِ')` == `'شركة التجارة'` (U+064B–U+0652 removed; also U+0653–U+0655, U+0670, U+0640 tatweel — e.g. `'قـطر'` → `'قطر'`); non-Arabic text untouched; empty string → empty; `unaccent_text('Électricité Générale')` == `'Electricite Generale'` (NFKD + combining-mark filter); `normalize_search('  BÂTIMENT  ', 'ÉNERGIE', '')` == `'batiment energie'` (lowercase, unaccented, whitespace collapsed, empty parts dropped); single part; all-empty parts → `''`
  - [x] 1.2 GREEN: `backend/apps/search/search_index.py` — NEW — `strip_tashkeel(text: str) -> str` via `str.translate` table of Arabic diacritic codepoints; `unaccent_text(text: str) -> str` via `unicodedata.normalize('NFKD', ...)` + `unicodedata.combining` filter; `normalize_search(*parts: str) -> str` = lowercase + per-part unaccent + strip_tashkeel + collapse internal whitespace (`re.sub(r'\s+', ' ', ...).strip()`); mypy-strict annotations; module docstring only (no code comments)

- [x] **Task 2: Backend — search app models + migration 0001** (AC: tables exist)
  - [x] 2.1 RED: `backend/apps/search/tests/test_models.py` — NEW — introspection tests: all 5 tables exist via `connection.introspection.table_names()`; per-table columns exist (`industry_id` INTEGER, `wilaya_code` SMALLINT, `user_id` BIGINT — see Dev Notes D6, `date` DATE, `search_count`/`export_rows` INTEGER, `code` SMALLINT PK, `is_active` BOOLEAN, company/person `id` UUID via ORM field introspection); FKs: company→industry, company→wilaya, person→company, daily_usage→users (assert via `model._meta` field targets + `db_column`); NOT NULL via introspection `null_ok`: `name`, `source` on companies/people, `name_ar/fr/en` on wilayas/industries, `date` on daily_usage; FK `SET_NULL` behavior: deleting an Industry/Company/Wilaya nulls the referencing FK (no cascade); industry nullable by default; daily_usage unique (user, date) — second insert same user+date raises IntegrityError; save() writes `search_normalized` (Company('SARL ÉLECTRICITÉ') → search_normalized == 'sarl electricite'; Person with Arabic name + role → normalized); wilaya code range CHECK (code=99 → IntegrityError)
  - [x] 2.2 GREEN: `backend/apps/search/models.py` — NEW — models `Wilaya` (`code` SmallIntegerField primary_key=True + CheckConstraint `wilayas_code_range` code 1-58; `name_ar/name_fr/name_en` CharField(64); db_table `wilayas`, ordering `['code']`), `Industry` (`id` AutoField(primary_key=True) for SERIAL; trilingual CharField(64); `is_active` BooleanField(default=True); db_table `industries`, ordering `['name_en']`), `Company` (`id` UUIDField(primary_key=True, default=uuid.uuid4, editable=False); `name` TextField; `industry` FK(Industry, null=True, blank=True, on_delete=SET_NULL, related_name='companies', db_column='industry_id'); `wilaya_code` FK(Wilaya, null=True, blank=True, on_delete=SET_NULL, related_name='companies', db_column='wilaya_code'); `size_band` TextField(null=True, blank=True); `website` TextField(null=True, blank=True); `source` TextField; `last_verified_at` DateTimeField(null=True, blank=True); `created_at` DateTimeField(default=timezone.now); `search_normalized` TextField(default='', blank=True); db_table `companies`), `Person` (`id` UUIDField PK; `company` FK(Company, null=True, blank=True, on_delete=SET_NULL, related_name='people', db_column='company_id'); `name` TextField; `role/seniority/email/phone/address` TextField(null=True, blank=True); `source` TextField; timestamps; `search_normalized`; db_table `people`), `DailyUsage` (`user` FK(settings.AUTH_USER_MODEL, on_delete=CASCADE, related_name='daily_usage'); `date` DateField(default=timezone.localdate) — NO `db_default` (see Dev Notes decision 5a); `search_count`/`export_rows` IntegerField(default=0); db_table `daily_usage`; Meta.constraints = [UniqueConstraint(fields=['user','date'], name='daily_usage_user_date_unique')]) — see Dev Notes D5 (composite-PK approximation)
  - [x] 2.3 `save()` overrides: `Company.save` sets `self.search_normalized = search_index.normalize_search(self.name)` before super; `Person.save` sets `self.search_normalized = search_index.normalize_search(self.name, self.role or '')` — row-own fields only (see Dev Notes D8); NO signal (signals also skip bulk_create — same caveat, see Gotchas)
  - [x] 2.4 `backend/apps/search/migrations/0001_initial.py` — generated via `manage.py makemigrations search`; mypy-strict clean; `makemigrations --check` returns clean afterwards

- [x] **Task 3: Backend — Postgres-only migration 0002 (unaccent + tsvector + GIN)** (AC: tsvector per-language configs, unaccent, GIN)
  - [x] 3.1 RED: `backend/apps/search/tests/test_migrations.py` — NEW — import `apps.search.migrations.0002_search_pg_tsvector` via `importlib.import_module` and assert: it is a `Migration`; contains the vendor-guarded `RunPython` (source contains `vendor != 'postgresql'`); source contains `CREATE EXTENSION IF NOT EXISTS unaccent`; the resolved `_ADD_SEARCH_VECTOR_SQL`/`_ADD_GIN_INDEX_SQL` constants produce the exact generated-column DDL for BOTH companies and people; reverse drops (`DROP INDEX IF EXISTS`, `DROP COLUMN IF EXISTS search_vector`). Seed-migration assertions live in `test_seed_data.py` (see T4/T5)
  - [x] 3.2 GREEN: `backend/apps/search/migrations/0002_search_pg_tsvector.py` — NEW — module-level SQL constants (`_ADD_SEARCH_VECTOR_SQL`, `_ADD_GIN_INDEX_SQL`, `_DROP_INDEX_SQL`, `_DROP_COLUMN_SQL`) + `RunPython(add_search_vector, remove_search_vector)`; `add_search_vector(apps, schema_editor)`: `if schema_editor.connection.vendor != 'postgresql': return`; then `schema_editor.execute(...)` for companies + people: `ALTER TABLE companies ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED;` + `CREATE INDEX companies_search_vector_gin ON companies USING GIN (search_vector);` (people: `people_search_vector_gin`); reverse: drop index then column. `search_vector` is DB-ONLY — NOT a model field (see Dev Notes D3); no-op on SQLite (test DB)
  - [x] 3.3 `makemigrations --check` still clean (DB-only column invisible to autodetector)

- [x] **Task 4: Backend — wilayas seed migration 0003 (58 rows)** (AC: exactly 58, codes 1-58, trilingual)
  - [x] 4.1 RED: `backend/apps/search/tests/test_seed_data.py` — NEW — after migrations (pytest-django db fixture), `Wilaya.objects.count() == 58`; codes cover exactly `range(1, 59)` (set equality); no blank `name_ar/name_fr/name_en`; data module `apps/search/data/wilayas.py` length == 58, codes contiguous 1-58, unique; seed migration 0003 exists with `RunPython` + `bulk_create` + `ignore_conflicts=True` + `get_model('search', 'Wilaya')`; spot checks on canonical rows (16 Algiers/الجزائر, 31 Oran, 58 El Menia/المنيعة)
  - [x] 4.2 GREEN: `backend/apps/search/data/wilayas.py` — NEW — `WILAYAS: list[dict[str, str | int]]` — exactly 58 entries mirroring `frontend/src/data/wilayas.ts` verbatim (codes 1-58; `name_ar/name_fr/name_en` identical strings — canonical source)
  - [x] 4.3 GREEN: `backend/apps/search/migrations/0003_wilaya_seed.py` — NEW — `RunPython(seed_wilayas, unseed_wilayas)`; `seed_wilayas(apps, schema_editor)`: `Wilaya = apps.get_model('search', 'Wilaya')`; `Wilaya.objects.bulk_create([Wilaya(**row) for row in WILAYAS], ignore_conflicts=True)` (idempotent); `unseed_wilayas`: `objects.filter(code__in=...).delete()`; mypy-strict annotations on both callables

- [x] **Task 5: Backend — industries seed migration 0004 (30+ rows)** (AC: ≥30, trilingual, active)
  - [x] 5.1 RED: `test_seed_data.py` — `Industry.objects.count() >= 30`; all rows `is_active is True`; no blank trilingual names; `name_en` unique (no duplicates); migration 0004 source contains `bulk_create` + `ignore_conflicts=True` + `get_model('search', 'Industry')`; data module length >= 30; PRD anchors present (Construction, Agroalimentaire, Pharmaceuticals, Advertising, Telecom Distribution)
  - [x] 5.2 GREEN: `backend/apps/search/data/industries.py` — NEW — `INDUSTRIES: list[dict[str, str]]` — 35 curated industries with `name_ar/name_fr/name_en` (PRD-anchored; see Dev Notes D9)
  - [x] 5.3 GREEN: `backend/apps/search/migrations/0004_industry_seed.py` — NEW — `RunPython(seed_industries, unseed_industries)` mirroring 0003; `ignore_conflicts=True`; `is_active=True` explicit per row

- [x] **Task 6: Backend — daily_usage AD-11 semantics + admin** (AC: CURRENT_DATE reset)
  - [x] 6.1 RED: `backend/apps/search/tests/test_daily_usage.py` — NEW — ORM default: `DailyUsage.objects.create(user=u).date == timezone.localdate()`; counters default 0; near-midnight rollover: patch `django.utils.timezone.now` to 2026-01-15 23:30 UTC → `timezone.localdate()` and ORM default both yield 2026-01-16 (Africa/Algiers, UTC+1); a row with yesterday's date is NOT the "today" row (query contract `filter(user=u, date=timezone.localdate())`); two users can each have today rows; upsert semantics via the update-then-create pattern (see Implementation notes) increments without duplicate rows (row count 1, search_count 2)
  - [x] 6.2 GREEN: no model change needed (models from T2 satisfy the semantics) — confirmed by tests; `backend/apps/search/admin.py` — NEW — register `DailyUsage`, `Wilaya`, `Industry`, `Company`, `Person` (AD-16 ops monitoring; minimal `list_display`, `search_fields`, `list_filter`, no custom actions)

- [x] **Task 7: Verification gates + story sync** (all ACs)
  - [x] 7.1 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` (146 → 220), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0
  - [x] 7.2 Frontend regression (no FE changes): from `frontend/` — `npm.cmd test` (171 green), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (384 ×3)
  - [x] 7.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-1 → in-progress → review; epic-3 → in-progress)

## Dev Notes

### Decided constraints (confirmed with Winston — architect consultation 2026-08-04)

- **Wilayas table does NOT exist from Epic 1 (decision 1)**: story 1.6's AC ("seeded via Django migration") was never implemented — it shipped only `frontend/src/data/wilayas.ts` (static, 58 rows). Story 3.1 creates the table AND fulfills that deferred AC. `frontend/src/data/wilayas.ts` stays the canonical source; `backend/apps/search/data/wilayas.py` mirrors it **verbatim** (single source of truth for both stacks until 3.4 decides API integration). No frontend changes in this story; the SSR `/wilayas` page keeps using the static file.
- **Single `search_vector` per table, 'simple' config, per-language normalization at write time (decision 2)**: the spine pins the query side to `websearch_to_tsquery('simple', keyword)` (ARCHITECTURE-SPINE.md:674); per-language dictionaries would produce stemmed lexemes that 'simple' queries never match. Per-language handling therefore happens on the INPUT: French/English unaccented, Arabic tashkeel-stripped. `search_vector = to_tsvector('simple', search_normalized)` (generated column, IMMUTABLE-safe). Proper-noun search favors no stemming — 'simple' is correct for B2B names.
- **Arabic normalized column = `search_normalized TEXT` on each table (decision 3)**, written at `save()` time via `search_index.normalize_search(...)` (Python, SQLite-testable). `search_vector` is a **DB-only generated column** (Postgres-only), NOT a model field — avoids text→tsvector state gymnastics and keeps `makemigrations --check` clean. Reserved column name: never add a model field `search_vector`.
- **Postgres-vs-SQLite strategy (decision 4)**: test DB is SQLite in-memory (config/settings/test.py) — all PG-only DDL (unaccent extension, generated tsvector column, GIN index) lives in migration 0002 inside a vendor-guarded `RunPython` (`schema_editor.connection.vendor != 'postgresql' → return`). SQLite tests cover normalization/seeds/semantics; `test_migrations.py` asserts the PG DDL exists in the migration (source-string assertions). `search_vector` is NEVER queried in tests. Matches the deferred Postgres-CI stance (deferred-work.md).
- **AD-11 daily reset (decision 5)**: `date = DateField(default=timezone.localdate)` — Django resolves `timezone.localdate()` against `settings.TIME_ZONE = 'Africa/Algiers'` (base.py:75). **Decision 5a (dev-stage)**: the `db_default='CURRENT_DATE'` from the story draft was DROPPED — Django 5.0 cannot express `DEFAULT CURRENT_DATE` on a DateField: `db_default=Value('CURRENT_DATE')` fails during migration DDL generation (DateField `get_db_prep_value` → `to_python` rejects the SQL keyword; discovered via migration application on the test DB). Since AD-3 makes the ORM the sole writer, the Python default is authoritative and the raw-SQL default is redundant; the AD-11 contract ("reset at 00:00 Africa/Algiers via CURRENT_DATE key") is enforced by keying on `timezone.localdate()`. Gotcha: Postgres `CURRENT_DATE` uses the SERVER's timezone — docker-compose should set `TZ=Africa/Algiers` on the postgres container (deployment note). The AC's `PRIMARY KEY (user_id, date)` is approximated by a surrogate `id` + `UniqueConstraint(user, date)` — Django has no composite PKs; the unique key enforces one row per user per day, which is the actual AD-11 contract.
- **`daily_usage.user_id` is BIGINT, not UUID (decision 6 — documented deviation)**: the AC schema says `user_id UUID`, but `accounts.User` uses Django's default `BigAutoField` (accounts/migrations/0001_initial.py:21 — the users table predates this story). The FK follows reality: `ForeignKey(settings.AUTH_USER_MODEL)` → `bigint`. Companies/people ARE new tables → proper `UUIDField` PKs; `wilayas.code` SmallInteger PK; `industries.id` IntegerField (SERIAL).
- **PII encryption deferred (decision 7)**: spine Security says email/phone encrypted at rest (ARCHITECTURE-SPINE.md:705); the AC schema is plain TEXT. AC wins for 3.1 — plain `email/phone/address` on people; encryption belongs to the Epic 4 reveal surface. Note: search API (3.2) never returns full contact data (only name/role/company/wilaya + revealed flag), so plain-at-rest is acceptable until reveal ships.
- **FK semantics (decision 8)**: `company_id`, `industry_id`, `wilaya_code` all `null=True` + `on_delete=SET_NULL` — ops deletions (industry deactivation, company dedup) never cascade away searchable records. `source` NOT NULL (provenance for AD-15 scraper writes). `search_normalized` = row-own fields only (people: name+role; companies: name) — company-name keyword matching is a 3.2 query-side join concern; no write-time cross-row coupling.
- **Industry taxonomy = ops-curated [ASSUMPTION] (decision 9)**: PRD FR-9 documents "30+ curated industries, ops-owned". No John (PM) consultation needed — the AC fixes count (≥30), trilingual names, and `is_active=TRUE`; the exact list is a documented assumption. 35 industries curated in `apps/search/data/industries.py` (PRD examples Construction, Agroalimentaire, Pharma, Advertising, Telecom distribution included; full list below).
- **No new dependencies**: `unicodedata`/`re`/`uuid` are stdlib; Django 5.0 `db_default` supported (requirements `django>=5.0,<5.1`). No `django.contrib.postgres` fields (they break SQLite migrations).

### Existing patterns to follow

- App layout: `apps/search/` already installed (`config/settings/base.py:23`); `models.py` + `search_index.py` per the spine structure (ARCHITECTURE-SPINE.md:495-501).
- Migration style: `RunPython` with `(apps, schema_editor)` callables, mypy-strict annotations, historical models via `apps.get_model` (accounts/migrations/0001 precedent).
- Admin: minimal `list_display` registrations (accounts/admin.py precedent), AD-16 ops mandate (daily_usage monitoring).
- Test conventions: pytest-django `db` fixture, `connection.introspection` for table/column checks (conftest.py fixtures `api_client`, `create_user` reusable), model `_meta` introspection for FK/field assertions.
- Backend gates: `.\.venv\Scripts\python.exe -m pytest`, `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0 (from `backend/`); ruff line length 100 (pyproject.toml); mypy strict applies to migrations too (no excludes — existing migrations pass).
- No code comments unless necessary; repo commit style `Story 3.1: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push; user commits manually.
- Checkboxes `- [x]` stay unchecked until the dev story executes them — tasks above are the live checklist.

### Implementation notes

- `search_index.py` (NEW, pure functions — unit-testable without DB):
  - `ARABIC_DIACRITICS` translate table: U+064B–U+0652 (tashkeel), U+0653–U+0655 (maddah/dagger/superscript alef), U+0670 (superscript alef), U+0640 (tatweel) → removed.
  - `unaccent_text`: NFKD normalize + filter `unicodedata.combining` (covers French accents AND most Arabic combining marks — belt-and-braces).
  - `normalize_search(*parts)`: `' '.join(p for p in parts if p)` → lowercase → strip_tashkeel → unaccent_text → collapse whitespace `re.sub(r'\s+', ' ', ...).strip()`.
- Migration 0002 DDL (exact strings, must appear in `test_migrations.py` source assertions):
  - `CREATE EXTENSION IF NOT EXISTS unaccent;`
  - `ALTER TABLE companies ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', search_normalized)) STORED;`
  - `CREATE INDEX companies_search_vector_gin ON companies USING GIN (search_vector);` (people: `people_search_vector_gin`)
  - Reverse: `DROP INDEX IF EXISTS ... ;` + `ALTER TABLE ... DROP COLUMN IF EXISTS search_vector;`
  - Wrapped in `if schema_editor.connection.vendor != 'postgresql': return` (SQLite no-op).
- Data seeds use `bulk_create(..., ignore_conflicts=True)` — idempotent re-runs; reverses delete seeded rows (by `code` for wilayas, by `name_en` for industries).
- `db_table` names are the AC table names exactly: `companies`, `people`, `daily_usage`, `wilayas`, `industries` (not `search_*`).
- DailyUsage upsert pattern (3.2 contract, tested in T6): `update_or_create` with `F()` in defaults FAILS on the create path ("F() expressions can only be used to update, not to insert"). Use the update-then-create pattern instead: `updated = DailyUsage.objects.filter(user=u, date=today).update(search_count=F('search_count') + 1); if not updated: DailyUsage.objects.create(user=u, date=today, search_count=1)`.
- `Industry.id` must be `AutoField(primary_key=True)` (SERIAL on PG), NOT `IntegerField(primary_key=True)` — a manual IntegerField PK is not auto-incrementing for the ORM: after `create()` the instance keeps `pk=None` (SQLite assigns the rowid but Django never fetches it), and any later FK assignment raises "save() prohibited to prevent data loss due to unsaved related object".

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd`; venv is `backend\.venv\Scripts\` (run from `backend/`); system `python` is 3.10 — use `.\.venv\Scripts\python.exe` for manage.py (venv python version unknown — verify with `--version`; Django 5.0 needs 3.10+).
- `bulk_create`, `bulk_update`, and `QuerySet.update()` SKIP `save()` overrides → `search_normalized` would be empty/stale (review-deferred requirement for story 3.2/Epic 6: scraper writers must set `search_normalized` explicitly or save per row). `save(update_fields=[...])` IS handled (review patch).
- `search_vector` must NEVER be referenced in ORM queries/tests (does not exist on SQLite; 3.2 queries it via Postgres-only SQL `websearch_to_tsquery`).
- Do NOT declare `search_vector` as a model field (reserved DB-only column — a future field addition would collide with the generated column on Postgres).
- mypy strict on migration files: annotate `(apps: Any, schema_editor: Any) -> None` style per existing precedent; data module lists need explicit typing (`list[dict[str, str | int]]`).
- `ignore_conflicts=True` with auto-increment `industries.id`: seeding twice would skip conflicts — fine (idempotent); tests assert counts, not ids.
- Timezone: `timezone.localdate()` (not `date.today()`) everywhere — `date.today()` uses the host TZ, not Africa/Algiers.
- Do NOT touch: accounts app, auth views, config/urls.py, frontend, messages, docker-compose (TZ flag is a deployment note, not a change in this story).

### Project Structure Notes

- Backend NEW: `backend/apps/search/models.py`, `backend/apps/search/search_index.py`, `backend/apps/search/admin.py`, `backend/apps/search/data/wilayas.py`, `backend/apps/search/data/industries.py`, `backend/apps/search/migrations/0001_initial.py`, `0002_search_pg_tsvector.py`, `0003_wilaya_seed.py`, `0004_industry_seed.py`, `backend/apps/search/tests/test_search_index.py`, `test_models.py`, `test_seed_data.py`, `test_migrations.py`.
- Backend UPDATE: none outside `apps/search/`.
- Frontend: NO changes (regression gates only).
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-1 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 → in-progress.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-01-search-database-schema.md] Story spec (all ACs)
- [Source: _bmad-output/implementation-artifacts/2-6-account-deletion.md] Completed 2.6 — story format precedent, review-record precedent, gate conventions
- [Source: docs/ARCHITECTURE-SPINE.md#L237-L260] daily_usage/wilayas/industries DDL (AD-3 data model); #L662-L693 Search Architecture (websearch_to_tsquery('simple'), unaccent, tashkeel strip, CURRENT_DATE rate-limit key, 100/page); #L495-L501 search app structure (models.py, search_index.py); #L712-L728 enumerations (58 wilayas FR-10, 30+ industries FR-9); #L705 PII encryption note; #L853 AD-11
- [Source: backend/config/settings/base.py#L75] TIME_ZONE = Africa/Algiers; #L23 apps.search installed
- [Source: backend/config/settings/test.py] SQLite in-memory test DB (why PG DDL is vendor-guarded)
- [Source: backend/apps/accounts/migrations/0001_initial.py#L21] users.id = BigAutoField (bigint — decision 6)
- [Source: backend/apps/accounts/models.py#L53-L77] accounts.User (db_table 'users')
- [Source: frontend/src/data/wilayas.ts] Canonical 58-wilaya dataset (mirrored by backend seed)
- [Source: _bmad-output/planning-artifacts/epics/epic-01-platform-foundation/story-06-58-wilaya-taxonomy-page.md] 1.6 delivered frontend-only (no DB table — decision 1)
- [Source: _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L91] FR-9 industry taxonomy ops-owned assumption; example industries
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] Postgres-backed CI deferred (decision 4 alignment)

## Review Findings

- [x] [Review][Patch] `save(update_fields=['name'])` persisted the new name but never the re-normalized search column (tsvector stayed stale). Both `Company.save`/`Person.save` now call `_ensure_normalized_in_update_fields(kwargs, 'name'|'name','role')` — when update_fields is a list/tuple containing a normalized-source field, `search_normalized` is appended to the set. 2 new tests [models.py, test_models.py]
- [x] [Review][Patch] AC's `search_count/export_rows INTEGER DEFAULT 0` existed only Python-side; `db_default=0` added so raw DDL carries `DEFAULT 0` (the auditor's one undocumented deviation). Date keeps the documented decision-5a (no db_default — Django can't compile `CURRENT_DATE` on a DateField) [models.py]
- [x] [Review][Patch] `industries.name_en` was treated as a key by the reverse seed + admin but had no DB constraint (duplicates possible). Added `UniqueConstraint(fields=['name_en'], name='industries_name_en_unique')`; 1 new test [models.py, 0001_initial, test_models.py]
- [x] [Review][Patch] Invisible format characters (ZWSP U+200B, ZWNJ U+200C, ZWJ U+200D, soft hyphen U+00AD) survived normalization into index tokens. `normalize_search` now maps them to a space BEFORE whitespace collapse (they are word separators, not removable noise). 4 new tests [search_index.py, test_search_index.py]
- [x] [Review][Patch] Migration 0002 forward DDL was non-idempotent under partial state loss (restored backup with `django_migrations` rolled back). `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` added (PG 9.6+ syntax); contract tests updated [0002_search_pg_tsvector.py, test_migrations.py]
- [x] [Review][Patch] Migration tests asserted source strings only. `add_search_vector`/`remove_search_vector` now executed against a stub schema_editor (vendor='postgresql' → exact statement sequence asserted, incl. unaccent + both tables + GIN + reverse drops; vendor='sqlite' → zero statements). Seed migrations 0003/0004 now behavior-tested on SQLite: seed → 58/35, unseed → 0, re-seed → restored (idempotency + reversibility actually executed) [test_migrations.py, test_seed_data.py]
- [x] [Review][Verification] PG-only DDL was never executed anywhere (High). Verified end-to-end against real PostgreSQL 16 in Docker (`postgres:16-alpine`, TZ=Africa/Algiers): all 4 migrations apply cleanly; `unaccent` extension present; both GIN indexes exist (`companies_search_vector_gin`, `people_search_vector_gin`); generated `search_vector` computes `'batiment':3 'electricite':2 'sarl':1` from `search_normalized`; `websearch_to_tsquery('simple', ...)` matches both diacritic-free queries. Container torn down after verification.
- [x] [Review][Deferred] `bulk_create`/`bulk_update`/`QuerySet.update()` bypass the `save()` override → empty `search_normalized`. Documented requirement for story 3.2/Epic 6 (scraper pipeline must set `search_normalized` explicitly or write through per-row saves; an atomic ON CONFLICT upsert is the 3.2 rate-limit path). Gotchas updated.
- [x] [Review][Deferred] Update-then-create upsert documented in tests races under concurrency (two handlers both create → IntegrityError). Story 3.2 must use a PG `INSERT ... ON CONFLICT (user_id, date) DO UPDATE` atomic upsert; the test pattern is the SQLite-compatible approximation.
- [x] [Review][Deferred] No frontend↔backend wilaya parity test (backend data module mirrors `frontend/src/data/wilayas.ts` by process, not by test). Story 3.4 (wilaya combobox) should consolidate the source and add a cross-stack parity check.

Dismissed as by-design/noise: `unaccent` extension unused in DDL (AC-literal satisfied — it is enabled; it becomes the 3.2 query-side tool, matching the spine's `websearch_to_tsquery` prescription), seed migrations importing live data modules (standard Django data-migration pattern — the taxonomy is ops-owned and row updates are ops work; reversing a data migration deleting its seeded rows is inherent), `strip_tashkeel` redundancy with NFKD (AC-literal clarity; no duplicated codepoint — U+0653 is set-deduped), surrogate-PK deviation (documented D5), Person company-name exclusion (documented D8), E501 per-file-ignore for data dirs (migrations precedent), `AutoField` vs project `BigAutoField` default (AC says `id SERIAL` — literal match), admin `search_fields` using raw `name` (3.2 owns search), Turkish `İ` folding (verified false positive — NFKD decomposes İ → I + U+0307 inside `unaccent_text`, dot removed before `lower()`).

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **`db_default='CURRENT_DATE'` breaks migration application**: Django 5.0 compiles `db_default` via the field's `get_db_prep_value` — `Value('CURRENT_DATE')` on a DateField fails `to_python` with "value has an invalid date format" during test-DB creation. Dropped `db_default`; `default=timezone.localdate` is authoritative (AD-3 ORM sole writer). Recorded as decision 5a.
- **Manual `IntegerField(primary_key=True)` never populates pk**: `Industry.objects.create(...)` left `pk=None` (no auto-field detection) → `Company.objects.create(industry=industry)` raised "save() prohibited ... unsaved related object". Switched to `AutoField` (SERIAL on PG).
- **F() in `update_or_create` defaults is insert-illegal**: "F() expressions can only be used to update, not to insert" on first call. Tests + story now document the update-then-create upsert pattern for 3.2.
- **Hamza letters decompose under NFKD**: `أمين` → `امين` (U+0623 → alef + combining hamza, then the combining mark is stripped) and `GÉRANT` → `gerant`. Intended behavior — diacritic-insensitive Arabic/French matching; test expectations reflect the normalized output.
- **`schema_user` fixture is module-scoped**: defined in `test_models.py`, it is NOT visible to `test_daily_usage.py` ("fixture not found") — redefined locally in each test module (conftest only holds shared fixtures).
- **pytest-django blocks DB access without `db`/`django_db`**: introspection tests (tables, columns, null_ok) hit "Database access not allowed" — added module-level `pytestmark = pytest.mark.django_db`.
- **`django.utils.timezone` has no `utc` attribute** — use `datetime.timezone.utc` in tests.
- **Migration-inspection tests assert resolved SQL, not source strings**: f-string DDL in migration source never appears as a contiguous literal under `inspect.getsource` — migration 0002 exposes module-level `_ADD_SEARCH_VECTOR_SQL`/`_ADD_GIN_INDEX_SQL` constants; tests assert the `.format(...)`-resolved values (stronger contract check).
- **Test DB is pre-seeded by data migrations**: pytest-django runs migrations (incl. seeds) once per session — wilaya codes 1-58 exist in every test; tests needing a deletable wilaya use `get_or_create(code=1)`, and code=99 is reserved for the CHECK-constraint test.
- **Ruff E501 on trilingual data rows**: `apps/search/data/*.py` added to per-file-ignores (migrations precedent) — rows are inherently >100 cols.
- **`timezone.localdate()` rollover test**: patching `django.utils.timezone.now` to 23:30 UTC in January yields next-day Algiers date (UTC+1) — verifies the ORM key is Africa/Algiers, not host-local.
- **Review round (3 sequential layers: Blind Hunter → Edge Case Hunter → Acceptance Auditor)**: 24 raw findings → 7 patches + 1 PG verification + 3 deferred (documented) + 13 dismissed. Post-review gates: 230 backend (146 + 84) / 171 frontend, lint/typecheck/ruff/mypy/i18n 0, `makemigrations --check` clean, real-PostgreSQL 16 Docker verification passed.

### Completion Notes List

- `search_index.py` (NEW): `strip_tashkeel` (Arabic diacritics U+064B–U+0652, U+0653–U+0655, U+0670, U+0640 tatweel via `str.translate`), `unaccent_text` (NFKD + combining-mark filter), `normalize_search(*parts)` (join → unaccent → strip tashkeel → whitespace collapse → lowercase). 15 tests.
- `models.py` (NEW): Wilaya (SmallInteger PK code, CHECK 1-58, trilingual, `wilayas`), Industry (AutoField SERIAL, trilingual, `is_active`, `industries`), Company (UUID PK, name/source NOT NULL, FKs industry/wilaya_code SET_NULL, size_band/website nullable, timestamps, `search_normalized`, `companies`), Person (UUID PK, FK company SET_NULL, name/source NOT NULL, role/seniority/email/phone/address nullable, `search_normalized`, `people`), DailyUsage (FK users CASCADE, date `default=timezone.localdate`, counters default 0, `UniqueConstraint(user, date)`, `daily_usage`). `save()` overrides populate `search_normalized` (row-own fields). 33 tests.
- Migrations: `0001_initial` (portable, generated), `0002_search_pg_tsvector` (vendor-guarded: unaccent extension + generated `search_vector = to_tsvector('simple', search_normalized)` STORED + GIN indexes on companies/people; SQLite no-op; DB-only column), `0003_wilaya_seed` (58 rows, `ignore_conflicts=True`), `0004_industry_seed` (35 rows, `is_active=True`). Migration-contract tests assert the exact resolved DDL.
- Data: `data/wilayas.py` — verbatim mirror of `frontend/src/data/wilayas.ts` (canonical source); `data/industries.py` — 35 curated trilingual industries (PRD anchors included).
- `admin.py` (NEW): all 5 models registered with minimal list_display (AD-16 daily_usage monitoring).
- Gates: backend 220 pytest (146 baseline + 74 new) / ruff 0 / mypy strict 0; frontend regression 171 tests / lint 0 / typecheck 0 / check:i18n 384×3 ✓; `makemigrations --check` clean.
- Review round: +10 tests (84 total: update_fields ×2, name_en unique, invisible chars ×2, PG DDL behavior ×3, seed idempotency/reversibility ×2) — 230 backend green; PG 16 Docker verification (unaccent/GIN/generated column/websearch match) passed.
- No frontend changes; no new dependencies; no `django.contrib.postgres` imports (SQLite-safe).

### File List

- `_bmad-output/implementation-artifacts/3-1-search-database-schema.md` — NEW (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (3-1 → ready-for-dev → in-progress → review; epic-3 → in-progress)
- `backend/apps/search/models.py` — NEW (Wilaya, Industry, Company, Person, DailyUsage + save() normalization) — UPDATE (post-review refactor: abstract `SearchNormalizedModel` base)
- `backend/apps/search/search_index.py` — NEW (strip_tashkeel / unaccent_text / normalize_search)
- `backend/apps/search/admin.py` — NEW (5 model registrations)
- `backend/apps/search/data/wilayas.py` — NEW (58 rows, mirrors frontend canonical)
- `backend/apps/search/data/industries.py` — NEW (35 curated industries)
- `backend/apps/search/migrations/0001_initial.py` — NEW (generated, portable)
- `backend/apps/search/migrations/0002_search_pg_tsvector.py` — NEW (vendor-guarded PG DDL)
- `backend/apps/search/migrations/0003_wilaya_seed.py` — NEW (data seed)
- `backend/apps/search/migrations/0004_industry_seed.py` — NEW (data seed)
- `backend/apps/search/tests/test_search_index.py` — NEW (15 tests)
- `backend/apps/search/tests/test_models.py` — NEW (33 tests)
- `backend/apps/search/tests/test_migrations.py` — NEW (6 tests)
- `backend/apps/search/tests/test_seed_data.py` — NEW (14 tests)
- `backend/apps/search/tests/test_daily_usage.py` — NEW (6 tests)
- `backend/pyproject.toml` — UPDATE (E501 per-file-ignore for `apps/*/data/*.py`)
- No frontend files changed.

## Change Log

- 2026-08-04: Story created (ready-for-dev) from epic 3.1 spec; Winston architect consultation resolved 7 design decisions (wilayas table created here — 1.6 was frontend-only; single 'simple'-config tsvector + write-time normalization; search_normalized model field + DB-only generated search_vector; vendor-guarded PG DDL for SQLite test DB; AD-11 timezone.localdate + db_default CURRENT_DATE; user_id bigint deviation; PII encryption deferred to Epic 4); no John consultation (industry list is ops-curated assumption — 35 curated industries); validated against checklist.
- 2026-08-04: Implemented (TDD): RED 5 suites → search_index.py + models + 4 migrations (0001 portable, 0002 PG-only unaccent/generated-tsvector/GIN, 0003/0004 seeds) + data modules + admin + pyproject E501 exemption → GREEN 220 backend (146 + 74) / 171 frontend regression, lint/typecheck/ruff/mypy/i18n clean; `makemigrations --check` clean. Dev-stage amendments recorded: `db_default='CURRENT_DATE'` dropped (Django 5.0 cannot compile SQL keywords in typed db_default — decision 5a), Industry.id = AutoField (manual IntegerField PK never populates pk), upsert = update-then-create pattern (F() illegal in update_or_create defaults), seed-migration assertions moved to test_seed_data.py. Status → review; sprint 3-1 → review. Commit `0dc9c63`.
- 2026-08-04: Code review (3 sequential layers: Blind Hunter → Edge Case Hunter → Acceptance Auditor — 24 raw findings, 7 patches + 1 real-PG verification + 3 deferred documented + 13 dismissed). Patches: update_fields-aware normalization (`_ensure_normalized_in_update_fields`), `db_default=0` counters (AC DEFAULT 0), `industries_name_en_unique` constraint, invisible-characters → separator mapping, `IF NOT EXISTS` idempotent DDL, migration behavior tests (stub schema_editor statement sequence + SQLite no-op + seed idempotency/reversibility on SQLite). Verification: full migration run against PostgreSQL 16 in Docker — unaccent ✓, GIN indexes ✓, generated tsvector ✓, `websearch_to_tsquery('simple')` matches ✓. Deferred: bulk-create/update bypass (3.2/Epic 6 requirement), atomic ON CONFLICT upsert (3.2), frontend↔backend wilaya parity test (3.4). 230 backend / 171 frontend tests green, all gates clean; status → done; sprint 3-1 → done (epic-3 stays in-progress). Commit `064dcf9` + `401ff66`. NOTE: do NOT push; user commits/merges manually.
- 2026-08-04: Post-review refactor (user note): duplicated `_ensure_normalized_in_update_fields` + `search_normalized` in Company/Person extracted into abstract base `SearchNormalizedModel(models.Model)` (Meta.abstract = True) — field + helper inherited, each model keeps its one-line `save()` ('name' vs 'name','role'). State-identical: `makemigrations --check` "No changes detected", 230 backend pytest / ruff 0 / mypy strict 0 unchanged. Commit `(refactor)`. No push.
