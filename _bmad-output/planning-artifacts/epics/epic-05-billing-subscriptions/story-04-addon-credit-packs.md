---
title: Story 5.4 — Add-on Credit Packs
story_id: 5.4
epic: 5
status: draft
frs: [FR-25, FR-27]
ads: [AD-7]
---

# Story 5.4: Add-on Credit Packs

As a **heavy user who runs out of monthly credits mid-cycle**,
I want **to buy a one-time add-on credit pack (500 DZD/75 or 1,500 DZD/250) that never expires**,
So that **I can keep working without upgrading my plan**.

## Acceptance Criteria

**Given** the add-on packs
**When** a user opens the `/billing` page
**Then** two pack cards are displayed side by side:
- **500 DZD / 75 credits** (6.7 DZD/credit)
- **1,500 DZD / 250 credits** (6.0 DZD/credit) — with "Best value" badge
**And** both cards show a "Never expires" note with a {colors.success} check icon
**And** the per-credit unit price is shown in {typography.caption} {colors.muted-foreground}
**And** a buy button ({colors.primary}) is on each card

**Given** a user purchases a pack
**When** they click "Buy" on a pack card
**Then** `POST /api/billing/create-checkout/` creates a Chargily checkout with pack metadata
**And** after successful payment, the Celery task grants credits:
- Credit ledger: event_type='pack_grant', pool='pack', amount = 75 or 250
- Balance updates atomically

**Given** the drawdown order
**When** a user with both subscription credits and pack credits makes a reveal
**Then** subscription pool credits are consumed before pack pool credits (subscription-first)
**And** the display balance shows subscription + pack pool combined

**Given** free users can also buy packs (FR-25)
**When** a free-tier user views the packs on `/billing`
**Then** the same pack cards are shown with the same buy buttons
**And** the purchased pack credits sit in the 'pack' pool

**Given** the pack purchase receipt
**When** payment succeeds
**Then** a receipt email is sent (locale-aware, per Story 1.8)
**And** a toast on the `/billing` page confirms: "{n} credits added — pack credits never expire"
