---
title: Epic 6 — Data Ingestion & Scraper Pipeline
epic_number: 6
status: draft
created: 2026-07-21
frs_covered: []
nfrs_covered: [NFR-7, NFR-8]
ads_covered: [AD-15]
story_count: 4
---

# Epic 6: Data Ingestion & Scraper Pipeline

## Epic Goal

People and Company data is populated and refreshed from three sources: Google Places API, El Mouchir public pages, and Pages Jaunes Algérie. Each source is an independent Django management command with ops-configurable pause switches and rate limiting.

## User Outcome

After this epic, the database contains verified B2B contact data that powers the search and reveal features, with each record carrying a `last_verified_at` timestamp and source attribution.

## NFRs Covered

NFR-7 (Data refresh ≥1x/30 days), NFR-8 (Secrets management)

## ADs Covered

AD-15 (Scraper pipeline as Django management commands with Scrapy)

## Stories

| # | Story | Key Deliverables |
|---|---|---|
| 6.1 | Google Places API Scraper | Django management command, ops-config throttle/cap, graceful pause |
| 6.2 | El Mouchir Scraper | Public page scraper, rate-limited, source tracking |
| 6.3 | Pages Jaunes Scraper | Rate-limited scraper, per-source pause switch |
| 6.4 | Scraper Scheduling & Ops | Celery beat scheduling, last_verified_at, admin panel, logging |
