---
title: Story 5.2 — Chargily Integration
story_id: 5.2
epic: 5
status: draft
frs: [FR-24, FR-25, FR-27]
ads: [AD-5, AD-14]
---

# Story 5.2: Chargily Integration

As a **developer**,
I want **a Chargily API client that creates checkouts for subscriptions and packs, verifies webhook signatures via HMAC-SHA256, and processes payment events idempotently**,
So that **Algerian users can pay with CIB and EDahabia cards**.

## Acceptance Criteria

**Given** the Chargily API client
**When** I inspect `backend/apps/billing/chargily.py`
**Then** it provides:
- `create_checkout(plan_data)` — creates a Chargily checkout session and returns the redirect URL
- `verify_webhook_signature(payload, signature)` — HMAC-SHA256 verification against `CHARGILY_WEBHOOK_SECRET`

**Given** the create-checkout endpoint
**When** a user requests `POST /api/billing/create-checkout/`
**Then** the server creates a Chargily checkout with:
- CIB and EDahabia as the only payment methods
- Amount in DZD
- Metadata: user_id, type (subscription/pack), amount
**And** returns the Chargily checkout URL to the frontend for redirect

**Given** the webhook endpoint
**When** Chargily sends a POST to `/api/webhooks/chargily/`
**Then** the Django view:
1. Is `@csrf_exempt` (Chargily has no CSRF token)
2. Verifies the HMAC-SHA256 signature against `CHARGILY_WEBHOOK_SECRET`
3. Parses the event type and payload
4. Validates the `chargily_event_id` uniqueness (ON CONFLICT DO NOTHING)
5. If duplicate, returns 200 (already processed)
6. If new, enqueues a Celery task `grant_credits.delay(event_id)` for background processing
7. Returns 200 to Chargily within 5 seconds

**Given** the webhook event types
**When** Chargily sends events
**Then** they map to internal types:

| Chargily Event | Transaction Type | Action |
|---|---|---|
| `checkout.paid` (single) | `pack_purchase` | Grant pack credits (75 or 250) |
| `checkout.paid` (subscription creation) | `subscription_creation` | Grant 200 credits, create subscription |
| `checkout.paid` (subscription renewal) | `subscription_renewal` | Grant 200 credits, extend period |
| `subscription.payment_failed` | — | Set subscription `failed_renewal`, trigger persistent banner |

**Given** security requirements
**When** the app starts
**Then** `CHARGILY_API_KEY` and `CHARGILY_WEBHOOK_SECRET` are loaded from server-only environment variables
**And** they never appear in the client bundle or application logs
