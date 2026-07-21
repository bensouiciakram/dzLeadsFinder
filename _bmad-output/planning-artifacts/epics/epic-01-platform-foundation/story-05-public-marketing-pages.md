---
title: Story 1.5 — Public Marketing Pages
story_id: 1.5
epic: 1
status: draft
frs: [FR-4, FR-29, FR-30, FR-31]
ads: [AD-10]
ux_drs: [UX-DR20, UX-DR21, UX-DR22, UX-DR23]
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
**Then** it lists sources used: Google Places API, El Mouchir public pages, Pages Jaunes Algérie (with rate-limit note)
**And** it lists sources NOT used: CNRC (with rationale), LinkedIn (with rationale)
**And** each source card is localized

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
