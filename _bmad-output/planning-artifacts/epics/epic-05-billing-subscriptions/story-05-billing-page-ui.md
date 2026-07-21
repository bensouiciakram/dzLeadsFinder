---
title: Story 5.5 — Billing Page UI
story_id: 5.5
epic: 5
status: draft
frs: [FR-24, FR-25, FR-26, FR-28]
ux_drs: [UX-DR7, UX-DR13, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
---

# Story 5.5: Billing Page UI

As a **user managing my account**,
I want **a billing page that shows my current plan, available add-on packs, payment history, and the danger zone for cancellation**,
So that **I have full visibility and control over my subscription**.

## Acceptance Criteria

**Given** the Billing Page (`/billing`)
**When** an authenticated user navigates to it
**Then** it has four stacked sections:

1. **Plan Card** — current plan, tier, renewal date, credits left this cycle
2. **Pack Cards** — two side-by-side cards (500 DZD/75 and 1,500 DZD/250)
3. **Payment History** — Chargily receipts table
4. **Danger Zone** — cancel subscription with confirmation

**Given** the Plan Card
**When** a free user views it
**Then** it shows "Free tier" with an "Upgrade" CTA that opens the Upgrade Dialog
**When** a Starter user views it
**Then** it shows "Starter — 1,500 DZD/mo — renews on {date}"
**And** shows remaining subscription credits

**Given** the Pack Cards
**When** they render
**Then** they are {colors.card}, 1px {colors.border}, {rounded.lg}, {spacing.gutter-desktop} padding
**And** the 1,500 DZD card has a "Best value" badge ({rounded.full}, {colors.primary} / {colors.primary-foreground}, top-inline-end)
**And** hover shifts border to {colors.primary}; focus-visible gets the standard ring

**Given** the Payment History table
**When** it renders
**Then** it shows past Chargily transactions with date, amount, type, status

**Given** the Danger Zone
**When** a Starter user clicks "Cancel subscription"
**Then** a confirmation dialog states: "You will keep access until {date}. No refund for the current cycle."
**And** on confirm: subscription status = 'cancelled', cancelled_at = now
**And** access continues until current_period_end
**And** no auto-renewal occurs

**Given** the cancellation result
**When** a user cancels
**Then** the Plan Card updates to show "Cancelled — access until {date}"
**And** a "Reactivate" button is available (which resumes subscription from next billing date)
