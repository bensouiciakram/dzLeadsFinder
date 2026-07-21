---
name: Algerian B2B Lead Platform
description: Visual identity spine for a trilingual (AR/FR/EN, RTL-aware) Algerian B2B lead-generation web app. Inherits shadcn/ui + Tailwind defaults; this file specifies deltas only.
status: final
created: 2026-07-19
updated: 2026-07-19
sources:
  - _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/index.md
colors:
  # PLACEHOLDER PALETTE — every token below is a working default pending
  # founder brand (Open Q10). Swappable at token level only; no component
  # may hardcode a hex.
  # Brand layer
  primary: '#0F766E'              # Tailwind teal-700 — deep trust teal
  primary-foreground: '#FFFFFF'
  primary-hover: '#115E59'        # Tailwind teal-800
  ring: '#0F766E'
  # Neutral slate surfaces
  background: '#FFFFFF'
  foreground: '#0F172A'           # slate-900
  card: '#FFFFFF'
  card-foreground: '#0F172A'
  muted: '#F1F5F9'                # slate-100
  muted-foreground: '#64748B'     # slate-500 — lightest text on WHITE only; never on muted fills
  muted-strong: '#334155'         # slate-700 — text on muted fills (footer links, inset previews)
  border: '#E2E8F0'               # slate-200
  input: '#E2E8F0'
  # Semantic (solid + tonal-container pairs)
  success: '#047857'              # emerald-700 — muted, reads as UI state not flag green
  success-foreground: '#FFFFFF'
  success-container: '#ECFDF5'    # emerald-50
  success-on-container: '#064E3B' # emerald-900
  warning: '#B45309'              # amber-700
  warning-foreground: '#FFFFFF'
  warning-container: '#FEF3C7'    # amber-100
  warning-on-container: '#78350F' # amber-900
  danger: '#B91C1C'               # red-700, brick — overrides shadcn `destructive`
  danger-foreground: '#FFFFFF'
  danger-container: '#FEF2F2'     # red-50
  danger-on-container: '#7F1D1D'  # red-900
  info: '#0369A1'                 # sky-700
  info-foreground: '#FFFFFF'
  info-container: '#F0F9FF'       # sky-50
  info-on-container: '#0C4A6E'    # sky-900
typography:
  font-latin:
    fontFamily: 'Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  font-arabic:
    fontFamily: '"Noto Kufi Arabic", "Segoe UI", Tahoma, Arial, sans-serif'
  display:
    fontSize: 36px                # Tailwind text-4xl
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em        # Latin only — never on Arabic
  headline:
    fontSize: 24px                # text-2xl
    fontWeight: '600'
    lineHeight: '1.3'
  title:
    fontSize: 18px                # text-lg
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontSize: 16px                # text-base — delta: shadcn default is 14px
    fontWeight: '400'
    lineHeight: '1.6'
  small:
    fontSize: 14px                # text-sm
    fontWeight: '400'
    lineHeight: '1.5'
  caption:
    fontSize: 12px                # text-xs
    fontWeight: '500'
    lineHeight: '1.4'
  data:
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'             # always rendered with tabular-nums
rounded:
  sm: 4px
  DEFAULT: 6px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  # Tailwind 4-based scale inherited; named layout deltas only.
  4: 16px                         # Tailwind step parity — chip gaps, inline groups
  gutter: 16px
  gutter-desktop: 24px
  section-gap: 48px
  sidebar-width: 288px
  content-max-app: 1280px
  content-max-marketing: 1024px
components:
  locale-switcher:
    background: '{colors.card}'
    foreground: '{colors.card-foreground}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    height: 36px
    hover-background: '{colors.muted}'
    focus-ring: '2px {colors.ring}'
    option-active-background: '{colors.muted}'
  credits-pill:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    radius: '{rounded.full}'
    height: 28px
    padding-inline: 12px
    font-variant-numeric: 'tabular-nums'
    warning-background: '{colors.warning-container}'
    warning-foreground: '{colors.warning-on-container}'
    zero-background: '{colors.danger-container}'
    zero-foreground: '{colors.danger-on-container}'
  subscription-chip:
    radius: '{rounded.full}'
    height: 28px
    free-background: 'transparent'
    free-foreground: '{colors.primary}'
    free-border: '1px solid {colors.primary}'
    starter-background: '{colors.primary}'
    starter-foreground: '{colors.primary-foreground}'
  filter-sidebar:
    width: '{spacing.sidebar-width}'
    background: '{colors.card}'
    border-inline-end: '1px solid {colors.border}'
    apply-background: '{colors.primary}'
    apply-foreground: '{colors.primary-foreground}'
    apply-radius: '{rounded.md}'
  filter-chip:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    radius: '{rounded.full}'
    height: 28px
    hover-background: '{colors.border}'
  wilaya-combobox:
    background: '{colors.card}'
    border: '1px solid {colors.input}'
    radius: '{rounded.md}'
    chip-background: '{colors.muted}'
    chip-radius: '{rounded.full}'
    option-active-background: '{colors.muted}'
    focus-ring: '2px {colors.ring}'
  results-table:
    header-foreground: '{colors.muted-foreground}'
    row-border: '1px solid {colors.border}'
    row-hover-background: '{colors.muted}'
    row-height: 48px
    font-variant-numeric: 'tabular-nums'
  results-table-stacked-row:
    background: '{colors.card}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.gutter}'
  reveal-button:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    hover-background: '{colors.primary-hover}'
    radius: '{rounded.md}'
    height: 32px
    aria-disabled-background: '{colors.muted}'
    aria-disabled-foreground: '{colors.muted-strong}'
    aria-disabled-border: '1px solid {colors.border}'
    revealed-badge-background: '{colors.success-container}'
    revealed-badge-foreground: '{colors.success-on-container}'
  export-modal:
    background: '{colors.card}'
    radius: '{rounded.xl}'
    max-width: 560px
    preview-background: '{colors.muted}'
    preview-radius: '{rounded.md}'
    confirm-background: '{colors.primary}'
    confirm-foreground: '{colors.primary-foreground}'
  pack-card:
    background: '{colors.card}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.gutter-desktop}'
    best-value-badge-background: '{colors.primary}'
    best-value-badge-foreground: '{colors.primary-foreground}'
    best-value-badge-radius: '{rounded.full}'
  status-card:
    radius: '{rounded.lg}'
    polling-background: '{colors.info-container}'
    polling-foreground: '{colors.info-on-container}'
    success-background: '{colors.success-container}'
    success-foreground: '{colors.success-on-container}'
  banner:
    radius: '{rounded.md}'
    info-background: '{colors.info-container}'
    info-foreground: '{colors.info-on-container}'
    warning-background: '{colors.warning-container}'
    warning-foreground: '{colors.warning-on-container}'
    danger-background: '{colors.danger-container}'
    danger-foreground: '{colors.danger-on-container}'
    persistent-height: 40px
  checklist-card:
    background: '{colors.card}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    check-color: '{colors.success}'
    step-complete-foreground: '{colors.muted-foreground}'
  confirm-banner:
    background: '{colors.info-container}'
    foreground: '{colors.info-on-container}'
    radius: '{rounded.md}'
    switch-border: '1px solid {colors.info}'
    switch-foreground: '{colors.info}'
  footer:
    background: '{colors.muted}'
    link-foreground: '{colors.muted-strong}'
    link-hover-foreground: '{colors.foreground}'
    padding-block: 32px
---

# DESIGN — Algerian B2B Lead Platform (V1)

> Inherits shadcn/ui + Tailwind token defaults; only deltas are specified here. Everything not named in this file (Button, Dialog, Sheet, Command, Select, Toast internals, shadow scale, base spacing scale) ships as shadcn renders it.

## Brand & Style

This product is a **trust instrument**, not a consumer app. Its users — Algerian founders, sales leads, and freelancers — are spending scarce credits on contact data they intend to act on. The visual identity must therefore read as sober, data-dense, and verifiable: quiet neutral surfaces, one confident brand hue reserved for action, semantic color reserved for state, and zero decorative chrome. Density is a feature; whitespace exists to separate decisions, not to impress.

Three postures define the brand layer:

1. **Trilingual parity.** Arabic, French, and English are first-class renderings of the same product, not translations of a Latin master. Arabic is a design input, not a test case: it gets its own type stack ({typography.font-arabic.fontFamily}), its own leading rules, and full RTL layout mirroring.
2. **Credits are sacred.** Anything that displays or spends credits (pill, ledger, cost previews) uses tabular numerals and unambiguous color state. The UI never animates, hides, or soft-pedals a deduction.
3. **Restraint by inheritance.** shadcn/ui defaults are the contract for the 80% of components this file does not name. Brand-layer overrides exist only where they carry meaning: {colors.primary} for action, semantic containers for state, pill geometry for meters and badges.

**Deferred brand assets (Open Q10 — founder supplies pre-launch).** This spine holds three token slots:

- `brand.logo` — **PENDING-FOUNDER**. Until supplied, the wordmark renders as plain text in {typography.title} weight using {typography.font-latin.fontFamily} / {typography.font-arabic.fontFamily} per locale.
- `brand.color` — **PENDING-FOUNDER**. Until supplied, {colors.primary} and its hover/ring derivatives hold the placeholder teal below.
- `brand.founder-headshot` — **PENDING-FOUNDER**. Used on the founder-note homepage teaser and /about; until supplied, render a {colors.muted} placeholder block, never a stock avatar.

When the founder brand lands, it enters **through token values only** — see the swap rule in Do's and Don'ts.

## Colors

**Every color token in this file is a working default pending founder brand — swappable at token level only.** No component, mock, or prototype may hardcode a hex; all color consumption goes through the tokens above so the rebrand is a one-file diff.

- **Primary Trust Teal ({colors.primary} `#0F766E`, hover {colors.primary-hover} `#115E59`)** — the single brand hue, a Tailwind teal-700/800 pair. Teal was chosen deliberately: it reads as calm B2B trust in the Algerian market without touching flag green or signal red, and it stays clearly distinct from all four semantic hues below. Used for primary actions (Apply filters, Reveal, Confirm export, buy pack), the Starter subscription chip, the Best-value badge, links, and {colors.ring} focus rings. Never used for state, never decorative.
- **Slate neutrals ({colors.background}, {colors.foreground}, {colors.card}, {colors.muted}, {colors.muted-foreground}, {colors.border}, {colors.input})** — Tailwind slate ramp on white. Surfaces stay white; separation comes from {colors.border} hairlines and {colors.muted} fills, not from tinted backgrounds. {colors.muted-foreground} is the lightest text color permitted on white.
- **Semantic solids ({colors.success}, {colors.warning}, {colors.danger}, {colors.info})** — icon/accent-grade solids for checks, badges, and small fills. Success (muted emerald) and danger (brick red) are deliberately desaturated relative to flag green/red so they read as UI semantics, not national symbolism. {colors.danger} overrides shadcn's `destructive` token at mapping time. White text sits on all four.
- **Semantic containers (`success-container` / `warning-container` / `danger-container` / `info-container` with their `*-on-container` text pairs)** — tonal surface pairs for banners, status cards, pill states, and badges. The container carries the tint; the on-container carries text and icons. These are the default way to show state — never the solids at full-bleed.

**WCAG 2.1 AA contrast (verified, load-bearing pairs):**

| Pair | Ratio | Verdict |
|---|---|---|
| {colors.primary-foreground} on {colors.primary} | 5.5:1 | AA ✓ |
| {colors.primary} on {colors.background} (links, Free chip) | 5.5:1 | AA ✓ |
| {colors.primary-foreground} on {colors.primary-hover} | 7.6:1 | AA ✓ |
| {colors.foreground} on {colors.background} / {colors.card} | 17.9:1 | AAA ✓ |
| {colors.muted-foreground} on {colors.background} | 4.8:1 | AA ✓ |
| {colors.muted-strong} on {colors.muted} (footer links, preview insets) | 9.5:1 | AAA ✓ |
| {colors.muted-strong} on {colors.background} | 12.6:1 | AAA ✓ |
| {colors.success-foreground} on {colors.success} | 5.5:1 | AA ✓ |
| {colors.warning-foreground} on {colors.warning} | 5.0:1 | AA ✓ |
| {colors.danger-foreground} on {colors.danger} | 6.5:1 | AA ✓ |
| {colors.info-foreground} on {colors.info} | 5.9:1 | AA ✓ |
| {colors.success-on-container} on {colors.success-container} | 9.2:1 | AA ✓ |
| {colors.warning-on-container} on {colors.warning-container} | 8.2:1 | AA ✓ |
| {colors.danger-on-container} on {colors.danger-container} | 9.2:1 | AA ✓ |
| {colors.info-on-container} on {colors.info-container} | 8.9:1 | AA ✓ |

[ASSUMPTION] **Light mode only for V1.** The decision log contains no dark-mode requirement; no `*-dark` tokens are defined. If dark mode ships later, add parallel tokens — do not reuse containers.

## Typography

**Stacks.** Two font families, switched by locale, never mixed within a string:

- **Latin stack — {typography.font-latin.fontFamily}** — Inter first, system fallbacks after. Used for FR and EN, and for every UI numeral in every locale (see numeral rule).
- **Arabic stack — {typography.font-arabic.fontFamily}** — Noto Kufi Arabic first, then Segoe UI / Tahoma. **Rule: all Arabic-script text always renders in the Arabic stack** — no exceptions, including Arabic text inside otherwise-Latin UI (e.g., wilaya fallback names in the FR interface).

Tailwind mapping: `font-sans` := {typography.font-latin.fontFamily}; a `font-arabic` utility := {typography.font-arabic.fontFamily}, applied automatically by the `lang="ar"` subtree.

**Numeral rule (PRD FR-15 — hard rule).** Credit balances, prices in DZD, wilaya codes, pagination, dates, row counts, and **all** UI numerals render **Western Arabic numerals (0-9)** in AR, FR, and EN locales alike. Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) never appear in the UI. Numerals are Latin-script glyphs and therefore always render in {typography.font-latin.fontFamily} even inside Arabic sentences. **Tabular figures (`font-variant-numeric: tabular-nums`) are mandatory** in the credits pill, the credit ledger, payment history, export cost breakdowns, and all {components.results-table} numeric columns — credit math must not jitter.

**Ramp (deltas on the Tailwind scale).**

| Role | Tailwind step | Value | Use |
|---|---|---|---|
| {typography.display} | text-4xl | 36px / 700 | Marketing hero, page-level empty states |
| {typography.headline} | text-2xl | 24px / 600 | Section heads, /billing card heads, modal titles |
| {typography.title} | text-lg | 18px / 600 | Card titles, stacked-row lead name |
| {typography.body} | text-base | 16px / 400 | **Delta:** shadcn default is 14px; 16px is the V1 body floor because Arabic at 14px is cramped |
| {typography.small} | text-sm | 14px / 400 | Meta lines, table cells, filter labels |
| {typography.caption} | text-xs | 12px / 500 | Badges, unit prices, legal lines |
| {typography.data} | text-sm | 14px / 500 | Any numeric readout; always tabular-nums |

**Arabic rules.** `letterSpacing` is Latin-only — never apply tracking to Arabic script (it breaks joining). [ASSUMPTION] In `ar` locale, add +0.2 to the lineHeight of {typography.display} and {typography.headline} (1.2→1.4, 1.3→1.5) to keep Kufi ascenders and diacritics unclipped; body roles already sit at ≥1.5 and need no adjustment.

## Layout & Spacing

**Logical properties are a HARD rule (FR-2).** All layout CSS uses flow-relative properties only: `margin-inline-start`, `padding-inline-end`, `inset-inline`, `border-inline-end`, `text-align: start/end`. Physical properties — `margin-left/right`, `padding-left/right`, `left:`, `right:`, `text-align: left/right` — are forbidden everywhere, including one-off fixes and third-party overrides. The mechanism is Tailwind's logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`) plus `rtl:` variants for the rare asymmetric exception.

**Direction flipping.** The `dir` attribute on `<html>` (`rtl` for AR, `ltr` for FR/EN) flips the entire tree instantly on locale switch. **No layout animation, no skeleton interstitial** (4G / low-end device budget): the reflow is immediate, and only the text swap may carry a short opacity fade (≤150ms). The inline-start filter sidebar renders on the left in FR/EN and on the right in AR with zero direction-specific code.

**App shell.** Desktop (`lg`, 1024px+): persistent inline-start filter sidebar at {spacing.sidebar-width} with `border-inline-end`; results region fills the remainder inside {spacing.content-max-app}. Mobile: sidebar becomes a bottom Sheet triggered by a Filters (n) button; results collapse to stacked rows. Public/marketing pages cap at {spacing.content-max-marketing}.

**Spacing.** Tailwind's 4-based scale is inherited untouched. Named deltas only: page gutters {spacing.gutter} (mobile) / {spacing.gutter-desktop} (desktop), {spacing.section-gap} between major marketing sections. [ASSUMPTION] The gutter, section-gap, and container-width values are working layout defaults — the decision log fixes the sidebar's existence and behavior, not its pixel width.

## Elevation & Depth

Inherited from shadcn, unmodified: overlays (Dialog, Sheet, Popover, Command, Select dropdown) carry shadcn's default shadow; everything else is flat. This product separates with **hairlines and tonal containers, not shadows** — cards and tables use 1px {colors.border}; state surfaces (banners, status cards, pill warnings) use semantic `*-container` tints. No custom elevation scale, no hover-lift on cards, no colored shadows. Depth is reserved for "this is floating above the page," which in V1 means exactly the export modal, the upgrade dialog, the recovery dialog, the mobile filter sheet, and dropdown surfaces.

## Shapes

Tighter than shadcn defaults — the product reads as a precise tool, not a rounded consumer app:

- **{rounded.md} (6px) is the DEFAULT radius** — buttons, inputs, comboboxes, the locale switcher.
- **{rounded.lg} (8px)** — cards: pack cards, checklist card, status card, stacked mobile rows.
- **{rounded.xl} (12px)** — dialogs and modals only.
- **{rounded.full} (9999px)** — pills, chips, badges: credits pill, subscription chip, filter chips, wilaya chips, Best-value badge, Already-revealed badge. Pill geometry signals "meter or status," never a clickable primary action.

## Components

Everything not listed here ships as stock shadcn/ui. State specs below cover hover / focus / disabled / aria-disabled; the universal focus treatment is a 2px {colors.ring} ring with 2px offset, and it must survive RTL mirroring unchanged.

- **locale-switcher** — shadcn Select, visible on every page, logged in or out (FR-1), repeated in the footer. Anatomy: lucide `Globe` icon at inline-start + native locale name. Options are **native names only — العربية / Français / English — never flags**. Trigger: {components.locale-switcher.height} tall, {colors.card} fill, 1px {colors.border}, {rounded.md}. Hover: {colors.muted} fill. Active option row: {colors.muted}. Arabic option label renders in {typography.font-arabic.fontFamily}. On switch: instant `dir` flip, ≤150ms text opacity fade, no layout animation; full in-flight state (filters, keyword, page, expanded rows, scroll anchor) is preserved.
- **credits-pill** — header meter, always visible in-app. Anatomy: coin icon + balance in {typography.data} with `tabular-nums`, Western numerals, {rounded.full}, 28px tall. **Default:** {colors.muted} / {colors.foreground}. **Warning (≤10 credits, paid):** {colors.warning-container} / {colors.warning-on-container} + a persistent lucide `alert-triangle` icon beside the balance (state is never color-only) + explanatory tooltip. **Zero:** {colors.danger-container} / {colors.danger-on-container}; clicking opens the recovery dialog (top-up for Starter, upgrade for Free). Decrements live on reveal/export; color transitions ≤200ms, the number itself never animates.
- **subscription-chip** — sits beside the credits pill. **Free:** transparent fill, {colors.primary} text and 1px {colors.primary} border, label "Free — Upgrade"; the whole chip is a button opening the upgrade dialog (FR-28). **Starter:** solid {colors.primary} / {colors.primary-foreground}, label "Starter — renews {date}" with a localized month name and Western numerals. {rounded.full}, 28px.
- **filter-sidebar** — persistent inline-start panel on desktop (renders right in RTL), {spacing.sidebar-width} wide, {colors.card} fill, 1px `border-inline-end`. Groups in order: industry, wilaya, seniority (People), size (Company), keyword; group labels in {typography.caption} uppercase-free (Arabic has no case), controls are stock shadcn. **Explicit Apply button** pinned at the bottom: full-width, {colors.primary} / {colors.primary-foreground}, {rounded.md} — one Apply = one query = one search counted (FR-7). Edits stage locally; nothing re-queries on change. Mobile: bottom Sheet with the same groups; trigger button shows a "Filters (n)" badge in {colors.primary}.
- **filter-chip** — one per active filter, row above results. {colors.muted} fill, {rounded.full}, 28px, label in {typography.small}, lucide `X` at inline-end. Hover: {colors.border} fill. Removing a chip stages the removal; the query re-runs only on the next Apply — chips never silently burn the daily cap.
- **wilaya-combobox** — shadcn Command inside a Popover. Search matches wilaya code, AR, FR, or EN name. Multi-select: chosen wilayas render as {rounded.full} {colors.muted} chips inside the trigger. Option rows show `code — localized name` (e.g., `31 — Oran` / `31 — وهران`); code always in Western numerals, name falling back to transliterated Arabic if a locale name is missing (FR-10) — Arabic fallback renders in {typography.font-arabic.fontFamily}, never a blank. Keyboard-active option: {colors.muted} fill. List max-height 280px, scrolls.
- **results-table** — desktop data table. Header: {typography.small} at 600 weight in {colors.muted-foreground}, sortable columns with a chevron at inline-end. Rows: 48px, separated by 1px {colors.border} bottom borders (no vertical gridlines), hover {colors.muted}. Numeric columns (People-count, wilaya code) use `tabular-nums`. **Column visual order flips with `dir`; the underlying column order is stable for CSV export (FR-2).** People columns: name / role / company / wilaya + reveal action. Company columns: name / industry / wilaya / size / People-count.
- **results-table-stacked-row** — the mobile variant: one card per record, {colors.card} fill, 1px {colors.border}, {rounded.lg}, {spacing.gutter} padding. Lead name in {typography.title}, meta lines in {typography.small} {colors.muted-foreground}, reveal action full-width at the bottom. Same data, same order as the table — a reflow, not a redesign.
- **reveal-button** — inline row action, 32px tall, {rounded.md}, {colors.primary} / {colors.primary-foreground}, label "Reveal" + 1-credit affordance. **Loading:** spinner replaces label, `aria-busy`, width pinned so the row doesn't jump. **aria-disabled (0 credits):** stays focusable, rendered as a tonal treatment — {colors.muted} fill, {colors.muted-strong} label (≥4.5:1, the control remains an active conversion path so no opacity fade), 1px {colors.border} — with a tooltip; clicking opens the recovery dialog — disabled-but-actionable conversion path. **Revealed:** the button is replaced by an Already-revealed badge — {colors.success-container} / {colors.success-on-container}, {rounded.full}, {typography.caption} — and the contact fields render inline; re-reveal is free and idempotent, no re-click required.
- **export-modal** — shadcn Dialog, {rounded.xl}, max-width 560px, always shown pre-export. Anatomy, top to bottom: row count; credit cost breakdown ("n revealed + m unrevealed = total credits", {typography.data}, tabular-nums); balance-after line; the "include unrevealed rows" checkbox, checked by default (FR-17); a **literal CSV mini-preview** — localized watermark header row, sample data rows, watermark footer row — rendered as content in a {colors.muted} {rounded.md} inset, {typography.small}, Western numerals. Confirm button: {colors.primary}. Free tier: modal states the 5-row cap and previews which 5 rows; the xlsx button renders visibly disabled with an Upgrade-to-use-Excel tooltip (FR-19). At the 5,000 rows/24h limit, the modal shows the come-back-tomorrow state instead of the form (FR-20).
- **pack-card** — two side by side on /billing, {colors.card}, 1px {colors.border}, {rounded.lg}, {spacing.gutter-desktop} padding. Anatomy: credit count in {typography.headline} (Western numerals), DZD price in {typography.title}, per-credit unit price ("6.7 DZD/credit" vs "6.0 DZD/credit") in {typography.caption} {colors.muted-foreground}, never-expires note with a {colors.success} check icon, buy button ({colors.primary}). **Best-value badge** on the 1,500 DZD / 250-credit card: solid {colors.primary} / {colors.primary-foreground}, {rounded.full}, positioned at the top-inline-end corner. Hover: border shifts to {colors.primary}; focus-visible gets the standard ring. Free users see the same cards (FR-25).
- **status-card** — inline card on /billing handling the Chargily return. **Polling (≤60s):** {colors.info-container} / {colors.info-on-container}, spinner + "Confirming payment…". **Success:** flips to {colors.success-container} / {colors.success-on-container}, "credits posted" + toast; never-expires note for packs. **Timeout:** stays info-toned with the payment-received-credits-post-soon note. Non-blocking — the rest of /billing stays interactive (FR-27).
- **banner** — full-width strip, {rounded.md}, icon at inline-start, message in {typography.small}, optional underlined CTA, dismiss `X` at inline-end **except on the persistent variant**. Variants: **info** ({colors.info-container} / {colors.info-on-container}) — 15-credit welcome, general notices; **warning** ({colors.warning-container} / {colors.warning-on-container}) — reserved for recoverable account friction; **danger** ({colors.danger-container} / {colors.danger-on-container}) — 0-credit state with top-up CTA; **persistent** — the failed-renewal banner: danger-toned, compact 40px, non-dismissible (no `X`), pinned on all app surfaces until resolved (FR-28).
- **checklist-card** — first-run onboarding card on the search screen, below the 15-credit banner. {colors.card}, 1px {colors.border}, {rounded.lg}. Three steps — Run first search / Reveal a contact / Export a CSV — each with a circle-check icon. Pending step: {colors.border} icon, {colors.foreground} label. Complete step: {colors.success} check, label in {colors.muted-foreground} (no strikethrough — it degrades Arabic legibility). Live check-off as actions complete; dismiss `X` at top-inline-end; the card vanishes when complete or dismissed.
- **confirm-banner** — one-time first-visit locale banner (Accept-Language inference, FR-1). Info-toned ({colors.info-container} / {colors.info-on-container}), full width at the top of the page, message in the inferred locale: "We guessed your language — switch?" with an outline switch button ({colors.info} border and text) and a dismiss `X`. Shows once; the choice persists to profile (auth) or cookie (guest).
- **footer** — every page, public and app. {colors.muted} fill, {spacing.gutter-desktop} inline padding, 32px block padding. Three columns — Product (Search, Pricing CTA, Wilayas) / Trust (How we verify, About) / Legal (Privacy, Terms, Refund policy) — column heads in {typography.caption}, links in {typography.small} {colors.muted-foreground}, hover {colors.foreground}. Bottom line: "Made by Akram in Algiers" + a repeated instance of the locale-switcher.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use logical properties only — `ms-`/`me-`/`ps-`/`pe-`, `inset-inline`, `border-inline-*`, `text-start`/`text-end` | Use `margin-left/right`, `padding-left/right`, `left:`, `right:`, or `text-align: left/right` anywhere (FR-2) |
| Render all UI numerals as Western Arabic numerals (0-9) in AR, FR, and EN — credits, DZD prices, wilaya codes, pagination, dates (FR-15) | Render Eastern Arabic numerals (٠-٩) anywhere in the UI, including the AR locale |
| Use `tabular-nums` in the credits pill, ledger, payment history, export breakdowns, and numeric table columns | Let credit figures typeset in proportional figures and jitter on update |
| Switch language with native names (العربية / Français / English) + globe icon | Use flag icons for language — languages are not countries |
| Flip `dir` on `<html>` instantly; fade swapped text ≤150ms | Animate layout, slide panels, or show skeletons on locale switch |
| Rebrand by swapping token **values** in this file when the founder brand lands | Introduce new tokens, restyle components, or hardcode hexes to "match the logo" |
| Treat the watermark as **content** — literal localized header/footer rows inside the CSV, shown verbatim in the export preview | Render any watermark as a visual overlay, diagonal stamp, or background treatment in-app |
| Use {colors.muted-strong} for text on {colors.muted} fills (footer links, preview insets) | Use {colors.muted-foreground} on {colors.muted} — it fails AA there |
| Show state with semantic `*-container` / `*-on-container` tonal pairs | Use {colors.primary} for state, or full-bleed semantic solids for surfaces |
| Set Arabic text in {typography.font-arabic.fontFamily} with zero letter-spacing | Force Arabic into the Latin stack, or track/condense Arabic glyphs |
