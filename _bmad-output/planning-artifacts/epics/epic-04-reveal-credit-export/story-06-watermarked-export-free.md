---
title: Story 4.6 — Watermarked Export (Free)
story_id: 4.6
epic: 4
status: draft
frs: [FR-19]
---

# Story 4.6: Watermarked Export (Free)

As a **free-tier user trying DZLeads**,
I want **to export up to 5 rows of my search results as a CSV with a visible watermark, seeing exactly what the file will look like before confirming**,
So that **I can test the data quality and see what upgrading removes**.

## Acceptance Criteria

**Given** the free-tier export flow
**When** a free-tier user opens the Export Modal
**Then** the modal explicitly states: "Free tier: export up to 5 rows"
**And** the 5 rows included are the first 5 rows of the current result set (current sort order)
**And** a localized watermark header row and footer row are shown in the CSV mini-preview

**Given** the watermark format
**When** the CSV is generated
**Then** the watermark is literal text rows in the CSV file:
- Header row: "DZLeads Free — upgrade to remove" (localized)
- Footer row: "DZLeads Free — upgrade to remove" (localized)
**And** the 5 data rows sit between the watermark header and footer
**And** the watermark is NOT a visual overlay or diagonal stamp — it is actual CSV content

**Given** the upgrade conversion path
**When** a free user sees the watermark
**Then** the XLSX button is visibly disabled with tooltip: "Upgrade to use Excel export"
**And** both upgrade CTAs in the modal converge to the single Upgrade dialog (Story 5.7)

**Given** the free-tier export modal
**When** it renders
**Then** the "Include rows I have not revealed yet" checkbox exists, checked by default
**And** the credit cost still applies: 5 rows = 5 credits from the free 15

**Given** the free-tier user tries to export more than 5 rows
**When** the result set has >5 rows
**Then** the modal explains that only 5 rows can be exported on the free tier
**And** the preview shows which 5 rows are included
