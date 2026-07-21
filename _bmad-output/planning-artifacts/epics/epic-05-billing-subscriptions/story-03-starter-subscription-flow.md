---
title: Story 5.3 — Starter Subscription Flow
story_id: 5.3
epic: 5
status: draft
frs: [FR-24, FR-28]
ads: [AD-7]
---

# Story 5.3: Starter Subscription Flow

As a **user ready to pay for DZLeads**,
I want **to subscribe to the Starter tier (1,500 DZD/mo for 200 credits) via Chargily checkout using my CIB or EDahabia card**,
So that **I can access the product at the local price point with my local payment method**.

## Acceptance Criteria

**Given** a user with a free account clicks "Upgrade" or similar CTA
**When** they are redirected to the Chargily checkout via `POST /api/billing/create-checkout/`
**Then** the Chargily checkout shows:
- Amount: 1,500 DZD
- Payment methods: CIB and EDahabia only (no foreign-card fallback)
- Description: "DZLeads Starter — 200 credits/mo"

**Given** the payment succeeds (subscription creation)
**When** Chargily sends `checkout.paid` webhook with type subscription_creation
**Then** the `grant_credits` Celery task:
1. Creates a subscription with status 'active', current_period_start = now, current_period_end = now + 1 month
2. Grants 200 credits (credit_ledger event_type='subscription_grant', pool='subscription')
3. Sets user tier to 'starter'
4. Updates payment_transactions status to 'succeeded'
5. Sends a payment receipt email (localized)

**Given** the monthly renewal
**When** the subscription period ends
**Then** Chargily processes the renewal payment
**And** on success: 200 fresh credits are granted, period is extended
**And** unused credits from the previous cycle do NOT roll over

**Given** the payment fails at renewal
**When** Chargily sends `subscription.payment_failed`
**Then** subscription status is set to 'failed_renewal'
**And** credits from the previous cycle remain usable until the next cycle would have begun
**And** a persistent non-dismissible banner appears on all app surfaces (Story 5.7)

**Given** the subscription state in the header
**When** a Starter user views any page
**Then** the Subscription Chip shows: "Starter — renews on {date}" (localized month + Western numerals)
**And** the Credits Pill shows the current balance from both subscription and pack pools
