---
title: Epic 1 — Platform Foundation & Public Surfaces
epic_number: 1
status: draft
created: 2026-07-21
frs_covered: [FR-1, FR-2, FR-3, FR-4, FR-10, FR-29, FR-30, FR-31]
nfrs_covered: [NFR-4, NFR-5, NFR-6]
ux_drs_covered: [UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR15, UX-DR17, UX-DR21, UX-DR22, UX-DR23, UX-DR24, UX-DR25]
story_count: 8
---

# Epic 1: Platform Foundation & Public Surfaces

## Epic Goal

Visitors can access public marketing pages in AR/FR/EN with correct RTL layout, see the 58-wilaya taxonomy, and understand the product. This epic establishes the entire project scaffold, design system, locale infrastructure, and all public-facing pages.

## User Outcome

After this epic, the application is deployable, trilingually accessible to the public, and communicates DZLeads' value proposition, data-sourcing methodology, founder story, legal/compliance terms, and the canonical 58-wilaya taxonomy.

## FRs Covered

FR-1 (Trilingual locale), FR-2 (RTL layout), FR-3 (Localized emails), FR-4 (Public pages), FR-10 (/wilayas taxonomy), FR-29 (/how-we-verify), FR-30 (/about), FR-31 (/privacy + /terms)

## UX-DRs Covered

UX-DR1–UX-DR5 (design tokens, brand colors, typography, logical CSS), UX-DR15 (banner), UX-DR17 (confirm banner), UX-DR21 (accessibility), UX-DR22 (responsive), UX-DR23 (microcopy), UX-DR24 (interaction primitives), UX-DR25 (locale lifecycle)

## Stories

| # | Story | Key Deliverables |
|---|---|---|
| 1.1 | Project Scaffolding | Next.js + Django projects, Docker Compose, Caddy, CI/CD |
| 1.2 | Design Token System | Tailwind config, color/typography/spacing tokens, lint rules |
| 1.3 | Locale System & RTL | Locale inference, message files, dir flip, fall-through rules |
| 1.4 | Locale Switcher + Confirm Banner | Native-name dropdown, confirm banner, state preservation |
| 1.5 | Public Marketing Pages | /, /about, /how-we-verify, /privacy, /terms, /refund-policy |
| 1.6 | 58-Wilaya Taxonomy Page | /wilayas semantic table, trilingual names, client filter |
| 1.7 | App Shell (Header + Footer) | Header (logo, locale, credits/sub pill placeholders), Footer |
| 1.8 | Email System Foundation | react-email templates, BaseEmail, render API, Celery pipeline |
