---
title: Story 5.6 — Status Card & Polling Bridge
story_id: 5.6
epic: 5
status: draft
frs: [FR-27]
ads: [AD-5]
ux_drs: [UX-DR14, UX-DR20, UX-DR21, UX-DR24]
---

# Story 5.6: Status Card & Polling Bridge

As a **user returning from Chargily checkout**,
I want **to see a status card on `/billing` that polls for up to 60 seconds and tells me whether my payment succeeded or needs waiting**,
So that **I don't have to wonder if my payment went through or contact support**.

## Acceptance Criteria

**Given** the Status Card on `/billing`
**When** a user returns from Chargily checkout
**Then** a status card appears inline on `/billing` with `role="status"`

**Given** the polling state (≤60s)
**When** payment is pending
**Then** the card shows:
- {colors.info-container} / {colors.info-on-container}
- Spinner + "Confirming payment…" (localized)

**Given** the success state
**When** the payment is confirmed within the polling window
**Then** the card flips to:
- {colors.success-container} / {colors.success-on-container}
- "{n} credits added — pack credits never expire" (localized)
- A success toast appears
- The polling stops

**Given** the timeout state (60s exceeded)
**When** payment status is still pending after 60s
**Then** the card shows:
- Info-toned (same as polling, not an error)
- "Payment received — credits will post shortly" (localized)
- Non-blocking — the rest of `/billing` stays interactive
- The credits are granted out-of-band via the idempotent webhook reconciliation

**Given** the polling mechanism
**When** the card is in polling state
**Then** it calls `GET /api/billing/status/{txnId}` every 5 seconds for 60 seconds
**And** once the payment_transactions status is 'succeeded', the card flips to success

**Given** accessibility
**When** the status changes (polling → success or timeout)
**Then** the `role="status"` change is announced before the toast appears
**And** the user is never asked to retry or re-pay
