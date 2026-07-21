---
title: Story 4.5 — Export Modal Component
story_id: 4.5
epic: 4
status: draft
frs: [FR-17, FR-18, FR-19, FR-20]
ux_drs: [UX-DR12, UX-DR20, UX-DR21, UX-DR24]
---

# Story 4.5: Export Modal Component

As a **user ready to export search results**,
I want **a modal that shows the credit cost breakdown, a literal CSV mini-preview, and lets me confirm the export with the right format**,
So that **I know exactly what I'm paying and what I'm getting before committing credits**.

## Acceptance Criteria

**Given** the Export Modal component
**When** a user clicks "Export" from the search results toolbar
**Then** a shadcn Dialog opens with {rounded.xl}, max-width 560px

**Given** the modal layout for paid (Starter) users
**When** the modal renders
**Then** it shows top to bottom:
1. Row count in the current result set
2. Credit cost breakdown: "n revealed + m unrevealed = total credits"
   - In {typography.data} with `tabular-nums`
   - Per-line cost stated
3. Balance-after line
4. "Include rows I have not revealed yet" checkbox (checked by default)
5. A literal CSV mini-preview in a {colors.muted} {rounded.md} inset:
   - Sample data rows showing what the CSV will contain
   - In {typography.small}, Western Arabic numerals
   - (No watermark for Starter users)
6. Confirm button: {colors.primary} / {colors.primary-foreground}
7. Format toggle: CSV / XLSX (both enabled for Starter)

**Given** the modal for free users
**When** a free user opens the export modal
**Then** it additionally states:
- "Free tier: export up to 5 rows" with the specific rows shown
- The CSV mini-preview shows the localized watermark header row and footer row
- The XLSX button is visibly disabled with tooltip: "Upgrade to use Excel export"

**Given** the export rate limit state
**When** a user has hit the 5,000 rows/24h limit
**Then** the modal shows the "come back tomorrow" state instead of the export form
**And** the message is localized

**Given** the watermark preview
**When** a free user views the modal
**Then** the watermark is shown as literal content rows (header + footer) in the mini-preview
**And** the watermark string is localized (FR-19)

**Given** modal accessibility
**When** the modal opens
**Then** focus is trapped inside, initial focus on the first focusable element
**And** Esc closes the modal
**And** focus returns to the export trigger on close
