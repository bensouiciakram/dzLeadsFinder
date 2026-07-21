---
title: Story 1.2 — Design Token System
story_id: 1.2
epic: 1
status: draft
frs: [FR-1, FR-2]
ads: [AD-2, AD-8, AD-9]
ux_drs: [UX-DR1, UX-DR2, UX-DR3, UX-DR4]
---

# Story 1.2: Design Token System

As a **developer and designer**,
I want **a Tailwind CSS 4 configuration that maps every DESIGN.md token to CSS custom properties with logical-property enforcement**,
So that **the entire UI is consistent, RTL-safe from day one, and rebrandable by changing one file**.

## Acceptance Criteria

**Given** the Tailwind config is loaded
**When** I inspect the generated CSS custom properties
**Then** all DESIGN.md color tokens are present:
- `--color-primary: #0F766E` (teal-700)
- `--color-primary-foreground: #FFFFFF`
- `--color-primary-hover: #115E59`
- `--color-ring: #0F766E`
- `--color-background: #FFFFFF` through `--color-border: #E2E8F0`
- Semantic: `--color-success`, `--color-warning`, `--color-danger`, `--color-info` each with `-foreground`, `-container`, `-on-container` pairs
- All pairs verified WCAG 2.1 AA per DESIGN.md contrast table

**Given** the typography tokens are configured
**When** I inspect the theme
**Then** `font-sans` maps to `Inter, ui-sans-serif, ...` (Latin stack)
**And** `font-arabic` utility maps to `"Noto Kufi Arabic", ...`
**And** the type ramp matches: display (36px/700), headline (24px/600), title (18px/600), body (16px/400), small (14px/400), caption (12px/500), data (14px/500)
**And** `tabular-nums` utility class sets `font-variant-numeric: tabular-nums`

**Given** the spacing and rounded tokens are configured
**When** I use theme values
**Then** `rounded-md` = 6px, `rounded-lg` = 8px, `rounded-xl` = 12px, `rounded-full` = 9999px
**And** named spacing: `gutter` = 16px, `gutter-desktop` = 24px, `sidebar-width` = 288px, `content-max-app` = 1280px

**Given** stylelint is configured
**When** I run the CSS lint check
**Then** it bans these physical properties anywhere in the codebase:
- `margin-left`, `margin-right`, `padding-left`, `padding-right`
- `left:` (property), `right:` (property)
- `text-align: left`, `text-align: right`
**And** requires logical equivalents: `ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`
**And** the CI build fails if any physical property is found

**Given** the numeral rule
**When** I inspect the global CSS
**Then** `font-variant-numeric: tabular-nums` is applied via a `.tabular-nums` utility
**And** no Eastern Arabic numeral ranges (U+0660–U+0669, U+06F0–U+06F9) are referenced in any style

**Given** brand swap requirements
**When** the founder supplies new brand colors
**Then** the rebrand is a one-file change to `tailwind.config.ts` — no component CSS changes needed
