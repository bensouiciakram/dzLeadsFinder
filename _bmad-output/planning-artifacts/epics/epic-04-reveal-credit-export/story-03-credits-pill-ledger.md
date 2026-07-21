---
title: Story 4.3 — Credits Pill & Ledger
story_id: 4.3
epic: 4
status: draft
frs: [FR-15, FR-16]
ads: [AD-8, AD-12]
ux_drs: [UX-DR6, UX-DR20, UX-DR21, UX-DR24]
---

# Story 4.3: Credits Pill & Ledger

As a **credit-conscious user**,
I want **to see my remaining credits at all times in the header, get warned when I'm low, and review my 90-day credit history on a dedicated page**,
So that **I always know where my credits stand and can track usage**.

## Acceptance Criteria

**Given** the Credits Pill in the header
**When** an authenticated user views any page
**Then** a pill in the header shows the current credit balance
**And** it uses {rounded.full}, 28px height, {colors.muted} / {colors.foreground} by default
**And** the balance is rendered in {typography.data} with `tabular-nums` and Western Arabic numerals
**And** a coin icon precedes the balance

**Given** the low-credit warning state (≤10 credits, paid users)
**When** a Starter user has ≤10 credits
**Then** the pill shifts to {colors.warning-container} / {colors.warning-on-container}
**And** a persistent `alert-triangle` icon appears beside the balance
**And** a tooltip explains "Low credits — top up soon"

**Given** the zero-credit state
**When** balance hits 0
**Then** the pill shifts to {colors.danger-container} / {colors.danger-on-container}
**And** clicking opens the recovery dialog (top-up for Starter, upgrade for Free)

**Given** live updates
**When** a reveal or export deducts credits
**Then** the Credits Pill decrements in-place without a page reload (≤200ms color transition, number never animates)
**And** the change is announced via `aria-live="polite"`
**And** clicking the pill navigates to `/credits`

**Given** the Credits Ledger page (`/credits`)
**When** an authenticated user navigates to it
**Then** it shows the last 90 days of credit activity
**And** each row displays: type (localized), amount, timestamp, balance-after, reference (order id / reveal id)
**And** the types are: free_signup, subscription_grant, pack_grant, promotional_grant, reveal_debit, export_row_debit, expiry
**And** the table is exportable as CSV from the page

**Given** the ledger API
**When** I inspect `GET /api/credits/ledger/`
**Then** it returns the last 90 days of credit_ledger rows for the authenticated user
**And** supports pagination

**Given** empty ledger state
**When** there is no activity in the last 90 days
**Then** an empty note is shown: "No credit activity in the last 90 days"
**And** a link to `/search` is provided
**And** CSV export of empty ledger is still offered (headers only)
