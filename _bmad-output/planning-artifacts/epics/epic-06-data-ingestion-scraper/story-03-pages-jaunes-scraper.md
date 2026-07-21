---
title: Story 6.3 — Pages Jaunes Scraper
story_id: 6.3
epic: 6
status: draft
nfrs: [NFR-7, NFR-8]
ads: [AD-15]
---

# Story 6.3: Pages Jaunes Scraper

As a **developer/operator**,
I want **a Django management command that scrapes public business data from Pages Jaunes Algérie with rate limiting and per-source pause capability**,
So that **the database includes this locally-relevant directory source**.

## Acceptance Criteria

**Given** the Pages Jaunes scraper management command
**When** I run `python manage.py scrape_pages_jaunes`
**Then** it fetches public business pages from Pages Jaunes Algérie
**And** parses business name, contact info, and industry data
**And** populates the `companies` and `people` tables
**And** each record is tagged with `source = 'pages_jaunes'` and `last_verified_at` timestamp

**Given** rate limiting
**When** the scraper runs
**Then** it respects a configurable delay between requests (default: 2 seconds — Pages Jaunes is rate-limited per PRD)
**And** the delay is stored in `app_config` as `pages_jaunes_request_delay_ms`

**Given** the per-source pause switch
**When** I set `app_config.pages_jaunes_enabled = false`
**Then** the scraper logs "Pages Jaunes source is paused — skipping" and exits without making requests

**Given** error handling
**When** Pages Jaunes returns errors or blocks requests
**Then** the scraper logs, waits, retries up to 3 times with exponential backoff
**And** if all retries fail, logs a warning and exits gracefully
**And** the failure does NOT affect the Google Places or El Mouchir scrapers

**Given** data freshness
**When** records are inserted or updated
**Then** `last_verified_at` is set to the current timestamp
**And** the `PRD` constraint of ≥1 refresh per 30 days applies (Story 6.4)
