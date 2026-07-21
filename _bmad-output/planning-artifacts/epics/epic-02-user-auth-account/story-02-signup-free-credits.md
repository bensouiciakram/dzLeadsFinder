---
title: Story 2.2 — Signup with Free Credits
story_id: 2.2
epic: 2
status: draft
frs: [FR-21]
---

# Story 2.2: Signup with Free Credits

As a **new Algerian B2B buyer**,
I want **to sign up with only my email and password — no credit card asked — and receive 15 free credits on email verification**,
So that **I can try the product risk-free before committing to a paid plan**.

## Acceptance Criteria

**Given** the `/signup` page
**When** an unauthenticated visitor navigates to it
**Then** the signup form has exactly two fields: email and password
**And** there are no payment fields, no tier preselection, no card input
**And** a note beside the CTA states "No card required"

**Given** a user submits valid email + password
**When** the form is submitted
**Then** djoser creates the account, sets `tier='free'`, `credits_balance=0`
**And** a verification email is sent with a single-use link (24h expiry)
**And** the user is redirected to `/verify-email` with a hard gate message

**Given** the email verification gate
**When** a user tries to access any app surface before verification
**Then** they are blocked at the verify-email screen
**And** the screen offers a "Resend link" option

**Given** the user clicks the verification link
**When** the link is valid (not expired, unused)
**Then** `email_verified_at` is set
**And** `credits_balance` is incremented by 15
**And** a credit_ledger row is created with `event_type='free_signup'`, `amount=15`, `pool='subscription'`
**And** the user is redirected to `/search` (default post-login landing)
**And** the 15-credit welcome banner is shown

**Given** the user tries to use an expired verification link
**When** they click it after 24h
**Then** a clear "link expired — request a new one" page is shown

**Given** the user tries to use an already-used verification link
**When** they click it
**Then** a "link already used" page is shown with a sign-in prompt
**And** no duplicate credit grant occurs

**Given** validation requirements
**When** invalid data is submitted
**Then** form validation shows errors:
- Invalid email format
- Password < 8 characters
**And** errors render in the active locale with `aria-invalid` and `aria-describedby`
