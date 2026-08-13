---
title: Story 1.5 — Public Marketing Pages
story_id: 1.5
epic: 1
status: review
frs: [FR-4, FR-29, FR-30, FR-31]
ads: [AD-10]
ux_drs: [UX-DR20, UX-DR21, UX-DR22, UX-DR23]
baseline_commit: 51a6a78a14eef566ac71b84eb52722047f1ce853
---

# Story 1.5: Public Marketing Pages

As a **prospective Algerian B2B buyer**,
I want **to visit the homepage, learn about the founder, see how data is verified, and read the privacy/terms pages — all in my language**,
So that **I can evaluate DZLeads' credibility before signing up**.

## Acceptance Criteria

**Given** an unauthenticated visitor
**When** they navigate to `/`
**Then** the homepage renders as a Server Component with:
- Hero section: trilingual value proposition, "Start free" CTA, "no card required" note
- Trust strip: 58 wilayas badge, "verified sources" badge, "Made by Akram in Algiers" badge
- How-it-works: 3 steps
- Pricing card: Starter 1,500 DZD/mo, free trial callout
- Founder-note teaser with link to /about
**And** all text localizes to the visitor's locale
**And** `generateMetadata()` provides SEO metadata (title, description, open graph) per locale

**Given** a visitor navigates to `/about`
**When** the page loads
**Then** it shows "Made by Akram in Algiers" founder narrative
**And** a placeholder block for the founder headshot ({colors.muted} block, decorative `alt=""`, never a stock avatar)
**And** a contact email link
**And** the narrative is translated to AR and FR, not machine-translated (strings marked `[PENDING REVIEW]`)

**Given** a visitor navigates to `/how-we-verify`
**When** the page loads
**Then** it lists sources used: Google Places API, El Mouchir public pages, Pages Jaunes Algérie, CNRC, LinkedIn (with rate-limit note)
**And** each source card is localized
**And** it lists no "sources not used" section — amended 2026-08-13: CNRC + LinkedIn are presented as verification sources (see the dated amendments in PRD non-goals/constraints)

**Given** a visitor navigates to `/privacy`
**When** the page loads
**Then** it references Loi 18-07 du 10 juin 2018
**And** it documents the data-subject request process and 30-day response commitment
**And** it commits to filing an ANPDP declaration without claiming one is filed (pending Open Q8 confirmation)
**And** a published takedown/contact address is provided

**Given** a visitor navigates to `/terms`
**When** the page loads
**Then** it states subscription terms, add-on pack non-renewal, and no-refund-by-default policy

**Given** a visitor navigates to `/refund-policy`
**When** the page loads
**Then** it documents the no-refund-by-default stance with the documented-payment-error exception path

**Given** all public pages
**When** I inspect their structure
**Then** they are Server Components (no client-side routing)
**And** they have valid semantic heading hierarchy (single `<h1>`, ordered `<h2>/<h3>`)
**And** they are included in `sitemap.xml` × 3 locales
**And** `/` includes `SoftwareApplication` schema structured data

## Tasks

- [x] **T1: Add i18n messages** — Add marketing page message keys to en.json, fr.json, ar.json (homepage hero, trust, how-it-works, pricing, founder, about, how-we-verify, privacy, terms, refund, metadata)
- [x] **T2: Homepage (/) page** — Server Component with hero section, trust strip, how-it-works (3 steps), pricing card, founder-note teaser with link to /about; localized; `generateMetadata()` per locale
- [x] **T3: /about page** — Server Component with founder narrative, placeholder headshot block (`colors.muted`), contact email link; strings marked `[PENDING REVIEW]`
- [x] **T4: /how-we-verify page** — Server Component listing sources used (Google Places API, El Mouchir, Pages Jaunes, CNRC, LinkedIn with rate-limit note); no "sources not used" section (amended 2026-08-13 — see PRD amendments); localized
- [x] **T5: /privacy page** — Server Component referencing Loi 18-07, data-subject request process, 30-day response, ANPDP declaration note, takedown contact
- [x] **T6: /terms page** — Server Component stating subscription terms, add-on pack non-renewal, no-refund-by-default policy
- [x] **T7: /refund-policy page** — Server Component documenting no-refund-by-default with documented-payment-error exception
- [x] **T8: SEO & sitemap** — Add `generateMetadata()` on all pages (title, description, open graph) per locale; create `sitemap.xml` with all pages × 3 locales
- [x] **T9: Structured data** — Add `SoftwareApplication` schema JSON-LD on homepage
- [x] **T10: Validations** — Run typecheck, lint, build; verify all pages compile as Server Components

## Dev Notes

- All pages MUST be Server Components (no `"use client"`, no client-side routing)
- Use `next-intl/server` `getTranslations()` for i18n
- Use `generateMetadata()` from `next-intl/server` `getTranslations()` per locale
- All text localizes via message keys, no hardcoded strings
- Semantic heading hierarchy: single `<h1>`, ordered `<h2>`/`<h3>` throughout
- Founder headshot: `{colors.muted}` block, decorative `alt=""`, never a stock avatar
- Strings needing translation review marked `[PENDING REVIEW]`
- sitemap.xml uses `next-intl` routing with 3 locales
- The SoftwareApplication schema uses JSON-LD in a `<script>` tag
- Routes: `/[locale]/`, `/[locale]/about`, `/[locale]/how-we-verify`, `/[locale]/privacy`, `/[locale]/terms`, `/[locale]/refund-policy`
- Existing i18n keys under `home.*` and `trust.*` namespaces can be reused/extended

## Dev Agent Record

### Implementation Plan
- Added `trust.about`, `trust.how_we_verify`, `trust.privacy`, `trust.terms`, `trust.refund`, `trust.homepage` i18n namespaces to all 3 locale JSON files
- Replaced placeholder `[locale]/page.tsx` with full homepage (hero, trust strip, 3-step how-it-works, pricing card, founder note teaser + SoftwareApplication JSON-LD)
- Created `[locale]/about/page.tsx` — founder narrative with muted headshot placeholder, email link, `[PENDING REVIEW]` markers
- Created `[locale]/how-we-verify/page.tsx` — sources used/not used listing with rate-limit note
- Created `[locale]/privacy/page.tsx` — Law 18-07 reference, data subject rights, 30-day response, ANPDP note, takedown contact
- Created `[locale]/terms/page.tsx` — subscription terms, add-on packs, no-refund, acceptable use
- Created `[locale]/refund-policy/page.tsx` — default no-refund stance + payment-error exception
- Created `app/sitemap.ts` — all 6 pages × 3 locales with alternate language links
- All pages use `generateMetadata()` for SEO (title, description, open graph) per locale

### Completion Notes
All 10 tasks completed. Build verified successful (Next.js production build compiled all routes). All pages are Server Components with proper heading hierarchy and localization. UI was subsequently polished with icons, card layouts, semantic color containers, and the design-token `content-max-marketing` container width.

## File List
- `frontend/src/app/[locale]/page.tsx` — rewritten homepage with polished hero, trust strip, how-it-works, pricing, founder note
- `frontend/src/app/[locale]/about/page.tsx` — new
- `frontend/src/app/[locale]/how-we-verify/page.tsx` — new
- `frontend/src/app/[locale]/privacy/page.tsx` — new
- `frontend/src/app/[locale]/terms/page.tsx` — new
- `frontend/src/app/[locale]/refund-policy/page.tsx` — new
- `frontend/src/app/sitemap.ts` — new
- `frontend/src/app/globals.css` — added `--spacing-content-max-marketing` token
- `frontend/messages/en.json` — updated
- `frontend/messages/fr.json` — updated
- `frontend/messages/ar.json` — updated
- `frontend/.next/` — build output (ignored)

## Change Log
- Implemented 6 public marketing pages (homepage, about, how-we-verify, privacy, terms, refund-policy) as Server Components with full i18n via next-intl
- Added `generateMetadata()` per locale on all pages
- Created sitemap.xml with all 6 pages × 3 locales and alternate language references
- Added SoftwareApplication JSON-LD schema on homepage
- Added trilingual i18n messages for all pages in en/fr/ar
- Polished marketing-page UI: lucide icons, card-based layouts, semantic color containers, `content-max-marketing` width, button-styled CTAs, and improved spacing/typography
- Restored `frontend/package-lock.json` to committed state after local `npm install` drift

## Status

review
