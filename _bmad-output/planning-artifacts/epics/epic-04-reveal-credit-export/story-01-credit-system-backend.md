---
title: Story 4.1 — Credit System Backend
story_id: 4.1
epic: 4
status: draft
frs: [FR-14, FR-15, FR-16]
ads: [AD-3, AD-4, AD-7, AD-8, AD-12]
---

# Story 4.1: Credit System Backend

As a **developer**,
I want **the credit ledger table, atomic deduction logic (SERIALIZABLE), pool-based balance computation, and re-reveal idempotency**,
So that **credit metering is provably correct and auditable**.

## Acceptance Criteria

**Given** the `credit_ledger` table exists via migration
**When** I inspect the database
**Then** the table has: id, user_id, event_type (enum), amount, balance_after, pool ('subscription'/'pack'), reference_id, description, created_at
**And** `credit_event_type` enum includes: `free_signup`, `subscription_grant`, `pack_grant`, `promotional_grant`, `reveal_debit`, `export_row_debit`, `expiry`

**Given** the atomic debit function
**When** a reveal is requested for a user with sufficient balance
**Then** in a SERIALIZABLE transaction:
1. Balance is computed: `SELECT SUM(amount) FROM credit_ledger WHERE user_id = $1`
2. If balance < 1: ROLLBACK, return error
3. Drawdown pool = 'subscription' if subscription_balance ≥ 1, else 'pack'
4. INSERT into credit_ledger (event_type='reveal_debit', amount=-1, pool=computed_pool)
5. INSERT into reveals (user_id, record_type, record_id)
6. UPDATE users SET credits_balance = credits_balance - 1
7. RETURN contact data
**And** the balance is computed from the ledger, never from a denormalized column alone

**Given** the re-reveal idempotency check
**When** a user reveals a record they already revealed within the past 30 days
**Then** the system returns contact data WITHOUT deducting a credit
**And** inserts a reveal row with `was_free=TRUE`
**And** the initial results API returns `revealed: true` per row when a ≤30d reveal exists

**Given** the balance computation (read)
**When** a balance check is performed
**Then** the SQL computes:
- subscription_balance = SUM(amount) WHERE pool='subscription'
- pack_balance = SUM(amount) WHERE pool='pack'
- display_balance = subscription_balance + pack_balance

**Given** the `reveals` table
**When** a reveal occurs
**Then** a row is inserted with: id, user_id, record_type (people/company), record_id, credit_cost (default 1), was_free (boolean), created_at
**And** a unique partial index exists: `(user_id, record_type, record_id) WHERE was_free = FALSE` for idempotency lookup

**Given** the `users.credits_balance` cache
**When** a ledger insert occurs
**Then** `users.credits_balance` is updated atomically in the same transaction
**And** on any audit, the ledger is queried directly (the source of truth)
