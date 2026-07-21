---
title: Story 2.5 — Auth UI Components
story_id: 2.5
epic: 2
status: draft
frs: [FR-21, FR-22]
ads: [AD-10]
ux_drs: [UX-DR20, UX-DR21, UX-DR22, UX-DR23]
---

# Story 2.5: Auth UI Components

As a **user interacting with authentication screens**,
I want **polished, accessible, and fully localized signup, login, verify-email, and password-reset pages with validation and error states**,
So that **I can complete auth flows smoothly in my language**.

## Acceptance Criteria

**Given** the signup page (`/signup`)
**When** it renders
**Then** it has:
- Email field with visible label (not placeholder-as-label), `autocomplete="email"`
- Password field with visible label, `autocomplete="new-password"`, stated minimum (8 chars)
- "Start free" CTA button (localized)
- "Already have an account? Log in" link
- All fields have `aria-invalid` + `aria-describedby` on validation error

**Given** the login page (`/login`)
**When** it renders
**Then** it has:
- Email field with label, `autocomplete="email"`
- Password field with label, `autocomplete="current-password"`
- "Log in" CTA button (localized)
- "Forgot password?" link
- Error summary on failed login (localized)

**Given** the verify-email page (`/verify-email`)
**When** it renders post-signup
**Then** it shows:
- "Check your email" title (localized)
- Instructions to click the verification link
- "Resend verification email" link
- 24h expiry notice
- Hard gate: no navigation to app surfaces until verified

**Given** the password-reset page (`/password-reset`)
**When** it renders
**Then** it has:
- Email field with label
- "Send reset link" CTA button
- Confirmation screen on submit (not revealing if email exists)
- Reset confirmation page with new password fields

**Given** accessibility requirements
**When** a keyboard user navigates auth pages
**Then** focus order follows visual order (including RTL)
**And** error messages are announced via `aria-live="polite"`
**And** all form fields have visible labels at all times
**And** validation errors render inline per field before form-level summary

**Given** trilingual support
**When** the auth pages render
**Then** all strings, errors, and validation messages are in the active locale
**And** direction (RTL/LTR) is correct for the locale
**And** the locale switcher in the header works on auth pages
