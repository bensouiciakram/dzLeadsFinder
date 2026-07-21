---
title: Story 3.5 — Results Table + Stacked Row
story_id: 3.5
epic: 3
status: draft
frs: [FR-5, FR-6, FR-10]
ux_drs: [UX-DR10, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
---

# Story 3.5: Results Table & Stacked Row

As a **user viewing search results**,
I want **a sortable table on desktop with the correct columns for People or Company, collapsing to stacked cards on mobile, with column visual order flipping in RTL**,
So that **I can scan, sort, and act on results in my preferred layout**.

## Acceptance Criteria

**Given** the People search Results Table
**When** results load on desktop (≥md)
**Then** the table columns are: name, role, company, wilaya, and a reveal action column
**And** each column header is sortable with a chevron icon (in ascending/descending/none state)
**And** the active sort column carries `aria-sort`
**And** numeric columns (People count, wilaya code) use `tabular-nums`

**Given** the Company search Results Table
**When** results load
**Then** columns are: name, industry, wilaya, size, People count

**Given** RTL column flip
**When** the locale is Arabic (RTL)
**Then** column visual order flips (inline-start becomes inline-end)
**And** the underlying column order is stable for CSV export (FR-2)

**Given** Mobile results (Stacked Row variant)
**When** the viewport is <md
**Then** each result renders as a card:
- {colors.card} fill, 1px {colors.border}, {rounded.lg}, {spacing.gutter} padding
- Lead name in {typography.title}, meta in {typography.small} {colors.muted-foreground}
- Reveal action full-width at bottom
- Same data and order as the table — a responsive reflow, not a redesign

**Given** table styling
**When** the table renders
**Then** header row: {typography.small} at 600 weight, {colors.muted-foreground}
**And** rows: 48px height, 1px {colors.border} bottom borders (no vertical gridlines)
**And** row hover: {colors.muted}
**And** Company name renders as a real `<a>` link → `/companies/:id` (keyboard focusable, not clickable row)

**Given** pagination controls
**When** results exceed 100
**Then** pagination controls appear below the table (no infinite scroll)
**And** the current page is visually indicated

**Given** empty results
**When** a search returns 0 matches
**Then** a suggestion is shown: "Try broadening your wilaya or industry selection"
**And** a "Clear all filters" one-click action is available

**Given** cold load / loading state
**When** a search query is in flight
**Then** skeleton rows matching the results-table layout are shown
**And** the filter panel renders immediately from cached taxonomy
