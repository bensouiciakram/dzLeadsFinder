---
title: Story 3.2 — Search API Endpoints
story_id: 3.2
epic: 3
status: draft
frs: [FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13]
ads: [AD-3]
---

# Story 3.2: Search API Endpoints

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
