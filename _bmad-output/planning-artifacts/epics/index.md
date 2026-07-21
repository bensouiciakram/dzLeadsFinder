---
title: Algerian B2B Lead Generation Platform — Epic & Story Breakdown
created: 2026-07-21
status: draft
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/prd-full.md
  - docs/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md
---

# Algerian B2B Lead Generation Platform — Epic & Story Breakdown

## Overview

This document provides the complete epic and story breakdown for the **Algerian B2B Lead Generation Platform (DZLeads V1)**, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

### Project Summary

- **Product:** Trilingual (AR/FR/EN, RTL-aware) B2B lead database
- **Tier:** 1,500 DZD/mo Starter (200 credits) + free trial (15 credits)
- **Payment:** Chargily only (CIB/EDahabia)
- **Stack:** Next.js 14 App Router + Django REST Framework + PostgreSQL + Celery + Docker Compose
- **Timeline:** 3–4 week MVP

---

## Requirements Inventory

### Functional Requirements

| ID | Description |
|---|---|
| FR-1 | Trilingual locale support (AR/FR/EN, Accept-Language inference, persistent) |
| FR-2 | RTL layout correctness (logical-property CSS only) |
| FR-3 | Localized emails and export headers |
| FR-4 | Public founder and verification pages |
| FR-5 | People search (industry, wilaya, seniority, keyword, paginated) |
| FR-6 | Company search (industry, wilaya, size, keyword) |
| FR-7 | Free searches with daily limits (30 free / 100 Starter) |
| FR-8 | Saved searches (5 free / 25 Starter cap) |
| FR-9 | Industry filter (30+ industries, multi-select) |
| FR-10 | Wilaya filter on official 58-wilaya taxonomy; public /wilayas page |
| FR-11 | Seniority filter (Owner/Founder, C-level, Director, Manager, IC) |
| FR-12 | Company size filter (1–10, 11–50, 51–200, 201–500, 500+) |
| FR-13 | Keyword search (diacritic-insensitive AND with structured filters) |
| FR-14 | Reveal with atomic credit metering (1 credit/reveal; re-reveal idempotent 30d) |
| FR-15 | Credit balance surface (header pill, live updates, warning/zero states) |
| FR-16 | Credit ledger (90-day history, CSV exportable) |
| FR-17 | CSV export for paid users (1 credit/row, header localized) |
| FR-18 | Excel (.xlsx) export for paid users (column types explicit) |
| FR-19 | Watermarked CSV export for free users (5-row cap) |
| FR-20 | Export rate limit (5,000 rows/24h per account) |
| FR-21 | No-card signup with 15 free credits (email + password only) |
| FR-22 | Auth and session (httpOnly JWT, 30-day inactivity, password reset) |
| FR-23 | Account deletion with 7-day grace period (GDPR/Loi 18-07) |
| FR-24 | Starter subscription via Chargily (1,500 DZD/mo, 200 credits) |
| FR-25 | Add-on credit packs (500 DZD/75, 1,500 DZD/250; never expire) |
| FR-26 | Cancellation and no-refund-by-default policy |
| FR-27 | Chargily webhook handling (idempotent on event_id; 60s polling) |
| FR-28 | Subscription state surfaces (header chip; failed-renewal persistent banner) |
| FR-29 | /how-we-verify public page (sources used + NOT used) |
| FR-30 | /about founder narrative page |
| FR-31 | /privacy and /terms pages (Loi 18-07, ANPDP, data-subject rights) |

### Non-Functional Requirements

| ID | Description |
|---|---|
| NFR-1 | Performance: first search ≤2.5s p95, reveal ≤1.5s p95 on 4G |
| NFR-2 | Availability: 99.5% monthly |
| NFR-3 | Observability: structured events (reveal, export, payment, credit) with 90d retention |
| NFR-4 | Localisation correctness: CI fails on missing translation keys for AR/FR/EN |
| NFR-5 | Browser support: latest 2 versions of Chrome, Safari, Edge, Firefox (desktop + mobile) |
| NFR-6 | Accessibility: WCAG 2.1 AA public pages; A+AA interactive surfaces |
| NFR-7 | Data refresh: each scraper source ≥1x/30 days; last_verified_at on reveal |
| NFR-8 | Secrets: server-only env vars; rotated quarterly; never in client bundle |

### Additional Requirements (Architecture)

| ID | Rule |
|---|---|
| AD-1 | Next.js 14 App Router (frontend) + Django REST Framework (backend split) |
| AD-2 | shadcn/ui + Tailwind CSS 4 with logical-property CI enforcement |
| AD-3 | PostgreSQL single store with SERIALIZABLE transactions for payments/credits |
| AD-4 | Credit balance = computed from ledger (users.credits_balance is transactional cache) |
| AD-5 | Chargily webhook idempotent on chargily_event_id UNIQUE constraint |
| AD-6 | Locale switch: no page reload, preserves React component state |
| AD-7 | Credit drawdown: subscription pool before pack pool |
| AD-8 | Western Arabic numerals in all locales; tabular-nums on credit surfaces |
| AD-9 | CI lint bans physical CSS properties (margin-left/right, left/right, text-align left/right) |
| AD-10 | Public pages = Server Components; app = SSR + client islands |
| AD-11 | Daily rate limits reset at 00:00 Africa/Algiers via daily_usage date key |
| AD-12 | Balance display = subscription_pool + pack_pool (computed from ledger) |
| AD-13 | Django auth via djoser + simplejwt (JWT in httpOnly cookie) |
| AD-14 | Celery + Redis for all background jobs |
| AD-15 | Scraper pipeline as Django management commands with Scrapy |
| AD-16 | Django Admin as ops panel for user/credit/payment management |
| AD-17 | Caddy reverse proxy — single domain, path-based routing, no BFF stubs, no CORS |
| — | Docker Compose on OVHcloud VPS: Caddy + Next.js + Django + Celery + Redis + PostgreSQL |
| — | CI/CD: GitHub Actions (lint + typecheck + i18n check + test on PR; deploy on merge to main) |
| — | Data model: 12 PostgreSQL tables (users, credit_ledger, subscriptions, payment_transactions, searches, saved_searches, reveals, exports, daily_usage, wilayas, industries, app_config) |
| — | Email: react-email TSX components rendered via /api/emails/render, sent via Celery + Django SMTP |

### UX Design Requirements

| ID | Description |
|---|---|
| UX-DR1 | Implement DESIGN.md design tokens as Tailwind config / CSS custom properties |
| UX-DR2 | Implement brand color layer (primary teal, slate neutrals, semantic system) |
| UX-DR3 | Implement font system (Inter Latin + Noto Kufi Arabic); Western Arabic numerals; tabular-nums |
| UX-DR4 | Logical-property CSS only; CI bans physical properties |
| UX-DR5 | Locale Switcher component — native-name dropdown, globe icon, full state preservation, instant dir flip |
| UX-DR6 | Credits Pill component — live balance, warning (≤10), zero state, tabular-nums |
| UX-DR7 | Subscription Chip component — free/Starter states, renewal date display |
| UX-DR8 | Filter Sidebar component — persistent desktop sidebar, mobile bottom-sheet, Apply-not-instant |
| UX-DR9 | Wilaya Combobox component — searchable, multi-select chips, trilingual names, 58-wilaya exact |
| UX-DR10 | Results Table component — sortable, paginated, RTL column flip, mobile stacked-row variant |
| UX-DR11 | Reveal Button component — loading, aria-disabled, revealed-badge states; optimistic UI with rollback |
| UX-DR12 | Export Modal component — credit cost breakdown, CSV mini-preview, watermark preview, 5-row cap |
| UX-DR13 | Pack Cards component — two side-by-side, Best-value badge, buy buttons |
| UX-DR14 | Status Card component — polling/success/timeout states for Chargily return flow |
| UX-DR15 | Banner component — info, warning, danger, persistent non-dismissible variant |
| UX-DR16 | Checklist Card component — 3-step onboarding, live check-off, dismissible |
| UX-DR17 | Confirm Banner component — one-time locale inference banner (Accept-Language) |
| UX-DR18 | Upgrade Dialog component — single dialog for all upgrade entry points |
| UX-DR19 | Account Deletion flow — multi-step destructive confirmation with 7-day grace states |
| UX-DR20 | State patterns: cold load skeletons, empty, error, truncated, rate-limited, low-credit, 0-credit, already-revealed, webhook-pending, payment-failed, unverified, deletion-grace |
| UX-DR21 | Accessibility: WCAG 2.1 AA public, A+AA interactive; aria-disabled pattern; aria-live; 44px touch targets; skip-to-content; focus management |
| UX-DR22 | Responsive: md breakpoint; sidebar → bottom-sheet; table → stacked rows; touch target inflation |
| UX-DR23 | Voice and Tone: 18 load-bearing microcopy strings × 3 locales |
| UX-DR24 | Interaction primitives: Apply-not-instant, disabled-but-actionable, live-balance, destructive confirm, optimistic UI, polling-with-timeout |
| UX-DR25 | Locale lifecycle: infer → confirm → persist → switch with full state preservation |

---

## FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR-1 | Epic 1 | Trilingual locale support |
| FR-2 | Epic 1 | RTL layout correctness |
| FR-3 | Epic 1 | Localized emails and export headers |
| FR-4 | Epic 1 | Public founder + verification pages |
| FR-5 | Epic 3 | People search |
| FR-6 | Epic 3 | Company search |
| FR-7 | Epic 3 | Free searches, daily limit |
| FR-8 | Epic 3 | Saved searches |
| FR-9 | Epic 3 | Industry filter |
| FR-10 | Epic 1 + Epic 3 | 58-wilaya taxonomy (public page + filter) |
| FR-11 | Epic 3 | Seniority filter |
| FR-12 | Epic 3 | Company size filter |
| FR-13 | Epic 3 | Keyword search |
| FR-14 | Epic 4 | Reveal with credit metering |
| FR-15 | Epic 4 | Credit balance surface |
| FR-16 | Epic 4 | Credit ledger |
| FR-17 | Epic 4 | CSV export for paid |
| FR-18 | Epic 4 | Excel export for paid |
| FR-19 | Epic 4 | Watermarked CSV export (free) |
| FR-20 | Epic 4 | Export rate limit |
| FR-21 | Epic 2 | No-card signup with 15 free credits |
| FR-22 | Epic 2 | Auth and session |
| FR-23 | Epic 2 | Account deletion |
| FR-24 | Epic 5 | Starter subscription via Chargily |
| FR-25 | Epic 5 | Add-on credit packs |
| FR-26 | Epic 5 | Cancellation and refund |
| FR-27 | Epic 5 | Chargily webhook handling |
| FR-28 | Epic 5 | Subscription state surfaces |
| FR-29 | Epic 1 | /how-we-verify public page |
| FR-30 | Epic 1 | /about founder page |
| FR-31 | Epic 1 | /privacy and /terms pages |

---

## Epic List

### Epic 1: Platform Foundation & Public Surfaces
Visitors can access public marketing pages in AR/FR/EN with correct RTL layout, see the 58-wilaya taxonomy, and understand the product.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-10, FR-29, FR-30, FR-31
**NFRs covered:** NFR-4, NFR-5, NFR-6 (partial)
**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR15, UX-DR17, UX-DR21, UX-DR22, UX-DR23, UX-DR24, UX-DR25

### Epic 2: User Authentication & Account Management
Users can register with email/password (no card), verify email, login/logout, reset password, manage locale preferences, and delete their account.

**FRs covered:** FR-21, FR-22, FR-23
**UX-DRs covered:** UX-DR19, UX-DR20, UX-DR21, UX-DR22, UX-DR23

### Epic 3: Search & Filter Experience
Authenticated users can search People and Company databases using trilingual filters, save and re-run searches, and navigate results with pagination and daily limits.

**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13
**UX-DRs covered:** UX-DR8, UX-DR9, UX-DR10, UX-DR16, UX-DR20, UX-DR21, UX-DR22, UX-DR24

### Epic 4: Reveal, Credit Metering & Export
Users can reveal contact details (1 credit each), see their live credit balance, view the credit ledger, and export results to CSV/Excel with appropriate gating.

**FRs covered:** FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20
**UX-DRs covered:** UX-DR6, UX-DR11, UX-DR12, UX-DR20, UX-DR21, UX-DR22, UX-DR24

### Epic 5: Billing, Subscriptions & Payment
Users can subscribe to Starter via Chargily (CIB/EDahabia), buy add-on credit packs, manage their subscription, and handle payment failures.

**FRs covered:** FR-24, FR-25, FR-26, FR-27, FR-28
**UX-DRs covered:** UX-DR7, UX-DR13, UX-DR14, UX-DR15, UX-DR18, UX-DR20, UX-DR21, UX-DR22, UX-DR24

### Epic 6: Data Ingestion & Scraper Pipeline
People and Company data is populated and refreshed from Google Places API, El Mouchir, and Pages Jaunes.

**FRs covered:** NFR-7, NFR-8
**ADs covered:** AD-15

---

## Directory Structure

```
epics/
  index.md                                    ← this file (overview)
  epic-01-platform-foundation/
    index.md                                  ← epic overview + story list
    story-01-project-scaffolding.md
    story-02-design-token-system.md
    story-03-locale-system-rtl.md
    story-04-locale-switcher-confirm-banner.md
    story-05-public-marketing-pages.md
    story-06-58-wilaya-taxonomy-page.md
    story-07-app-shell-header-footer.md
    story-08-email-system-foundation.md
  epic-02-user-auth-account/
    index.md
    story-01-django-auth-setup.md
    story-02-signup-free-credits.md
    story-03-login-session-management.md
    story-04-password-reset-flow.md
    story-05-auth-ui-components.md
    story-06-account-deletion.md
  epic-03-search-filter-experience/
    index.md
    story-01-search-database-schema.md
    story-02-search-api-endpoints.md
    story-03-filter-sidebar-component.md
    story-04-wilaya-combobox.md
    story-05-results-table-stacked-row.md
    story-06-saved-searches.md
    story-07-checklist-card.md
  epic-04-reveal-credit-export/
    index.md
    story-01-credit-system-backend.md
    story-02-reveal-api-component.md
    story-03-credits-pill-ledger.md
    story-04-export-api-backend.md
    story-05-export-modal-component.md
    story-06-watermarked-export-free.md
  epic-05-billing-subscriptions/
    index.md
    story-01-billing-database-schema.md
    story-02-chargily-integration.md
    story-03-starter-subscription-flow.md
    story-04-addon-credit-packs.md
    story-05-billing-page-ui.md
    story-06-status-card-polling.md
    story-07-subscription-state-banners.md
  epic-06-data-ingestion-scraper/
    index.md
    story-01-google-places-scraper.md
    story-02-el-mouchir-scraper.md
    story-03-pages-jaunes-scraper.md
    story-04-scraper-scheduling-observability.md
```
