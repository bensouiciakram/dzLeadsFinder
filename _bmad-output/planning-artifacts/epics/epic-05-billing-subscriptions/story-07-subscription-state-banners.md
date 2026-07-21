---
title: Story 5.7 — Subscription State & Banners
story_id: 5.7
epic: 5
status: draft
frs: [FR-28]
ux_drs: [UX-DR7, UX-DR15, UX-DR18, UX-DR20, UX-DR21]
---

# Story 5.7: Subscription State & Banners

As a **user whose subscription state affects my experience**,
I want **to see my current plan status in the header, get a persistent banner if payment fails, and access a single upgrade dialog from any upgrade CTA**,
So that **I always know where I stand and can take action when needed**.

## Acceptance Criteria

**Given** the Subscription Chip in the header
**When** a free user views any page
**Then** the chip shows "Free — Upgrade" with:
- Transparent fill, {colors.primary} text, 1px {colors.primary} border
- {rounded.full}, 28px height
- The whole chip is a button that opens the Upgrade Dialog

**When** a Starter user views any page
**Then** the chip shows "Starter — renews on {date}" with:
- Solid {colors.primary} / {colors.primary-foreground}
- {rounded.full}, 28px height
- Date uses localized month name and Western numerals

**When** a cancelled user (access until date) views any page
**Then** the chip shows "Cancelled — access until {date}" with:
- {colors.warning-container} / {colors.warning-on-container}
- Clicking offers reactivation

**Given** the persistent failed-renewal banner (FR-28)
**When** a subscription has status 'failed_renewal'
**Then** a non-dismissible banner appears on ALL authenticated surfaces:
- {colors.danger-container} / {colors.danger-on-container}
- Compact 40px height
- "Payment failed — update your payment method to keep Starter" (localized)
- Link → Chargily update-payment page
- No dismiss `X` — the banner persists until payment succeeds
- Prior-cycle credits remain usable until the next cycle would have begun

**Given** the Upgrade Dialog
**When** any upgrade CTA is clicked (header chip, 0-credit recovery, watermark modal, xlsx tooltip, daily-limit state)
**Then** the same single Upgrade Dialog opens
**And** it contains:
- Starter plan details: 1,500 DZD/mo, 200 credits/mo, inclusions list
- "Subscribe via Chargily" button → Chargily checkout
- No public pricing page dependency — the dialog is the sole conversion surface

**Given** the Upgrade Dialog accessibility
**When** it opens
**Then** focus is trapped, Esc closes it, and focus returns to the invoking control
**And** on close, the user is not redirected (they stay on the current page)
