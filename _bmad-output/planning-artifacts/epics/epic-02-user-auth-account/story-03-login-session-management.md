---
title: Story 2.3 — Login & Session Management
story_id: 2.3
epic: 2
status: draft
frs: [FR-22]
---

# Story 2.3: Login & Session Management

As a **registered user**,
I want **to log in with my email and password, stay logged in for up to 30 days, and log out securely**,
So that **I can access my account without repeatedly re-entering credentials**.

## Acceptance Criteria

**Given** the `/login` page
**When** an unauthenticated user navigates to it
**Then** the login form has email and password fields
**And** a "Forgot password?" link is present
**And** a "Don't have an account? Sign up" link is present

**Given** a user submits valid credentials
**When** the form is submitted via `POST /api/auth/login/`
**Then** the server validates email + password
**And** sets an httpOnly JWT cookie with 30-day inactivity expiry
**And** the user is redirected to `/search`
**And** no JWT token is stored in localStorage

**Given** a user submits invalid credentials
**When** login fails
**Then** a localized error message is shown: "Invalid email or password"
**And** no session cookie is set

**Given** an authenticated user makes API requests
**When** the JWT cookie is present
**Then** Django validates the JWT on every `/api/*` request
**And** `last_active_at` is updated on each authenticated request

**Given** the logout flow
**When** a user clicks "Log out"
**Then** `POST /api/auth/logout/` clears the httpOnly cookie
**And** the user is redirected to the homepage as a guest
**And** the JWT becomes immediately invalid

**Given** session expiry
**When** a user has been inactive for 30+ days
**Then** the next authenticated request returns 401
**And** the user is redirected to `/login` with a "Session expired" message

**Given** account deletion during grace period
**When** a user in the 7-day deletion grace tries to log in
**Then** they land on a frozen-account screen with a recover action instead of `/search`
