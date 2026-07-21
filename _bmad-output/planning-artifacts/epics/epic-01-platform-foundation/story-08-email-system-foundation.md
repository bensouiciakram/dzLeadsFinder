---
title: Story 1.8 — Email System Foundation
story_id: 1.8
epic: 1
status: draft
frs: [FR-3]
ads: [AD-14]
ux_drs: [UX-DR23]
---

# Story 1.8: Email System Foundation

As a **user receiving transactional emails**,
I want **system emails (signup confirm, payment receipt, pack receipt, low-credit warning) to render in my active locale with correct RTL support**,
So that **I get a coherent experience across the web app and my inbox**.

## Acceptance Criteria

**Given** the email system infrastructure
**When** I inspect `frontend/emails/`
**Then** it contains:
- `components/BaseEmail.tsx` — shared wrapper with `dir="auto"`, inline styles, RTL-aware responsive layout
- `components/SignupConfirm.tsx`
- `components/PaymentReceipt.tsx`
- `components/PackReceipt.tsx`
- `components/LowCredit.tsx`
- `render/route.ts` — API route `POST /api/emails/render`

**Given** the BaseEmail component
**When** any email renders
**Then** `BaseEmail` sets `dir="auto"` and includes inline-styled responsive wrapper
**And** plain-text fallback is auto-generated from the TSX content

**Given** the render API route
**When** Celery calls `POST /api/emails/render` with `{ template: "payment_receipt", locale: "fr", context: {...} }`
**Then** Next.js renders the TSX component via `@react-email/render` and returns HTML string
**And** Celery wraps the HTML in Django `EmailMessage` and sends via SMTP (Resend/SendGrid)

**Given** email localisation
**When** a user with AR locale receives a payment receipt
**Then** the email renders with RTL layout in supporting HTML email clients
**And** the content is in Arabic
**And** CSV/xlsx column headers localise to the export-session locale per FR-3

**Given** the email triggers
**Then** these Celery tasks exist with the specified templates:

| Trigger | Task | Template | Context |
|---|---|---|---|
| Post-signup | `send_verification_email.delay(user_id)` | SignupConfirm | verification_link |
| Payment received | `send_payment_receipt.delay(txn_id)` | PaymentReceipt | amount, credits_granted, date |
| Pack received | `send_pack_receipt.delay(txn_id)` | PackReceipt | pack_credits, amount, never_expires_note |
| Low-credit warning | Daily Celery beat: `check_low_credits` | LowCredit | remaining_credits, top_up_link |
