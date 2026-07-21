---
title: Story 1.3 — Locale System & RTL
story_id: 1.3
epic: 1
status: draft
frs: [FR-1, FR-2, FR-3]
ads: [AD-6, AD-8, AD-10, AD-11]
ux_drs: [UX-DR3, UX-DR4, UX-DR23, UX-DR25]
---

# Story 1.3: Locale System & RTL

As a **trilingual user**,
I want **the application to render in Arabic, French, or English with correct text direction (RTL/LTR) inferred from my browser settings on first visit**,
So that **I can use the product in my preferred language from the moment I land**.

## Acceptance Criteria

**Given** a first-time visitor with `Accept-Language: ar` headers
**When** they request any page
**Then** the HTML element renders with `lang="ar" dir="rtl"`
**And** the page content is in Arabic
**And** the RTL layout renders immediately — no LTR flash, no layout animation

**Given** the locale lifecycle implementation
**When** a guest user visits for the first time
**Then** locale is inferred from `Accept-Language` (AR → FR → EN priority)
**And** an `x-locale-hint` cookie is set with the inferred value

**Given** the locale fall-through rules
**When** a translation key is missing in the active locale
**Then** in production:
- AR missing key → falls through to FR text
- FR missing key → falls through to EN text
- EN missing key → renders the key name wrapped in brackets
**And** in development: missing keys wrap in `[MISSING: key.name]` for visibility

**Given** the CI i18n check
**When** `npm run check:i18n` runs
**Then** it verifies every key in `messages/en/` exists in `messages/fr/` and `messages/ar/`
**And** the CI build fails if any key is missing

**Given** the message file structure
**When** I inspect `frontend/messages/`
**Then** three locale folders exist: `ar/`, `fr/`, `en/`
**And** each contains parallel JSON files: `common.json`, `home.json`, `search.json`, `billing.json`, `trust.json`, `auth.json`

**Given** a returning authenticated user
**When** they request any page
**Then** their last-selected locale is loaded from `users.locale` column, not re-inferred

**Given** a returning guest user
**When** they request any page
**Then** their locale is loaded from the `x-locale` cookie
**And** if no cookie exists, re-inference from `Accept-Language` occurs

**Given** an Arabic locale visitor
**When** any page renders
**Then** all numerals (credits, prices, codes, dates) use Western Arabic glyphs (0-9)
**And** dates use `Intl.DateTimeFormat(locale)` — verified to produce Western numerals on target browsers

### File Structure

```
frontend/
  messages/
    ar/ (common.json, home.json, search.json, billing.json, trust.json, auth.json)
    fr/ (parallel structure)
    en/ (parallel structure)
  src/
    middleware.ts               # Accept-Language inference, x-locale-hint cookie
    lib/
    i18n/
      config.ts                 # Locale definitions, fall-through rules
      client.ts                 # Client-side locale switching
      server.ts                 # Server-side locale resolution
```
