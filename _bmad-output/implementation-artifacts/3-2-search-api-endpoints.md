---
story_id: 3.2
epic: 3
title: Story 3.2 — Search API Endpoints
status: done
frs: [FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13]
ads: [AD-3, AD-11]
---

# Story 3.2: Search API Endpoints

Status: done

## Story

As a **developer**,
I want **Django REST Framework endpoints for People and Company search with full filter support, pagination, and daily rate limiting**,
So that **the frontend can query B2B contact data with structured filters**.

## Acceptance Criteria

**Given** the search API
**When** an authenticated user calls `GET /api/search/people/` with filters
**Then** the endpoint accepts:
- `filters` (JSONB): `industry`, `wilaya`, `seniority`, `keyword`
- `page` (integer, default 1)
- `sort` (string, e.g. `name:asc`)
**And** returns paginated results with 100 rows per page
**And** each result row includes: id, name, role, company_name, wilaya_code, wilaya_name (localized), and `revealed: true/false` flag

**Given** the Company search endpoint
**When** a user calls `GET /api/search/companies/`
**Then** the endpoint accepts:
- `filters` (JSONB): `industry`, `wilaya`, `size`, `keyword`, `include_unknown_size`
- `page`, `sort`
**And** returns: id, name, industry, wilaya, size_band, people_count

**Given** pagination limits
**When** a search would return more than 1,000 results
**Then** the API returns `truncated: true` in the response
**And** includes a `refine_prompt` message (localized)
**And** the first 1,000 results are fully navigable at 100/page

**Given** daily rate limiting
**When** a free user has done 30 searches today
**Then** the next search returns HTTP 429 with a localized message
**And** the API does not count the request (search_count not incremented)
**And** for Starter users, the limit is 100 searches/day

**Given** the daily limit check
**When** a search query is submitted
**Then** the server checks `daily_usage` table for the user's search count today
**And** on success, UPSERTs `daily_usage` with `search_count = search_count + 1`
**And** errors from prior failed queries do NOT count toward the limit

**Given** keyword search
**When** a keyword filter is applied
**Then** it ANDs with all structured filters
**And** it searches across People name, role, and Company name
**And** it uses diacritic-insensitive matching (unaccent for French, tashkeel-stripped for Arabic)
**And** empty keyword returns all records matching the structured filters

## Tasks / Subtasks

- [x] **Task 1: Backend — quota module: limits, localized messages, atomic ON CONFLICT upsert** (AC: daily rate limiting, Q8)
  - [x] 1.1 RED: `backend/apps/search/tests/test_quota.py` — NEW — `daily_limit_for`: free → 30, starter → 100, unknown tier → free fallback; `daily_limit_reached`: 29 free → False, 30 → True, 99 starter → False, 100 → True (boundary semantics: count >= limit blocks the NEXT search); atomic upsert on SQLite via `increment_search_count`: first call creates row (search_count 1), second call increments to 2 with still exactly one row, second user gets an independent row, a yesterday-dated row is untouched by today's upsert (AD-11 `timezone.localdate()` key); upsert SQL module constant contains `ON CONFLICT (user_id, date) DO UPDATE` and `daily_usage.search_count + 1` (source assertion); message dicts: `SEARCH_LIMIT_MESSAGES` + `REFINE_PROMPT_MESSAGES` have exactly ar/fr/en keys, limit message formats the limit number into the text, refine prompt present for all locales
  - [x] 1.2 GREEN: `backend/apps/search/quota.py` — NEW — `SEARCH_DAILY_LIMITS = {'free': 30, 'starter': 100}`; `SEARCH_LIMIT_MESSAGES`/`REFINE_PROMPT_MESSAGES` trilingual dicts (RESET_SUBJECTS precedent — backend has no gettext); `daily_limit_for(user) -> int`; `daily_limit_reached(user) -> bool` (count >= limit); `increment_search_count(user) -> None` via a single raw-SQL statement (see Implementation notes for the exact SQL); `UPSERT_SEARCH_COUNT_SQL` module constant; mypy-strict annotations; no code comments

- [x] **Task 2: Backend — filter parsing + validation + sort/page parsing** (AC: filters JSONB, page, sort)
  - [x] 2.1 RED: `backend/apps/search/tests/test_filters.py` — NEW — `parse_filters(None)` → empty SearchFilters; valid people payload (industry/wilaya/seniority/keyword); valid companies payload (+size, include_unknown_size); malformed JSON → `ValidationError` code `invalid_filters`; non-dict JSON → `invalid_filters`; wrong types → code `invalid_filter`: industry as string, wilaya outside 1–58, seniority not in `SENIORITY_BANDS`, size not in `SIZE_BANDS`, keyword > 200 chars, include_unknown_size non-bool; unknown keys ignored; empty lists → no-op; include_unknown_size on people endpoint → `invalid_filter`; `parse_sort`: None → ('name','asc'), `name:desc` → ('name','desc'), `name` (no direction) → asc, non-whitelisted field → `invalid_sort`, bad direction → `invalid_sort`; `parse_page`: None → 1, '3' → 3, 'abc' → `invalid_page`, '0'/'-2' → `invalid_page`; band constants equal the spine lists exactly (spine §720-727)
  - [x] 2.2 GREEN: `backend/apps/search/filters.py` — NEW — `SENIORITY_BANDS = ['owner_founder', 'c_level', 'director', 'manager', 'individual_contributor']`, `SIZE_BANDS = ['1-10', '11-50', '51-200', '201-500', '500+']`, dataclass `SearchFilters` (industry/wilaya lists of int, seniority/size lists of str, keyword str|None, include_unknown_size bool), `parse_filters(raw, *, include_company_fields)`, `parse_sort(raw, whitelist)`, `parse_page(raw)` — all raising `ValidationError` with the codes above; `backend/apps/search/serializers.py` — NEW — `SearchFiltersSerializer` (DRF: ListField(IntegerField(1..58)) for wilaya, ListField(IntegerField) for industry, ListField(ChoiceField) for seniority/size, CharField(max_length=200) keyword, BooleanField include_unknown_size; `validate_include_unknown_size` gated on context `include_company_fields`); unknown keys ignored by DRF by default

- [x] **Task 3: Backend — keyword FTS clause (vendor-guarded websearch_to_tsquery + unaccent)** (AC: keyword AND, diacritic-insensitive, empty keyword)
  - [x] 3.1 RED: `backend/apps/search/tests/test_fts.py` — NEW — `_sanitize_keyword`: `'Café "Le Gérant" -Directeur'` → `'cafe le gerant directeur'` (operators `"` `-` `*` removed, normalized via existing `normalize_search`), whitespace-only → None (empty keyword → no clause); SQLite behavior tests (vendor fallback): people keyword matches person name / role / company name, diacritic-insensitive both directions (`café` matches `cafe` and vice versa; Arabic tashkeel input matches stripped stored name), keyword ANDs with a structured filter; company keyword matches company name only (not a person's name); PG branch contract: monkeypatched `connection.vendor = 'postgresql'` → the returned Q's RawSQL references ONLY the main table (`people.search_vector` / `companies.search_vector`), contains `websearch_to_tsquery('simple', unaccent(%s))`, and the people clause includes the company-name subquery via `company__in`
  - [x] 3.2 GREEN: `backend/apps/search/fts.py` — NEW — `_sanitize_keyword(normalized) -> str | None` (`re.sub(r'[^\w\s]', ' ', ...)` on the already-normalized keyword, re-collapse, None when empty); `people_keyword_q(kw)` and `company_keyword_q(kw) -> Q | None` — on postgresql: `Q(RawSQL(f'{table}.search_vector @@ websearch_to_tsquery(\'simple\', unaccent(%s))', (kw,), output_field=BooleanField()))` (people: `| Q(company__in=Company.objects.filter(company clause))`); on sqlite: `Q(search_normalized__icontains=kw)` (people: `| Q(company__search_normalized__icontains=kw)`); None input → None (no clause)

- [x] **Task 4: Backend — people search endpoint** (AC: people endpoint, 100/page, revealed, wilaya_name, rate limit, Q8)
  - [x] 4.1 RED: `backend/apps/search/tests/test_people_search.py` — NEW — anonymous → 401 (default IsAuthenticated + CookieJWTAuthentication); industry/wilaya/seniority filters narrow via company join; keyword ANDs with structured filters; result row keys exactly `id, name, role, company_name, wilaya_code, wilaya_name, revealed`; `wilaya_name` follows `user.locale` (ar/fr/en fixtures); `revealed` is False; sort `name:asc`/`name:desc`, `company_name` (NULLS LAST), `wilaya_code`, `role`; 105 fixtures → page 1 has 100 rows, page 2 has 5, `total` 105, `truncated` False; successful request increments `daily_usage.search_count` (3rd request → count 3); at limit → HTTP 429 with localized `detail`, `code: search_limit_exceeded`, `limit`, and count NOT incremented; invalid-filters request (400) does NOT increment; `page=abc` → 400; `page=11` → 400 `page_out_of_range`; `select_related` used (no N+1 — assert query count via `assertNumQueries` on page 1)
  - [x] 4.2 GREEN: `backend/apps/search/views.py` — NEW — `PeopleSearchView(APIView)` (GET): parse filters/sort/page → quota check (429) → `page_out_of_range` guard → build queryset (filters + keyword clause + sort, `select_related('company__wilaya_code', 'company__industry')`) → count + paginate → `increment_search_count` AFTER query success → response `{'results': [...], 'total': n, 'page': p, 'truncated': bool, 'refine_prompt': str|None}`; people row builder `_people_row(p, locale)` (plain dicts — MeView precedent; `wilaya_name` via `getattr(wilaya, f'name_{locale}')`, None-safe when company/wilaya null); `backend/apps/search/urls.py` — NEW — `path('people/', PeopleSearchView.as_view())` + `path('companies/', CompanySearchView.as_view())`; `backend/config/urls.py` — UPDATE — `path('api/search/', include('apps.search.urls'))`

- [x] **Task 5: Backend — companies search endpoint** (AC: companies endpoint)
  - [x] 5.1 RED: `backend/apps/search/tests/test_company_search.py` — NEW — industry/wilaya filters; `size` filter excludes companies with NULL `size_band`; `include_unknown_size: true` (with size active) includes them; `include_unknown_size` without size → no effect; keyword matches company name only; result row keys exactly `id, name, industry, industry_id, wilaya_code, wilaya_name, size_band, people_count`; `industry` localized per user.locale; `people_count` 0 (explicit "0 contacts known" case, FR-6) and 2; sort `people_count:asc/desc`, `size_band`, `wilaya_code`, `name`; a people search and a company search share ONE `daily_usage` row (2 counts); company searches count toward the same 30/100 limit
  - [x] 5.2 GREEN: `CompanySearchView(APIView)` — annotate `people_count=Count('people')`, `select_related('industry', 'wilaya_code')`, company row builder `_company_row(c, locale)`

- [x] **Task 6: Backend — truncation + refine_prompt** (AC: truncation, first 1,000 navigable)
  - [x] 6.1 RED: `backend/apps/search/tests/test_truncation.py` — NEW — 1,005 matching → `truncated: true`, `refine_prompt` localized per user.locale (ar/fr/en), `total` 1,005, page 1 → 100 rows; 950 matching → `truncated: false`, `refine_prompt` null; page 10 (offset 900) OK; page 11 → 400 `page_out_of_range`
  - [x] 6.2 GREEN: truncation wiring in both views — `PAGE_SIZE = 100`, `MAX_NAVIGABLE_RESULTS = 1000` constants in `quota.py`; `refine_prompt = REFINE_PROMPT_MESSAGES[user.locale]` only when truncated

- [x] **Task 7: Verification gates + story sync** (all ACs)
  - [x] 7.1 Backend (from `backend/`): `.\.venv\Scripts\python.exe -m pytest` all green (baseline 230), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0, `.\.venv\Scripts\python.exe manage.py makemigrations --check` clean (no model changes)
  - [x] 7.2 Frontend regression (no FE changes): from `frontend/` — `npm.cmd test` green (171 baseline), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green
  - [x] 7.3 Story file updated: tasks checked, File List complete, Change Log, Dev Agent Record; status → review; sprint-status.yaml synced (3-2 → in-progress → review; epic-3 stays in-progress)

## Dev Notes

### Decided constraints (confirmed with Winston — architect consultation 2026-08-05)

- **Keyword FTS = query-side normalization + vendor-guarded raw SQL (decision 1)**: lexeme parity requires the query to be built from the same normalized form the write side stored: Python `normalize_search(keyword)` (tashkeel strip + unaccent, existing pipeline) → `websearch_to_tsquery('simple', unaccent(%s))` in SQL (the `unaccent()` call is defense-in-depth; the extension is live from migration 0002). `websearch_to_tsquery` raises on operator-only input (`-`, `"`, `*`), so the normalized keyword is sanitized to `\w\s` tokens first; empty after sanitize → FTS clause omitted (AC: empty keyword → all structured-filter matches). `search_vector` is DB-ONLY (not a model field) → raw SQL is the only way to query it; the RawSQL clause must reference ONLY the queryset's main table (Django aliases joined tables `T2`/`U3` — order-dependent). People's company-name match therefore uses a subquery: `Q(company__in=Company.objects.filter(<raw clause on `companies`>))`. SQLite (test DB) fallback: `search_normalized__icontains` (both sides normalized → diacritic-insensitive) + `company__search_normalized__icontains` for people. PG semantics get behavior verification against real PostgreSQL in Docker (3.1 review precedent).
- **Atomic daily_usage upsert (decision 2 — deferred-work.md landing)**: NEVER the update-then-create pattern. Single statement valid on PG AND SQLite: `INSERT INTO daily_usage (user_id, date, search_count) VALUES (%s, %s, 1) ON CONFLICT (user_id, date) DO UPDATE SET search_count = daily_usage.search_count + 1` (table-qualified `daily_usage.search_count` — SQLite's UPSERT docs use exactly this form; PG accepts it too). `date` = `timezone.localdate()` param (AD-11 key; NOT `CURRENT_DATE` — server-TZ hazard, 3.1 decision 5a). Order: quota check → run query → increment ONLY on success (Q8: failed/400/429 queries never count). Check-then-increment concurrency window is the spine's literal contract (§682-685) — acceptable, documented.
- **Filter contract (decision 3)**: `filters` = JSON-encoded query param (spine:667). Malformed/non-dict → 400 `invalid_filters`. DRF `SearchFiltersSerializer` validates values; any violation → 400 `invalid_filter` (detail names the field; codes stable: DRF `not_a_list`/`invalid`/`invalid_choice`/`max_length`). Unknown keys ignored (forward-compat: 3.6 saved searches serialize filters as JSONB and must round-trip). Empty lists = no filter. Wilaya bounded 1-58 by field validation; unknown codes → zero results (FR-10 consequence satisfied, no DB existence check). `include_unknown_size` companies-only; ignored when no size filter active (FR-12: toggle off by default). `page`: int ≥ 1, default 1. `sort`: `field:asc|desc` (bare field → asc), whitelist → ORM expression map, no user-controlled SQL.
- **Pagination/truncation contract (decision 4)**: fixed 100/page (no page_size param). Unconditional invariant: `offset >= 1000 → 400 page_out_of_range` (pages 1-10 only; simple and total-independent). `total` = full filtered count. `total > 1000 → truncated: true` + localized `refine_prompt` (else `null`).
- **429 contract (decision 5)**: HTTP 429, body `{'detail': <localized per user.locale>, 'code': 'search_limit_exceeded', 'limit': <n>}` — accounts exception shape; localization via trilingual dicts in `quota.py` (RESET_SUBJECTS precedent — this backend has no gettext). FR-7 message copy: "refine or come back tomorrow".
- **`revealed` flag (decision 6)**: constant `False` on every people row — the reveals table/≤30d re-reveal logic is Epic 4 (spine:644); the AC-literal field is present, documented placeholder.
- **Sort whitelists (decision 7)**: people — `name`, `role`, `company_name` (NULLS LAST via `F('company__name').asc(nulls_last=True)` — company-less people sort last), `wilaya_code` (via company); companies — `name`, `size_band`, `wilaya_code`, `people_count` (annotated `Count('people')`). Default `name:asc` both endpoints.
- **Localization of names (decision 8)**: `wilaya_name`/`industry` resolved per `user.locale` via `getattr(row, f'name_{locale}')` (locales ar/fr/en fixed by `LOCALE_CHOICES`). People rows get wilaya VIA COMPANY (Person has no wilaya column — the AC row shape implies the join). Companies return `industry` (localized name) + `industry_id` (frontend filter mapping) + `wilaya_code` + `wilaya_name`.
- **Constants (decision 9)**: `SEARCH_DAILY_LIMITS = {'free': 30, 'starter': 100}` (unknown tier → free fallback), `PAGE_SIZE = 100`, `MAX_NAVIGABLE_RESULTS = 1000`, `MAX_KEYWORD_LENGTH = 200` — all in `apps/search/quota.py`; band lists in `filters.py`.
- **No John (PM) consultation (decision 10)**: ACs fully specify limits (30/100), counting (Q8), localized messages, and refine prompt — no open product questions (FR-7 copy is literal).
- **Rate-limit semantics (decision 11)**: count >= limit blocks the NEXT search (30th succeeds, 31st → 429); 0-result searches count (they succeeded); 400/429/500 never count (increment happens after queryset evaluation, before the response).

### Existing patterns to follow

- Per-surface views/urls packages: `apps/accounts/views/{auth,settings}.py` + `apps/accounts/urls/{auth,settings}.py` mounted per prefix in `config/urls.py`; `apps/search` gets the same layout (spine §495-500: views.py, serializers.py, search_index.py).
- `APIView` subclasses; default auth/permission (CookieJWTAuthentication + IsAuthenticated — email-verified, token_version, soft-delete, 30-day activity all enforced for free); plain-dict responses (MeView precedent, accounts/views/auth.py:281-292); error shape `{'detail': ..., 'code': ...}` (accounts/exceptions.py custom handler).
- Trilingual dicts for backend-localized strings (RESET_SUBJECTS, tasks/email_tasks.py:81-85).
- Test conventions: pytest-django, root `backend/conftest.py` fixtures (`api_client`, `create_user`, `logged_in_client`, `user_data`); local `schema_user` alias per test module (fixture is not visible across modules); `pytestmark = pytest.mark.django_db` module markers.
- Backend gates (from `backend/`): `.\.venv\Scripts\python.exe -m pytest`, `.\.venv\Scripts\ruff.exe check .` 0 (line length 100), `.\.venv\Scripts\mypy.exe .` strict 0.
- No code comments unless necessary; commit style `Story 3.2: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push; user commits manually.
- Checkboxes stay unchecked until dev executes them — tasks above are the live checklist.

### Implementation notes

- `quota.py` exact upsert SQL (module constant, source-asserted in tests):
  `INSERT INTO daily_usage (user_id, date, search_count) VALUES (%s, %s, 1) ON CONFLICT (user_id, date) DO UPDATE SET search_count = daily_usage.search_count + 1` — executed via `connection.cursor()` with `[user.id, timezone.localdate()]`.
- `fts.py` raw clause (PG): `people.search_vector @@ websearch_to_tsquery('simple', unaccent(%s))` wrapped in `RawSQL(..., output_field=BooleanField())`; people company-name side: `Q(company__in=Company.objects.filter(RawSQL('companies.search_vector @@ websearch_to_tsquery(\'simple\', unaccent(%s))', ...)))`. `unaccent()` is the PG 9.6+ extension function (enabled in migration 0002). `connection.vendor` switch drives the SQLite fallback.
- View flow (both endpoints): parse filters → parse sort → parse page → quota check (429) → offset guard (400) → build queryset → count → page slice → increment → serialize. Increment AFTER query success, BEFORE response — Q8 by construction.
- People queryset: `select_related('company__wilaya_code', 'company__industry')` (no N+1 — assert with `assertNumQueries`); company queryset: `select_related('industry', 'wilaya_code')` + `annotate(people_count=Count('people'))`.
- Test fixtures: `Person`/`Company` created via `.objects.create(...)` (save() populates `search_normalized`); if any fixture uses `bulk_create`, set `search_normalized` EXPLICITLY (deferred-work.md — save() overrides are bypassed).
- `filters` param must be URL-encoded in tests (`urllib.parse.urlencode` on the JSON string).

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd`; venv is `backend\.venv\Scripts\` (run from `backend/`); system `python` is 3.10 — use `.\.venv\Scripts\python.exe` for manage.py.
- `search_vector` must NEVER be referenced via ORM fields (`Q(search_vector=...)` fails — not a model field) or in SQLite tests (column absent). Raw SQL only, vendor-guarded.
- RawSQL must reference only the queryset's main table (alias = db_table); joined-table aliases (`T2`, `U3`...) are order-dependent — the company-name match MUST use the `company__in` subquery pattern, not a join-qualified clause.
- `websearch_to_tsquery` raises `SyntaxError` on dangling operators — always sanitize before building the tsquery; empty/None keyword → skip the clause (never pass `''` to `websearch_to_tsquery` — empty tsquery is invalid for `@@`).
- `timezone.localdate()` everywhere (never `date.today()` — host TZ vs Africa/Algiers).
- Include `include_unknown_size` in the serializer only for companies — the people serializer must reject it (`invalid_filter`).
- The 429/refine messages must be keyed on `request.user.locale` (persisted per-user), not request headers.
- Anonymous requests get 401 from the default permission classes — no custom permission needed.
- Do NOT touch: accounts app, frontend, docker-compose, models/migrations (no schema change — `makemigrations --check` must stay clean).

### Project Structure Notes

- Backend NEW: `backend/apps/search/quota.py`, `filters.py`, `fts.py`, `views.py`, `serializers.py`, `urls.py`, `backend/apps/search/tests/test_quota.py`, `test_filters.py`, `test_fts.py`, `test_people_search.py`, `test_company_search.py`, `test_truncation.py`.
- Backend UPDATE: `backend/config/urls.py` (include `/api/search/`).
- Frontend: NO changes (regression gates only).
- Sprint: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3-2 → ready-for-dev (creation) → in-progress (dev) → review (dev done) → done (review done); epic-3 stays in-progress.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-03-search-filter-experience/story-02-search-api-endpoints.md] Story spec (all ACs)
- [Source: _bmad-output/implementation-artifacts/3-1-search-database-schema.md] Completed 3.1 — schema, search_index.py normalization, vendor-guarded PG DDL, story format precedent, gate conventions
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] Atomic ON CONFLICT upsert (3.2 requirement); bulk-create search_normalized requirement
- [Source: docs/ARCHITECTURE-SPINE.md#L662-L693] Search Architecture: query API shape, websearch_to_tsquery('simple'), unaccent, pagination 100/page + truncated at 1,000, rate limiting SQL + 429, CURRENT_DATE reset; #L720-L727 seniority/size bands; #L495-L500 search app structure
- [Source: backend/apps/search/models.py] Wilaya/Industry/Company/Person/DailyUsage (daily_usage unique (user, date); search_vector DB-only)
- [Source: backend/apps/accounts/models.py#L47-L55] User.tier choices free/starter (limit resolution)
- [Source: backend/apps/accounts/views/auth.py#L281-L292] MeView plain-dict APIView precedent; #L34 FREE_SIGNUP_CREDITS constant precedent
- [Source: backend/tasks/email_tasks.py#L81-L85] RESET_SUBJECTS trilingual dict precedent
- [Source: backend/apps/accounts/exceptions.py] custom_exception_handler (code field)
- [Source: backend/conftest.py] api_client/create_user/logged_in_client/user_data fixtures
- [Source: _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/4-features.md#L48-L123] FR-5..FR-13 (30/100 daily limit, "refine or come back tomorrow", size unknown exclusion, keyword AND + diacritic-insensitive)

## Review Findings

- [x] [Review][Patch] Wrong-endpoint filters silently ignored: `size` on `/people/` and `seniority` on `/companies/` pass validation and are dropped by the condition builders → 200 with unfiltered rows. Gate both fields by `include_company_fields` context (like `include_unknown_size`). [serializers.py:17, views.py:72-100] — FIXED: `validate_size`/`validate_seniority` reject with `invalid_filter`; 2 new tests.
- [x] [Review][Patch] `size_band` sort is lexicographic (`500+` < `51-200`): map bands to a `Case/When` numeric order for the companies sort key; test with real band values. [views.py:31-36,106] — FIXED: `_SIZE_BAND_ORDER` Case with band-index + default None (unknown/null → last in both directions); 1 new test.
- [x] [Review][Patch] Unbounded `filters` payload: multi-MB JSON parses + giant IN clause before the quota gate. Cap the raw param length (new `MAX_FILTERS_LENGTH` constant) → 400 `invalid_filters`; test oversized payload. [filters.py:19-33] — FIXED: `MAX_FILTERS_LENGTH = 8192`; 1 new test.
- [x] [Review][Patch] Error precedence: quota check precedes the `page_out_of_range` guard, so a quota-exhausted user gets 429 on `page=11` instead of the documented 400 invariant. Reorder: page guard first, then quota. [views.py:155-167,186-193] — FIXED; 1 new test.
- [x] [Review][Patch] NULL placement flips between sort directions (`role`/`size_band`/wilaya sorts rely on DB defaults): apply `nulls_last=True` to every sort key so nulls stay at the end in both directions. [views.py:93-101] — FIXED (universal `nulls_last=True`); 1 new test.
- [x] [Review][Patch] `websearch_to_tsquery` treats `and`/`or`/`not` as operators → empty tsquery → zero results on PG while SQLite substring-matches; multi-word AND vs contiguous-substring drift. Switch to `plainto_tsquery('simple', unaccent(%s))` (literal-AND semantics, no operator parsing — FR-13 is plain free text) and make the SQLite fallback AND-of-tokens per sanitized word. Update fts contract tests + story decision note. [fts.py:41-58] — FIXED: plainto_tsquery + `_sqlite_keyword_q` token-AND; contract tests updated, 2 new behavior tests; verified against real PostgreSQL 16 (below).
- [x] [Review][Patch] `MAX_KEYWORD_LENGTH` (quota.py) is dead — the serializer hardcodes `max_length=200`. Reference the constant. [serializers.py:17, quota.py:10] — FIXED.
- [x] [Review][Defer] Check-then-increment TOCTOU: the SELECT count → long query → upsert window lets a concurrent burst exceed the 30/100 cap. One-statement `DO UPDATE ... WHERE search_count < limit RETURNING` would change counting semantics (increment-before-success conflicts with Q8) and needs a PG transaction + row lock untestable on SQLite CI. Spine-documented pattern (§682-685); V1 acceptance. [quota.py:41-55] — deferred, documented in deferred-work.md.
- [x] [Review][Verification] PG keyword path verified against real PostgreSQL 16 in Docker (`postgres:16-alpine`, TZ=Africa/Algiers): all migrations apply cleanly; the real `fts.py` clauses (vendor-guarded branch) executed end-to-end — `electricite`/`électricité` → SARL ÉLECTRICITÉ, `gérant` → GÉRANT role, `شَرِكَة` (tashkeel) → شركة التجارة, `sarl electricite` multi-word AND, `and or not` literal (no error, no false matches), people matched via the `company__in` subquery; EXPLAIN shows Bitmap Index Scan on `companies_search_vector_gin`. Container torn down.
- [x] [Review][Defer] Company row shape deviates from the literal epic AC field list (`wilaya` → `wilaya_code` + `wilaya_name`, plus `industry_id`) — documented decision 8 (localized names + frontend filter mapping); AC intent satisfied.

Dismissed as by-design/noise: industry ids above 2^31-1 (DRF `IntegerField` default `max_value` → 400 `invalid_filter`, not 500), unknown industry/wilaya codes → empty results (decision 3: type/range validation only; FR-10 consequence "never returns non-existent codes" satisfied), page beyond last data page → 200 empty (standard REST pagination; truncation contract governs only offset ≥ 1000), upsert failure → 500 (fail-safe rate-limit accounting — silently skipping the increment would weaken the limit), keyword normalization double-handling (subsumed by the plainto_tsquery patch + token-AND fallback).

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **DRF `ValidationError` with a string detail produces a LIST body**: `rest_framework.exceptions.ValidationError('msg', code='x')` wraps the detail into `[ErrorDetail(...)]` → the DRF exception handler returns `['msg']` as the 400 body and the custom handler's `response.data['code'] = ...` is skipped (list has no string keys). The views now catch parse errors and return explicit `Response({'detail': ..., 'code': ...}, status=400)` via `_validation_response` (accounts precedent). The `page_out_of_range` guard returns an explicit Response for the same reason.
- **`F(key).asc(nulls_last=False)` raises `ValueError: nulls_first and nulls_last values must be True or None`**: pass `None` (backend default) instead of `False`; only `company__name` gets `nulls_last=True`.
- **`Q(company__in=<queryset>)` structure**: the kwargs child lands as a direct tuple `('company__in', QuerySet)` in the Q tree, and the subquery's WhereNode compiles the RawSQL into an `Exact` lookup node — the PG-contract test's raw-SQL collector walks `Lookup.lhs/rhs`, `QuerySet.query.where`, and 2-tuples generically. Never `repr()` a Q containing a queryset (evaluates it).
- **`websearch_to_tsquery` keyword hygiene**: `_sanitize_keyword` strips `[^\w\s]` (quotes, minus, asterisk) from the normalized keyword — `websearch_to_tsquery` raises on dangling operators, and an empty tsquery is invalid for `@@`; empty-after-sanitize → clause omitted.
- **DRF `BooleanField` accepts `"yes"`/`"y"`/`"on"`/`"1"` as truthy**: contract test for non-bool `include_unknown_size` uses `123` (rejected).
- **Seeded `industries.name_en` unique constraint**: fixture helper `_industry('Construction')` collided with the 3.1 seed row — test industries now get a uuid suffix.
- **`assertNumQueries` via `django_assert_max_num_queries(10)`**: the JWT auth lookup + limit check + count + fetch + upsert exceed a tight exact count; the max bound still catches N+1 (would be 20+).
- **mypy strict on test fixtures**: pytest fixtures returning callables need `Callable[..., tuple[Client, Any]]` annotations (`object` → "not callable"); model `.objects.create(...)` returns Any (no django-stubs) → helpers annotated `-> Any` to avoid no-any-return.

### Completion Notes List

- `quota.py` (NEW): `SEARCH_DAILY_LIMITS` (free 30 / starter 100, unknown tier → free), `PAGE_SIZE=100`, `MAX_NAVIGABLE_RESULTS=1000`, `MAX_KEYWORD_LENGTH=200`, trilingual `SEARCH_LIMIT_MESSAGES`/`REFINE_PROMPT_MESSAGES`, `UPSERT_SEARCH_COUNT_SQL` — single `INSERT ... ON CONFLICT (user_id, date) DO UPDATE SET search_count = daily_usage.search_count + 1` (table-qualified, PG- and SQLite-valid) — `daily_limit_for`, `daily_limit_reached`, `increment_search_count` (3.1 deferred item: atomic upsert landed). 17 tests.
- `filters.py` (NEW): `SENIORITY_BANDS`/`SIZE_BANDS` (spine §720-727), `SearchFilters` dataclass, `parse_filters` (JSON → invalid_filters; field violations → invalid_filter; unknown keys ignored; empty keyword → None), `parse_sort` (whitelist per endpoint, default name:asc), `parse_page` (≥1). `serializers.py` (NEW): `SearchFiltersSerializer` (ListField/ChoiceField/BooleanField/CharField(max_length=200); `include_unknown_size` companies-only via context). 32 tests.
- `fts.py` (NEW): `_sanitize_keyword` (operator stripping), `people_keyword_q`/`company_keyword_q` — PG: `RawSQL('people|companies.search_vector @@ websearch_to_tsquery('simple', unaccent(%s))')` main-table-only + `company__in` subquery for people's company-name match; SQLite: normalized `icontains` fallback; empty → no clause. 17 tests.
- `views.py` (NEW): `PeopleSearchView` + `CompanySearchView` — parse → quota (429, localized detail + limit) → page guard (400 page_out_of_range) → filter+sort (`_order_by` F-expressions, company__name NULLS LAST) → count → slice → increment AFTER success (Q8) → results rows (people: id/name/role/company_name/wilaya_code/wilaya_name localized/revealed=false; companies: + industry localized/industry_id/size_band/people_count via `Count('people')`), `truncated`/`refine_prompt` localized at >1,000. `urls.py` (NEW) + `config/urls.py` include at `/api/search/`.
- Tests: people 26 + company 17 + truncation 5 endpoint suites (auth 401, filters AND keyword, locale-keyed names, sort incl. NULLS LAST, 100/page, 429 + Q8, shared daily_usage, query-bound).
- Gates: backend 344 pytest (230 baseline + 114 new) / ruff 0 / mypy strict 0; `makemigrations --check` "No changes detected"; frontend regression 171 tests / lint 0 / typecheck 0 / check:i18n 384×3 ✓. No frontend changes; no new dependencies; no model/migration changes.

### File List

- `_bmad-output/implementation-artifacts/3-2-search-api-endpoints.md` — NEW (this story file; status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (3-2 → ready-for-dev → in-progress → review)
- `backend/apps/search/quota.py` — NEW (limits, localized messages, atomic ON CONFLICT upsert)
- `backend/apps/search/filters.py` — NEW (band taxonomy, SearchFilters, parse_filters/parse_sort/parse_page)
- `backend/apps/search/serializers.py` — NEW (SearchFiltersSerializer)
- `backend/apps/search/fts.py` — NEW (vendor-guarded keyword FTS clauses)
- `backend/apps/search/views.py` — NEW (PeopleSearchView, CompanySearchView)
- `backend/apps/search/urls.py` — NEW (people/, companies/)
- `backend/config/urls.py` — UPDATE (include `/api/search/`)
- `backend/apps/search/tests/test_quota.py` — NEW (17 tests)
- `backend/apps/search/tests/test_filters.py` — NEW (32 tests)
- `backend/apps/search/tests/test_fts.py` — NEW (17 tests)
- `backend/apps/search/tests/test_people_search.py` — NEW (26 tests)
- `backend/apps/search/tests/test_company_search.py` — NEW (17 tests)
- `backend/apps/search/tests/test_truncation.py` — NEW (5 tests)
- No frontend files changed.

## Change Log

- 2026-08-05: Story created (ready-for-dev) from epic 3.2 spec; Winston architect consultation resolved 10 design decisions (query-side normalization + vendor-guarded websearch_to_tsquery with main-table-only raw SQL + company subquery, atomic ON CONFLICT upsert, strict-but-forward-compatible filter contract, truncation invariant offset>=1000 → 400, 429 shape with trilingual dicts, revealed placeholder false, sort whitelists, locale-keyed name resolution, quota constants, no John consultation); validated against checklist; sprint-status 3-2 → ready-for-dev.
- 2026-08-05: Implemented (TDD): RED suites for quota/filters/fts/people/company/truncation → quota.py + filters.py + serializers.py + fts.py + views.py + urls.py + config include → GREEN 344 backend (230 + 114) / 171 frontend regression, ruff 0 / mypy strict 0 / makemigrations clean. Dev-stage amendments recorded: DRF ValidationError list-body → explicit `_validation_response` responses; `nulls_last=None` not False; `Q(company__in=...)` tree-walking contract tests; `_Session` fixture typing. Status → review; sprint 3-2 → review. Commit `d226b51`.
- 2026-08-05: Code review (3 parallel layers: Blind Hunter → Edge Case Hunter → Acceptance Auditor — 21 raw findings → 7 patches + 2 deferred documented + 1 real-PG verification + 11 dismissed). Patches: endpoint-scoped filter fields (`size`/`seniority` rejected on the wrong endpoint), band-logical `size_band` sort (Case/When), `MAX_FILTERS_LENGTH` payload cap, page-guard-before-quota error precedence, universal `nulls_last=True`, `websearch_to_tsquery` → `plainto_tsquery` (literal word-AND — operator-word keywords no longer return empty on PG) + token-AND SQLite fallback, `MAX_KEYWORD_LENGTH` constant wiring. Verification: real PostgreSQL 16 in Docker — migrations apply; `fts.py` clauses executed end-to-end (unaccent French, tashkeel-stripped Arabic, multi-word AND, operator words as literals, company subquery, GIN index scan confirmed). Deferred: check-then-increment TOCTOU (documented), PG-backed CI job (documented in deferred-work.md). Post-review gates: 352 backend / 171 frontend tests green, ruff 0 / mypy strict 0 / i18n ✓. Status → done; sprint 3-2 → done (epic-3 stays in-progress). Commit(s) pending.
