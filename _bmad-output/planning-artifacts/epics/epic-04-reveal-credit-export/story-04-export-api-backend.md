---
title: Story 4.4 — Export API Backend
story_id: 4.4
epic: 4
status: draft
frs: [FR-17, FR-18, FR-20]
ads: [AD-3, AD-11]
---

# Story 4.4: Export API Backend

As a **developer**,
I want **Django REST Framework endpoints for CSV and Excel export generation with rate limiting and credit cost calculation**,
So that **the frontend can trigger exports with the correct gating logic**.

## Acceptance Criteria

**Given** the export API
**When** an authenticated user creates an export via `POST /api/export/`
**Then** the request includes: record IDs or current query, format ('csv'/'xlsx'), `include_unrevealed` (boolean)
**And** the server calculates the credit cost: 1 credit per row, regardless of revealed status
**And** checks the user has sufficient balance
**And** checks the daily export limit (5,000 rows/24h)
**And** if checks pass, deducts credits atomically and creates an export job

**Given** the export download
**When** the export is ready, the user downloads via `GET /api/export/{id}/download/`
**Then** the response is a file download with the correct MIME type:
- CSV: `text/csv`
- XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Given** CSV export for paid users
**When** a Starter user exports CSV
**Then** the CSV includes header rows localized to the user's active locale
**And** the export includes all rows (up to the 5,000 cap)
**And** no watermark is included

**Given** Excel export for paid users
**When** a Starter user exports .xlsx
**Then** the .xlsx opens cleanly in Microsoft Excel and LibreOffice Calc
**And** phone numbers are preserved as text (not auto-converted to numbers)
**And** column types are explicit (text, number, date) to avoid auto-coercion bugs

**Given** export rate limiting
**When** a user has exported 5,000 rows in the past 24h
**Then** further export requests return HTTP 429
**And** the reset is at 00:00 Africa/Algiers

**Given** credit cost for export
**When** the export is confirmed
**Then** the user is warned of the credit cost before finalising
**And** the cost is: N rows × 1 credit each (revealed and unrevealed alike)
**And** the cost is displayed as: "n revealed + m unrevealed = total credits"
**And** the `exports` table records: id, user_id, format, row_count, credits_cost, included_unrevealed, watermark, created_at
