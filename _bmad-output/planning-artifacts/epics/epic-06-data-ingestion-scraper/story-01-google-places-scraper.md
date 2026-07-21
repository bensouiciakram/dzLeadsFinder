---
title: Story 6.1 — Google Places API Scraper
story_id: 6.1
epic: 6
status: draft
nfrs: [NFR-7, NFR-8]
ads: [AD-15]
---

# Story 6.1: Google Places API Scraper

As a **developer/operator**,
I want **a Django management command that scrapes People and Company data from Google Places API, with ops-configurable monthly spend cap and graceful pause**,
So that **the database is populated with verified B2B contact data**.

## Acceptance Criteria

**Given** the scraper management command
**When** I run `python manage.py scrape_google_places`
**Then** it connects to Google Places API, fetches business data, and populates the `companies` and `people` tables
**And** each record is tagged with `source = 'google_places'` and `last_verified_at` timestamp

**Given** the monthly spend cap
**When** the Google Places API monthly spend reaches the ops-config threshold (in `app_config`)
**Then** the scraper gracefully pauses the Google source
**And** logs: "Google Places API spend cap reached — source paused"
**And** continues with other sources (no crash)

**Given** the ops configuration
**When** I inspect `app_config`
**Then** it has keys:
- `google_places_monthly_spend_cap` (integer, DZD-equivalent)
- `google_places_enabled` (boolean, toggle)
**And** the scraper checks these before each run

**Given** error handling
**When** the Google Places API returns an error
**Then** the scraper logs the error and retries up to 3 times with exponential backoff
**And** if all retries fail, it logs a warning and exits gracefully

**Given** idempotent runs
**When** the scraper runs multiple times
**Then** it uses upsert logic (update existing records, insert new ones) based on a business identifier
**And** does not create duplicate records
