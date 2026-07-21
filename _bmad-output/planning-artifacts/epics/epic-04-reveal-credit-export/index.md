---
title: Epic 4 — Reveal, Credit Metering & Export
epic_number: 4
status: draft
created: 2026-07-21
frs_covered: [FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20]
nfrs_covered: [NFR-1, NFR-3, NFR-5, NFR-6]
ux_drs_covered: [UX-DR6, UX-DR11, UX-DR12, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
story_count: 6
---

# Epic 4: Reveal, Credit Metering & Export

## Epic Goal

Users can reveal contact details (costing 1 credit each), see their live credit balance in the header, view the 90-day credit ledger, and export search results to CSV/Excel with appropriate gating for free vs paid users.

## User Outcome

After this epic, a user can unlock contact data with atomic credit deduction, monitor their balance, review their credit history, and export results — with free users seeing a watermarked CSV that drives upgrade conversion.

## FRs Covered

FR-14 (Reveal + atomic deduction), FR-15 (Credit balance surface), FR-16 (Credit ledger), FR-17 (CSV export paid), FR-18 (Excel export paid), FR-19 (Watermarked free CSV), FR-20 (Export rate limit)

## Stories

| # | Story | Key Deliverables |
|---|---|---|
| 4.1 | Credit System Backend | credit_ledger table, atomic debit (SERIALIZABLE), re-reveal idempotency |
| 4.2 | Reveal API + Component | POST /api/reveal, inline expansion, optimistic UI with rollback |
| 4.3 | Credits Pill + Ledger | Header pill (live), /credits page with 90-day history + CSV export |
| 4.4 | Export API Backend | POST /api/export, GET download, CSV/xlsx generation, rate limit |
| 4.5 | Export Modal Component | Cost breakdown, CSV mini-preview, xlsx gating, free cap |
| 4.6 | Watermarked Export (Free) | 5-row cap, localized watermark, preview, upgrade path convergence |
