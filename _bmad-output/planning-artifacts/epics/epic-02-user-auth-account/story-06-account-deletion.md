---
title: Story 2.6 — Account Deletion
story_id: 2.6
epic: 2
status: draft
frs: [FR-23]
ads: [AD-13]
ux_drs: [UX-DR19, UX-DR20, UX-DR21, UX-DR23]
---

# Story 2.6: Account Deletion

As a **user who wants to leave DZLeads**,
I want **to delete my account with a clear multi-step confirmation, a 7-day grace period during which I can recover it, and full deletion after that**,
So that **I can exercise my data rights under Loi 18-07 without contacting support**.

## Acceptance Criteria

**Given** the `/settings` page
**When** an authenticated user views it
**Then** there is a "Delete account" section (Danger Zone)
**And** clicking it triggers a multi-step destructive confirmation flow

**Given** the first confirmation step
**When** the user clicks "Delete account"
**Then** a dialog states:
- "Your account will be frozen and recoverable for 7 days"
- "After 7 days, deletion is permanent and irreversible"
- "Unrevealed credit balance will be removed"
- "Anonymised ledger rows retained for 90 days (tax records)"
**And** there are two buttons: "Cancel" and "I understand — delete my account"

**Given** the user confirms deletion
**When** they confirm
**Then** `deleted_at` is set to now
**And** `deletion_scheduled_at` is set to now + 7 days
**And** the user is logged out immediately
**And** their account is frozen: login returns a frozen-account screen

**Given** the grace period
**When** an account is in the 7-day grace period
**Then** logging in shows a frozen-account screen with:
- "Your account deletion is scheduled for {date}"
- "You can recover your account within {n} days"
- A "Recover account" button
**And** clicking "Recover account" calls `POST /api/settings/undelete/`
**And** sets `deleted_at = NULL`, `deletion_scheduled_at = NULL`
**And** restores full access

**Given** the 7-day grace period expires
**When** Celery cron runs `hard_delete_expired`
**Then** the user's personal data is hard-deleted
**And** `email` is removed (not just nulled — no PII retained)
**And** credit_ledger rows are anonymised (user_id removed, amounts kept for 90 days)
**And** reveals, exports, searches, saved_searches, subscriptions, payment_transactions are hard-deleted

**Given** the privacy policy
**When** a user reads `/privacy`
**Then** it documents the deletion process, the 7-day grace, and the data-subject request process
**And** commits to a 30-day response window for data-subject requests
