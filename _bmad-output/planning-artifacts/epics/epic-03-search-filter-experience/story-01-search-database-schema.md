---
title: Story 3.1 — Search Database Schema
story_id: 3.1
epic: 3
status: draft
frs: [FR-5, FR-6, FR-7, FR-9, FR-10, FR-11, FR-12, FR-13]
ads: [AD-3, AD-11]
---

# Story 3.1: Search Database Schema

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
