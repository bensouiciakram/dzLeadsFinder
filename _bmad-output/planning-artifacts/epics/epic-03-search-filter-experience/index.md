---
title: Epic 3 — Search & Filter Experience
epic_number: 3
status: draft
created: 2026-07-21
frs_covered: [FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13]
nfrs_covered: [NFR-1, NFR-5, NFR-6]
ux_drs_covered: [UX-DR8, UX-DR9, UX-DR10, UX-DR16, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
story_count: 7
---

# Epic 3: Search & Filter Experience

## Epic Goal

Authenticated users can search People and Company databases using trilingual filters (industry, wilaya, seniority, company size, keyword), save and re-run searches, and navigate paginated results with daily search limits.

## User Outcome

After this epic, a user can find B2B contacts by applying structured filters, view paginated results with sorting, manage saved searches, and stay within daily rate limits with clear feedback.

## FRs Covered

FR-5 (People search), FR-6 (Company search), FR-7 (Daily search limits), FR-8 (Saved searches), FR-9 (Industry filter), FR-10 (Wilaya filter), FR-11 (Seniority filter), FR-12 (Company size filter), FR-13 (Keyword search)

## Stories

| # | Story | Key Deliverables |
|---|---|---|
| 3.1 | Search Database Schema | people/companies tables, tsvector, daily_usage, wilayas/industries seed |
| 3.2 | Search API Endpoints | GET /api/search/people + /companies, filters, pagination, rate limiting |
| 3.3 | Filter Sidebar Component | Desktop sidebar + mobile bottom-sheet, Apply-not-instant, staged edits |
| 3.4 | Wilaya Combobox | Searchable multi-select, trilingual names, transliterated fallback |
| 3.5 | Results Table + Stacked Row | Sortable table, mobile cards, RTL flip, stable CSV column order |
| 3.6 | Saved Searches | Save/rename/delete/re-run, caps per tier, persist across locales |
| 3.7 | Checklist Card | 3-step onboarding card, live check-off, dismissible |
