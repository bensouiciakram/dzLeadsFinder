---
title: Story 1.7 — App Shell (Header + Footer)
story_id: 1.7
epic: 1
status: review
frs: [FR-1, FR-2, FR-15, FR-28]
ads: [AD-2, AD-10]
ux_drs: [UX-DR5, UX-DR6, UX-DR7, UX-DR15, UX-DR21, UX-DR22]
---

# Story 1.7: App Shell (Header + Footer)

As a **user navigating the application**,
I want **a persistent header with the logo, locale switcher, credits pill, subscription chip, and user menu — plus a footer with product/trust/legal links**,
So that **I can orient myself, switch language, see my balance, and access key pages from anywhere**.

## Acceptance Criteria

**Given** the App Shell component
**When** any authenticated page renders
**Then** the Header renders with:
- Logo (wordmark, plain text in {typography.title} pending founder brand)
- Logo link → `/search` (authenticated) or `/` (guest)
- Locale Switcher (always visible, see Story 1.4)
- Credits Pill placeholder (visible when authenticated; Story 4.3 adds live balance)
- Subscription Chip placeholder (visible when authenticated; Story 5.7 adds live state)
- User Menu placeholder (visible when authenticated; Stories 2.2–2.5 add items)
- Login + Start Free CTA (visible when guest)

**Given** the Header sticky behavior
**When** the user scrolls
**Then** the header stays fixed at the top
**And** all layout uses logical properties — no hardcoded left/right

**Given** the Footer component
**When** any page renders (public or app)
**Then** the Footer renders with:
- {colors.muted} background, 32px block padding, {spacing.gutter-desktop} inline padding
- Three columns:
  - **Product**: Search, Pricing CTA, Wilayas
  - **Trust**: How we verify, About
  - **Legal**: Privacy, Terms, Refund policy
- Column heads in {typography.caption}, links in {typography.small} {colors.muted-foreground}
- Link hover: {colors.foreground}
- Bottom line: "Made by Akram in Algiers"
- Repeated Locale Switcher instance
- Body copy at {typography.body.fontSize} minimum

**Given** the RootLayout component hierarchy
**When** the app renders
**Then** the React tree follows the Architecture Component Tree:
- `<RootLayout>` (Server: reads locale, dir, session)
- `<SessionProvider>` (Client)
- `<LocaleProvider>` (Client)
- `<CreditProvider>` (Client — balance context, Story 4.3)
- `<AppShell>` (Server: Header + Footer)
- `{children}` between Header and Footer

**Given** the RootLayout rendering
**When** the app initialises
**Then** locale and `dir` are set on `<html>` before any visible render
**And** the layout is responsive: mobile gutters at {spacing.gutter}, desktop at {spacing.gutter-desktop}

## Change Log

| Date | Change |
|------|--------|
| 2026-07-28 | Implemented Story 1.7 — redesigned Header (sticky, nav links, guest/authenticated states), redesigned Footer (3-column Product/Trust/Legal, "Made by Akram in Algiers"), created provider wrappers (SessionProvider, LocaleProvider, CreditProvider), updated AppShell to wrap with providers. |

## File List

- `frontend/src/components/layout/Header.tsx` — modified: sticky header with nav links, guest CTAs, authenticated nav placeholders
- `frontend/src/components/layout/Footer.tsx` — modified: 3-column footer (Product/Trust/Legal) with "Made by Akram in Algiers" and LocaleSwitcher
- `frontend/src/components/layout/AppShell.tsx` — modified: wrapped children with SessionProvider, LocaleProvider, CreditProvider
- `frontend/src/components/providers/SessionProvider.tsx` — new: client context provider for auth state
- `frontend/src/components/providers/LocaleProvider.tsx` — new: client context provider for locale
- `frontend/src/components/providers/CreditProvider.tsx` — new: client context provider for credit balance
