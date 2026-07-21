---
title: Story 4.2 — Reveal API & Component
story_id: 4.2
epic: 4
status: draft
frs: [FR-14]
nfrs: [NFR-1]
ads: [AD-4]
ux_drs: [UX-DR11, UX-DR20, UX-DR21, UX-DR24]
---

# Story 4.2: Reveal API & Component

As a **user who wants contact details**,
I want **to click "Reveal" on a search result row and see the full contact data expand inline, with 1 credit deducted and my balance updated live**,
So that **I can access the value moment (phone, email, address) without leaving the search results**.

## Acceptance Criteria

**Given** the Reveal Button component in search results
**When** a result row renders with a record that has NOT been revealed
**Then** a 32px button with label "Reveal" + "1 credit" affordance appears
**And** it uses {colors.primary} / {colors.primary-foreground}, {rounded.md}
**And** it has `aria-expanded` and `aria-controls` wired to the contact expansion region

**Given** the user clicks Reveal
**When** the action starts
**Then** a spinner replaces the label, `aria-busy` is set, and the button width is pinned (no row jump)
**And** the UI optimistically expands the row and decrements the Credits Pill by 1

**Given** a successful reveal
**When** the API responds 200
**Then** contact fields (phone, email, address, source link) render inline below the result row
**And** the row stays expanded
**And** the Credits Pill shows the confirmed decremented balance
**And** `aria-live="polite"` announces the credit change

**Given** a failed reveal
**When** the API returns an error
**Then** the row collapses back to its initial state
**And** the Credits Pill balance increments back by 1
**And** a toast explains: "Reveal failed — credits restored"
**And** the button returns to the initial "Reveal" state

**Given** a record already revealed within 30 days
**When** the results row renders
**Then** the contact fields are auto-visible
**And** an "Already revealed" badge is shown: {colors.success-container} / {colors.success-on-container}, {rounded.full}, {typography.caption}
**And** no credit is deducted on re-view

**Given** a user with 0 credits
**When** they view a result row
**Then** the Reveal button renders with `aria-disabled` (stays focusable)
**And** it shows {colors.muted} fill, {colors.muted-strong} label, 1px {colors.border}
**And** a tooltip explains "No credits remaining"
**And** clicking/Enter opens the recovery dialog: Upgrade dialog for free users, top-up packs for Starter users

**Given** the reveal API endpoint
**When** I inspect `POST /api/reveal/{type}/{id}/`
**Then** it validates JWT, checks balance, performs atomic deduction, and returns full contact data or error
**And** it respects the re-reveal idempotency window (≤30d = free)

**Given** performance budget
**When** a reveal is triggered on 4G
**Then** the round-trip completes in ≤1.5s at the 95th percentile
