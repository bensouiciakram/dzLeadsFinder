---
title: Story 5.1 — Billing Database Schema
story_id: 5.1
epic: 5
status: draft
frs: [FR-24, FR-25, FR-26, FR-27]
ads: [AD-3, AD-5]
---

# Story 5.1: Billing Database Schema

As a **developer**,
I want **PostgreSQL tables for subscriptions, payment transactions, and Chargily webhook idempotency created via Django migrations**,
So that **the billing subsystem has a reliable data foundation**.

## Acceptance Criteria

**Given** the migrations run
**When** I inspect the database
**Then** these tables exist:

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'failed_renewal', 'cancelled', 'expired');

CREATE TABLE subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES users(id),
  tier                        user_tier NOT NULL DEFAULT 'starter',
  status                      subscription_status NOT NULL DEFAULT 'active',
  current_period_start        TIMESTAMPTZ NOT NULL,
  current_period_end          TIMESTAMPTZ NOT NULL,
  chargily_subscription_id    TEXT,
  cancelled_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE payment_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  chargily_event_id       TEXT UNIQUE NOT NULL,
  type                    TEXT NOT NULL CHECK (type IN ('subscription_creation', 'subscription_renewal', 'pack_purchase')),
  amount_dzd              INTEGER NOT NULL,
  status                  payment_status NOT NULL DEFAULT 'pending',
  credits_granted         INTEGER,
  chargily_checkout_url   TEXT,
  chargily_metadata       JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at           TIMESTAMPTZ
);
```

**Given** the idempotency constraint
**When** a Chargily webhook with a duplicate `chargily_event_id` arrives
**Then** `INSERT ... ON CONFLICT (chargily_event_id) DO NOTHING` prevents duplicate processing
**And** the webhook returns 200 without granting credits twice

**Given** the billing API endpoints
**When** I inspect the routes
**Then** these exist:
- `GET /api/billing/plan/` — current plan + renewal date
- `GET /api/billing/packs/` — available add-on packs
- `POST /api/billing/create-checkout/` — Chargily redirect URL
- `GET /api/billing/status/{txnId}/` — payment polling
