---
title: Epic 2 — User Authentication & Account Management
epic_number: 2
status: draft
created: 2026-07-21
frs_covered: [FR-21, FR-22, FR-23]
nfrs_covered: [NFR-5, NFR-6]
ux_drs_covered: [UX-DR19, UX-DR20, UX-DR21, UX-DR22, UX-DR23]
story_count: 6
---

# Epic 2: User Authentication & Account Management

## Epic Goal

Users can register with email/password only (no card required), verify their email, login/logout, reset their password, manage their locale preference, and delete their account with a 7-day grace period.

## User Outcome

After this epic, a user can create an account, receive 15 free credits on email verification, authenticate securely, and have full control over their account lifecycle including GDPR/Loi 18-07-compliant deletion.

## FRs Covered

FR-21 (No-card signup + 15 free credits), FR-22 (Auth/session), FR-23 (Account deletion)

## Stories

| # | Story | Key Deliverables |
|---|---|---|
| 2.1 | Django Auth Setup | djoser + simplejwt, User model, httpOnly JWT, Django Admin |
| 2.2 | Signup with Free Credits | /signup page, email+password only, 15-credit grant on verify |
| 2.3 | Login & Session Management | /login page, httpOnly cookie, 30-day inactivity, token_version |
| 2.4 | Password Reset Flow | /password-reset, single-use link (1h expiry), email sending |
| 2.5 | Auth UI Components | All auth pages with validation, error states, accessibility (AA) |
| 2.6 | Account Deletion | Multi-step confirmation, 7-day grace, frozen-account screen, recovery |
