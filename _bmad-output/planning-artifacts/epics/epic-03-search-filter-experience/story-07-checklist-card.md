---
title: Story 3.7 — Checklist Card
story_id: 3.7
epic: 3
status: draft
frs: [FR-5, FR-14, FR-17]
ux_drs: [UX-DR16, UX-DR20, UX-DR21]
---

# Story 3.7: Checklist Card

As a **new user with 15 free credits**,
I want **a first-run onboarding card on the search screen that guides me through Run first search → Reveal a contact → Export a CSV**,
So that **I understand the core workflow and can complete the value loop quickly**.

## Acceptance Criteria

**Given** the Checklist Card component
**When** a new authenticated user lands on `/search` for the first time
**Then** a card appears below the 15-credit banner with:
- {colors.card} fill, 1px {colors.border}, {rounded.lg}
- Three steps: Run first search / Reveal a contact / Export a CSV
- Each step has a circle-check icon
- Pending step: {colors.border} icon, {colors.foreground} label
- Complete step: {colors.success} check icon, label in {colors.muted-foreground} (no strikethrough)

**Given** live check-off behavior
**When** the user completes any of the three actions
**Then** the corresponding step updates to "complete" in real time
**And** the change is announced via `aria-live="polite"`

**Given** card dismissal
**When** all three steps are complete, OR the user clicks the dismiss `X`
**Then** the card vanishes and does not reappear
**And** the card also vanishes if dismissed mid-way (acknowledged but not completed)

**Given** card visibility
**When** the card is dismissed or completed
**Then** it is never shown again for that account

**Given** the 3-step flow references:
- Step 1: triggers the first search (FR-5)
- Step 2: triggers the first reveal (FR-14)
- Step 3: triggers the first export (FR-17)
