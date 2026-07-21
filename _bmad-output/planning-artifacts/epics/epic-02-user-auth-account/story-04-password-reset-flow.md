---
title: Story 2.4 — Password Reset Flow
story_id: 2.4
epic: 2
status: draft
frs: [FR-22]
---

# Story 2.4: Password Reset Flow

As a **user who forgot their password**,
I want **to request a password reset via email and set a new password using a secure, single-use link**,
So that **I can regain access to my account without losing data**.

## Acceptance Criteria

**Given** the `/password-reset` page
**When** an unauthenticated user navigates to it
**Then** there is a single email field and a "Send reset link" button

**Given** a user submits their email
**When** the form is submitted
**Then** the server sends a password reset email via djoser
**And** a confirmation message is shown: "If an account exists with this email, a reset link has been sent"
**And** the email contains a single-use reset link that expires after 1 hour

**Given** the user clicks the reset link
**When** the link is valid
**Then** they land on a page where they can enter a new password (with confirmation)
**And** the old password is replaced
**And** `token_version` is incremented, invalidating any existing sessions
**And** a success message is shown: "Password reset successfully — please log in"
**And** the user is redirected to `/login`

**Given** the user tries to use an expired reset link
**When** they click it after 1h
**Then** a "Link expired — request a new one" page is shown with a link to `/password-reset`

**Given** the user tries to use an already-used reset link
**When** they click it
**Then** a "Link already used" message is shown
**And** no password change occurs

**Given** the password reset email respects locale
**When** the email is sent
**Then** it renders in the user's active locale with correct RTL support per Story 1.8
