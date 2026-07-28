---
title: Story 1.6 — 58-Wilaya Taxonomy Page
story_id: 1.6
epic: 1
status: review
frs: [FR-10]
ads: [AD-3]
ux_drs: [UX-DR21, UX-DR23]
---

# Story 1.6: 58-Wilaya Taxonomy Page

As a **credibility-conscious buyer**,
I want **to see the official 58-wilaya taxonomy published openly on `/wilayas` with codes and trilingual names**,
So that **I trust the dataset is grounded in Algeria's actual administrative geography (not DzLeads' 48 or Linkiw's 69)**.

## Acceptance Criteria

**Given** the `/wilayas` page
**When** any visitor loads it
**Then** it displays a complete table of all 58 wilayas with:
- Numeric code (1–58) in Western numerals
- Arabic name (`name_ar`)
- French name (`name_fr`)
- English name (`name_en`)
**And** the page is public (no auth required) and crawlable

**Given** accessibility requirements (AA page)
**When** I inspect the table markup
**Then** it has:
- `<caption>`: "The 58 wilayas of Algeria — codes 1–58 with Arabic, French, and English names"
- `th scope="col"` on each language column header
- `th scope="row"` on each wilaya code cell
- Per-cell `lang` attribute on name cells (e.g., `lang="ar"` on Arabic names)
**And** a client-side filter input (visibly labeled, not placeholder-only) for filtering by code or name

**Given** the wilaya data model
**When** I query the `wilayas` table
**Then** it contains exactly 58 rows with codes 1–58
**And** each row has `name_ar`, `name_fr`, `name_en` — no blanks
**And** the table is seeded via Django migration

**Given** a wilaya filter in search
**When** the wilaya values are rendered
**Then** they match exactly the 58 wilayas in the `wilayas` table
**And** the display format is `{code} — {localized name}` (e.g., "31 — Oran" / "31 — وهران")
**And** if a localized name is missing, the fallback is the transliterated Arabic name — never a blank

**Given** the `/wilayas` page serves as the credibility anchor
**When** a visitor views it
**Then** it is linked from the footer Product column
**And** the 58-wilaya count is the authoritative count used everywhere in the application

## Change Log

| Date | Change |
|------|--------|
| 2026-07-28 | Implemented Story 1.6 — created static wilayas data file, translation keys, WilayaTable client component, wilayas page, and updated sitemap. |

## File List

- `frontend/src/data/wilayas.ts` — new: static 58-wilaya dataset with trilingual names
- `frontend/src/components/wilayas/WilayaTable.tsx` — new: client component with search filter and semantic table
- `frontend/src/app/[locale]/wilayas/page.tsx` — new: public wilayas taxonomy page with Server Component pattern
- `frontend/messages/en.json` — modified: added `trust.wilayas` namespace
- `frontend/messages/fr.json` — modified: added `trust.wilayas` namespace
- `frontend/messages/ar.json` — modified: added `trust.wilayas` namespace
- `frontend/src/app/sitemap.ts` — modified: added `/wilayas` to PAGES array
