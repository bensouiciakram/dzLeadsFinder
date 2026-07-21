---
title: Story 2.1 — Django Auth Setup
story_id: 2.1
epic: 2
status: draft
frs: [FR-22]
ads: [AD-13, AD-16]
---

# Story 2.1: Django Auth Setup

As a **developer**,
I want **Django authentication configured with djoser + simplejwt, using httpOnly JWT cookies, with the User model extended for locale, tier, and credits_balance**,
So that **I can build auth endpoints and authenticated surfaces on a secure foundation**.

## Acceptance Criteria

**Given** the auth setup
**When** I inspect the Django project
**Then** `djoser` and `simplejwt` are installed and configured
**And** the `User` model is extended via a `UserProfile` model (or custom User model) with:
- `locale` (CharField: 'ar', 'fr', 'en'; default 'ar')
- `tier` (CharField: 'free', 'starter'; default 'free')
- `credits_balance` (IntegerField; default 0)
- `email_verified_at` (DateTimeField; nullable)
- `last_active_at` (DateTimeField; auto-update)
- `deleted_at` (DateTimeField; nullable — for soft-delete/grace period)
- `deletion_scheduled_at` (DateTimeField; nullable)
- `token_version` (IntegerField; default 0 — invalidates JWTs on password change)

**Given** the JWT configuration
**When** a user logs in via `POST /api/auth/login/`
**Then** the server sets an httpOnly JWT cookie (not localStorage)
**And** the JWT includes `user_id`, `token_version`, and `exp` claims
**And** on each authenticated request, the server verifies:
- JWT signature validity
- Token version matches current `token_version`
- `last_active_at` is within 30 days

**Given** the password change flow
**When** a user changes their password
**Then** `token_version` is incremented, invalidating all existing JWTs
**And** the user must re-login

**Given** Django Admin configuration
**When** I access `/admin/`
**Then** Django Admin is enabled for staff users only
**And** the following models are registered for admin management:
- User / UserProfile (view, edit credits, delete)
- CreditLedger (view, search, filter)
- PaymentTransaction (reconciliation review)
- Subscription (lifecycle management)
- `daily_usage` (monitoring)
**And** all admin actions are logged to Django's `LogEntry` for audit

**Given** the session inactivity rule
**When** a user has been inactive for 30+ days
**Then** their JWT is rejected on the next request
**And** they are redirected to login
