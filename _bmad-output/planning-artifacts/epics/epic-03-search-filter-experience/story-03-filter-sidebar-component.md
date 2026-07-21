---
title: Story 3.3 — Filter Sidebar Component
story_id: 3.3
epic: 3
status: draft
frs: [FR-5, FR-6, FR-7, FR-9, FR-11, FR-12, FR-13]
ux_drs: [UX-DR8, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
---

# Story 3.3: Filter Sidebar Component

As a **user searching for B2B contacts**,
I want **a filter sidebar on the search page where I can stage my filter selections and then explicitly click Apply**,
So that **I control when my daily search quota is consumed**.

## Acceptance Criteria

**Given** the Filter Sidebar component on desktop (≥md)
**When** the search page renders
**Then** a persistent inline-start sidebar is shown at {spacing.sidebar-width} wide
**And** it has {colors.card} fill with `border-inline-end: 1px solid {colors.border}`

**Given** the filter groups in the sidebar
**When** I inspect the sidebar
**Then** it contains in order:
- **Industry**: multi-select checkboxes, "Select all" / "Clear"
- **Wilaya**: Wilaya Combobox (Story 3.4)
- **Seniority** (People tab only): checkboxes — Owner/Founder, C-level, Director, Manager, Individual Contributor
- **Company Size** (Companies tab only): checkboxes — 1–10, 11–50, 51–200, 201–500, 500+, "Include unknown size" toggle (off by default)
- **Keyword**: free-text input with diacritic-insensitive matching
- Group labels in {typography.caption} — no uppercase (Arabic has no case)
- Controls are stock shadcn (Select, Command, Checkbox, Input)

**Given** the Apply button
**When** I inspect the bottom of the sidebar
**Then** a full-width Apply button is pinned at the bottom
**And** it uses {colors.primary} / {colors.primary-foreground}, {rounded.md}
**And** clicking it fires exactly one query = one search counted (FR-7)

**Given** the staged editing model
**When** I change filter values
**Then** changes are staged locally — nothing re-queries on individual changes
**And** only clicking Apply triggers the search

**Given** the mobile Filter Sidebar (<md)
**When** on a mobile viewport
**Then** the sidebar becomes a bottom-sheet drawer triggered by a "Filters (n)" badge button
**And** the badge shows the count of staged + active filters
**And** the bottom-sheet has: visible close button, scrim tap dismiss, swipe-down dismiss, Esc key dismiss
**And** focus returns to the trigger on close

**Given** empty state
**When** no filters are active and search hasn't been run
**Then** the results area shows the Checklist Card (Story 3.7) and empty state prompt
