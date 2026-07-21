---
title: Story 1.4 — Locale Switcher & Confirm Banner
story_id: 1.4
epic: 1
status: draft
frs: [FR-1, FR-2]
ads: [AD-6]
ux_drs: [UX-DR5, UX-DR17, UX-DR21, UX-DR23, UX-DR24, UX-DR25]
---

# Story 1.4: Locale Switcher & Confirm Banner

As a **multilingual user**,
I want **a visible language switcher that shows locale names in their native script (العربية / Français / English) with a globe icon, and a one-time banner confirming my inferred language**,
So that **I can switch languages at any time without losing my work, and know the app didn't silently guess wrong**.

## Acceptance Criteria

**Given** the Locale Switcher component renders in the header (every page, logged in and out)
**When** I inspect it
**Then** it uses shadcn Select with:
- `lucide Globe` icon at inline-start
- Native locale names only — **العربية / Français / English** — no flags
- {typography.small} font, {rounded.md}, 36px trigger height
- Hover: {colors.muted} fill; active option: {colors.muted} fill
- Arabic option label renders in Noto Kufi Arabic font family

**Given** the locale switcher is repeated in the footer
**When** I scroll to the footer
**Then** a second instance of the switcher is present with the same behavior

**Given** a user switches locale (e.g., AR → FR)
**When** they select a different locale
**Then** the `dir` attribute on `<html>` flips instantly (RTL ↔ LTR)
**And** UI text fades with a ≤150ms opacity transition — no layout animation, no skeleton interstitial
**And** all in-flight state is preserved:
- Staged filter selections
- Keyword input text
- Current page / cursor position
- Expanded reveal rows
- Scroll anchor position
- Saved-search selection
**And** only the localized strings + facet labels are re-fetched (never re-runs the search query)
**And** `aria-live="polite"` announces the new locale: "Interface language: Français"

**Given** focus management during locale switch
**When** the locale changes
**Then** focus is captured before the flip and restored to the same logical control after (by stable element ID)
**And** if the control node was re-created, focus moves to the locale-switcher trigger

**Given** the first-visit Confirm Banner
**When** a new visitor arrives with inferred locale
**Then** a one-time banner renders at the top of the page:
- Information-toned ({colors.info-container} / {colors.info-on-container})
- Message in the inferred locale: "We guessed your language — switch?"
- Outline switch button with {colors.info} border and text
- Dismiss `X` button
**And** the banner shows only once per visitor
**And** the choice persists to profile (authenticated) or cookie (guest)

**Given** the confirm banner is dismissed or a choice is made
**When** the user returns
**Then** the banner never shows again
**And** the `x-locale-confirmed` cookie is set (1-year expiry)
**And** authenticated users persist choice to `users.locale`

**Given** keyboard accessibility requirements
**When** I navigate the locale switcher with keyboard
**Then** the Select is fully operable: open with Enter/Space, arrow between options, Enter to select, Esc to close
**And** focus returns to the trigger on close
