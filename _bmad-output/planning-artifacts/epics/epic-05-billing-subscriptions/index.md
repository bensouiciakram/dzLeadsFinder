---
title: Epic 5 — Billing, Subscriptions & Payment
epic_number: 5
status: draft
created: 2026-07-21
frs_covered: [FR-24, FR-25, FR-26, FR-27, FR-28]
nfrs_covered: [NFR-5, NFR-6]
ux_drs_covered: [UX-DR7, UX-DR13, UX-DR14, UX-DR15, UX-DR18, UX-DR20, UX-DR21, UX-DR22, UX-DR24]
story_count: 7
---

# Epic 5: Billing, Subscriptions & Payment

## Epic Goal

Users can subscribe to Starter tier (1,500 DZD/mo for 200 credits) via Chargily using CIB or EDahabia, buy add-on credit packs (500 DZD/75 or 1,500 DZD/250), manage their subscription, view payment history, and handle payment failures gracefully.

## User Outcome

After this epic, a user can pay for DZLeads using domestic Algerian payment methods, top up credits mid-cycle without upgrading tiers, see subscription status, and receive clear feedback on payment state including failed renewal handling.

## FRs Covered

FR-24 (Starter subscription), FR-25 (Add-on packs), FR-26 (Cancellation/refund), FR-27 (Chargily webhooks), FR-28 (Subscription state surfaces)

## Stories

| # | Story | Key Deliverables |
|---|---|---|
| 5.1 | Billing Database Schema | subscriptions, payment_transactions tables, Chargily webhook idempotency |
| 5.2 | Chargily Integration | API client, create-checkout, CIB/EDahabia only, HMAC webhook verification |
| 5.3 | Starter Subscription Flow | Chargily checkout → subscription creation/renewal → 200-credit grant |
| 5.4 | Add-on Credit Packs | Pack purchase flow, 75/250 credit grants, never-expiry, drawdown order |
| 5.5 | Billing Page UI | PlanCard, PackCards, PaymentHistory, DangerZone, cancel flow |
| 5.6 | Status Card + Polling Bridge | Chargily return page, 60s polling, success/timeout states, toast |
| 5.7 | Subscription State + Banners | SubscriptionChip, persistent failed-renewal banner, UpgradeDialog |
