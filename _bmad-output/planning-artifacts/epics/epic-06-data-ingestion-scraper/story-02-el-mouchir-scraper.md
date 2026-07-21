---
title: Story 6.2 — El Mouchir Scraper
story_id: 6.2
epic: 6
status: draft
nfrs: [NFR-7, NFR-8]
ads: [AD-15]
---

# Story 6.2: El Mouchir Scraper

As a **developer/operator**,
I want **a Django management command that scrapes public business data from El Mouchir, with rate limiting and source tracking**,
So that **the database includes data from this Algerian business directory source**.

## Acceptance Criteria

**Given** the El Mouchir scraper management command
**When** I run `python manage.py scrape_el_mouchir`
**Then** it fetches public business listing pages from El Mouchir
**And** parses business names, contact info, and industry data
**And** populates the `companies` and `people` tables
**And** each record is tagged with `source = 'el_mouchir'` and `last_verified_at` timestamp

**Given** rate limiting
**When** the scraper runs
**Then** it respects a configurable delay between requests (default: 1 second)
**And** the delay is stored in `app_config` as `el_mouchir_request_delay_ms`

**Given** the pause switch
**When** I set `app_config.el_mouchir_enabled = false`
**Then** the scraper logs "El Mouchir source is paused — skipping" and exits without making any requests

**Given** error handling
**When** the El Mouchir source returns a non-200 response
**Then** the scraper logs the error, waits, and retries up to 3 times
**And** if all retries fail, it logs a warning and exits gracefully
