---
title: Story 3.4 — Wilaya Combobox
story_id: 3.4
epic: 3
status: draft
frs: [FR-10]
ux_drs: [UX-DR9, UX-DR21, UX-DR22, UX-DR23]
---

# Story 3.4: Wilaya Combobox

As a **user filtering by location**,
I want **a searchable combobox that lets me find and select wilayas by code or trilingual name, with multi-select rendered as chips**,
So that **I can quickly narrow my search to specific regions I care about**.

## Acceptance Criteria

**Given** the Wilaya Combobox component
**When** it renders in the filter sidebar
**Then** it uses shadcn Command inside a Popover
**And** the trigger shows selected wilayas as {rounded.full} {colors.muted} chips
**And** the search input matches against code, Arabic name, French name, and English name

**Given** a user searches for a wilaya
**When** they type "31" or "Oran" or "وهران"
**Then** the dropdown filters to show matching wilayas
**And** each option row displays: `{code} — {localized name}` (e.g., "31 — Oran")
**And** the code is always in Western Arabic numerals
**And** the name falls back to transliterated Arabic if no locale name exists — never a blank

**Given** multi-select behavior
**When** a user selects a wilaya option
**Then** it appears as a removable chip inside the trigger
**And** the user can select multiple wilayas
**And** each chip has a remove affordance (keyboard-reachable)

**Given** keyboard accessibility
**When** the combobox is open
**Then** Enter/Space toggles an option
**And** Backspace/Delete removes the last chip when the search input is empty
**And** the search input has `aria-label` (minimum) — never placeholder-only
**And** Esc closes the popover and returns focus to the trigger

**Given** the wilaya data constraint
**When** the combobox loads
**Then** it contains exactly the 58 official wilayas (codes 1–58)
**And** no retired or non-existent wilaya codes are included
