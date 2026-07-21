---
title: Story 6.4 — Scraper Scheduling & Observability
story_id: 6.4
epic: 6
status: draft
nfrs: [NFR-3, NFR-7]
ads: [AD-14, AD-15, AD-16]
---

# Story 6.4: Scraper Scheduling & Observability

As a **developer/operator**,
I want **the three scrapers scheduled via Celery beat, their runs logged, and their status visible in Django Admin**,
So that **data stays fresh and I can monitor scraper health**.

## Acceptance Criteria

**Given** Celery beat configuration
**When** Celery starts
**Then** the scrapers are scheduled with these defaults:
- Google Places API scraper: every 24 hours
- El Mouchir scraper: every 24 hours
- Pages Jaunes scraper: every 24 hours
**And** each scraper can be individually rescheduled via `app_config` (`{source}_schedule_minutes`)

**Given** scraper observability
**When** a scraper runs
**Then** it emits structured log events with:
- `source` name
- Records scraped (created/updated)
- Errors encountered
- Duration
- Timestamp
**And** logs are retained for 90 days (NFR-3)

**Given** the `last_verified_at` surface
**When** a reveal shows contact data
**Then** each record displays a "last verified" timestamp per NFR-7
**And** if a source has not refreshed within 30 days, the record shows "data may be stale"

**Given** Django Admin scraper panel
**When** a staff user accesses `/admin/`
**Then** they can view:
- `app_config` entries for all scraper settings (enabled flags, delays, spend caps)
- Per-source last-run timestamps
- Manual trigger button for each scraper (via Django Admin action)
- Audit log of scraper runs via LogEntry

**Given** the per-source disable switch
**When** a user-facing data issue is traced to one source
**Then** the ops operator can disable that source independently in `app_config`
**And** the product continues with remaining sources
**And** a reduced-coverage notice is shown to users (not an outage)
