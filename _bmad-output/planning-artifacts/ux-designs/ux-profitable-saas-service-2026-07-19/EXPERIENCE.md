---
title: EXPERIENCE — Algerian B2B Lead Platform (V1)
status: final
created: 2026-07-19
updated: 2026-07-19
sources:
  - _bmad-output/planning-artifacts/prds/prd-algerian-b2b-lead-platform-2026-07-18/index.md
---

# Algerian B2B Lead Platform — Experience Spine

> Behavioral spine for the V1 trilingual (AR/FR/EN + RTL) Algerian B2B lead-generation platform: credit-metered search/reveal/export, Chargily CIB/EDahabia billing. Distilled from `.memlog.md`. Visual identity lives in `DESIGN.md`; tokens referenced as `{path.to.token}`. shadcn/ui + Tailwind defaults are inherited — this file specifies behavioral deltas only.

## Foundation

Responsive web app — desktop and mobile web, no native app in V1 (PRD non-users). UI system: shadcn/ui + Tailwind; logical-property CSS throughout, no hardcoded `left/right` anywhere (FR-2). `DESIGN.md` is the visual identity reference and owns all visual specs; this spine owns behavior. On conflict between a mock and this spine, the spine wins.

Performance budgets are behavioral constraints, not aspirations (NFR-1):

- **First search results ≤ 2.5s p95 on 4G** → skeletons match final layout exactly (no spinners replacing layout); filter taxonomy and facet labels cached client-side; no query re-run on locale switch.
- **Reveal ≤ 1.5s p95** → reveal is an inline row expansion, never a navigation; optimistic UI with rollback instead of blocking spinners.
- **Low-end device budget** → locale re-flip is an instant `dir` flip + short text fade only; no layout animation, no skeleton interstitials anywhere.

## Information Architecture

| Surface | Route | Reached from | Purpose |
|---|---|---|---|
| Homepage | `/` | Direct, ads, footer logo | Hero (trilingual value prop + Start-free CTA + no-card note) → trust strip (58 wilayas, verified sources, Made in Algiers) → how-it-works 3 steps → pricing card (Starter + 15-credit trial) → founder note teaser |
| About | `/about` | Footer Trust column | Founder narrative (FR-30) |
| How we verify | `/how-we-verify` | Footer Trust column, in-flow trust checks | Data-sourcing disclosure: sources used + sources NOT used (FR-29) |
| Privacy | `/privacy` | Footer Legal column | Loi 18-07, ANPDP, data-subject process (FR-31) |
| Terms | `/terms` | Footer Legal column | Subscription terms, pack non-renewal, no-refund-by-default (FR-31) |
| Refund policy | `/refund-policy` | Footer Legal column | No-refund-by-default stance (FR-26) |
| Wilayas | `/wilayas` | Footer Product column | Canonical 58-wilaya taxonomy table (FR-10) |
| Login | `/login` | Header (guest), expired sessions | Authentication (FR-22) |
| Signup | `/signup` | Start-free CTAs | Email + password only, no card (FR-21) |
| Verify email | `/verify-email` | Post-signup redirect | Hard verification gate (FR-21) |
| Password reset | `/password-reset` | `/login` | Reset via email link (FR-22) |
| Search — People | `/search` | Default post-login landing; People tab is default | People search + reveal (FR-5) |
| Search — Companies | `/search/companies` | Companies tab on `/search` | Company search (FR-6) |
| Company detail | `/companies/:id` | Company result row | Company profile + its People records (FR-6) |
| Credits ledger | `/credits` | Credits pill, user menu | 90-day credit ledger + CSV export (FR-16) |
| Billing | `/billing` | User menu, top-up CTAs, Chargily return | Plan, add-on packs, payment history, danger zone (FR-24–FR-28) |
| Settings | `/settings` | User menu | Profile, locale preference, account deletion (FR-23) |

**Persistent chrome:**

- **Header** (every page): logo (→ `/` guest, → `/search` authed), native-name locale dropdown, credits pill (authed), subscription chip (authed), user menu (authed) / login + Start-free CTA (guest).
- **Filter sidebar** (search surfaces only): inline-start on desktop, bottom-sheet on mobile.
- **Footer** (every page, public + app): 3 columns — Product (Search, Pricing CTA → homepage pricing card, Wilayas) / Trust (How we verify, About) / Legal (Privacy, Terms, Refund policy) — plus bottom line "Made by Akram in Algiers" and a repeated locale switcher.

**Closure check — every FR surface is landed on:**

| FR | Surface | Landed by |
|---|---|---|
| FR-5 | `/search` | UJ-1 steps 6–7; states: loading / empty / truncated / rate-limited |
| FR-6 | `/search/companies`, `/companies/:id` | State row: 0-contacts badge; company detail IA row |
| FR-7 | `/search` | State row: rate-limited (search); Apply-model primitive |
| FR-8 | Filter sidebar | Saved searches list component; UJ-2 step 7 |
| FR-9–FR-13 | filter-sidebar, Wilaya combobox | UJ-1 step 7; Component Patterns |
| FR-14 | Results rows | reveal-button; Credit Metering section; UJ-1 step 8 |
| FR-15 | Header credits pill | State rows: low-credit, 0-credit |
| FR-16 | `/credits` | Credit Metering section; state row: ledger window |
| FR-17–FR-20 | Export modal | Export Gating section; UJ-1 climax; state row: export limit |
| FR-21 | `/signup`, `/verify-email` | UJ-1 steps 3–5; state row: unverified |
| FR-22 | `/login`, `/password-reset` | IA rows; deletion-grace state row (login) |
| FR-23 | `/settings` | Account deletion flow; state row: deletion-grace |
| FR-24 | Upgrade dialog → Chargily | Billing Reconciliation section; UJ-2 |
| FR-25 | `/billing` pack cards | UJ-2 steps 2–3 |
| FR-26 | `/billing` danger zone, `/refund-policy` | Destructive-confirm primitive; Trust Surfaces |
| FR-27 | `/billing` status card | UJ-2 edge path; state row: webhook-pending |
| FR-28 | Header chip + failed-renewal banner | State row: payment-failed |
| FR-29 | `/how-we-verify` | UJ-1 step 9; Trust Surfaces |
| FR-30 | `/about` | UJ-1 step 9; Trust Surfaces |
| FR-31 | `/privacy`, `/terms` | Trust Surfaces |

(FR-1–FR-4 are chrome-level; see Trilingual & RTL Interaction Model.)

→ Composition reference (Finalize key-screen mocks): `mockups/locale-reflip.html`, `mockups/reveal-zero-credit.html`, `mockups/export-modal.html`, `mockups/chargily-return.html`. Spine wins on conflict.

## Voice and Tone

Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`. What follows is the load-bearing microcopy — the strings that carry money, trust, or metering consequences.

**All translations below are working drafts pending native-speaker review (PRD Open Q4).** Western Arabic numerals are used in every locale, including AR (FR-15).

| String | العربية (AR) | Français (FR) | English (EN) |
|---|---|---|---|
| Start-free CTA | ابدأ مجاناً | Commencer gratuitement | Start free |
| 15-credits banner | تبقّى 15 رصيدًا | 15 crédits restants | 15 credits left |
| 0-credits banner | 0 رصيد متبقٍ | 0 crédit restant | 0 credits left |
| Top-up CTA (on 0-credits banner) | إعادة الشحن | Recharger | Top up |
| Reveal button | إظهار | Révéler | Reveal |
| Already-revealed badge | تم الإظهار مسبقًا | Déjà révélé | Already revealed |
| Upgrade dialog title | الترقية إلى Starter | Passer à Starter | Upgrade to Starter |
| Watermark preview notice | هكذا سيبدو ملف CSV تمامًا — بما في ذلك العلامة المائية | Voici exactement à quoi ressemblera votre CSV — filigrane inclus | This is exactly what your CSV will look like — watermark included |
| Come-back-tomorrow (daily search limit) | بلغت الحد اليومي للبحث — حسِّن عوامل التصفية أو عُد غدًا | Limite quotidienne de recherches atteinte — affinez vos filtres ou revenez demain | Daily search limit reached — refine your filters or come back tomorrow |
| Come-back-tomorrow (export limit) | بلغت حد التصدير (5,000 صف خلال 24 ساعة) — عُد غدًا | Limite d'export atteinte (5 000 lignes par 24 h) — revenez demain | Export limit reached (5,000 rows per 24 h) — come back tomorrow |
| Refine-your-filters truncation prompt | أكثر من 1,000 نتيجة — حسِّن عوامل التصفية لتضييق القائمة | Plus de 1 000 résultats — affinez vos filtres pour réduire la liste | More than 1,000 results — refine your filters to narrow the list |
| Persistent banner (failed renewal) | فشل الدفع — حدِّث وسيلة الدفع للاحتفاظ بـ Starter | Paiement échoué — mettez à jour votre moyen de paiement pour garder Starter | Payment failed — update your payment method to keep Starter |
| Payment-confirming status | جارٍ تأكيد الدفع… | Confirmation du paiement… | Confirming payment… |
| Credits-posted toast | أُضيف {n} رصيدًا — أرصدة الحزم لا تنتهي صلاحيتها أبدًا | {n} crédits ajoutés — les crédits de pack n'expirent jamais | {n} credits added — pack credits never expire |
| Verify-email screen title | تحقق من بريدك الإلكتروني | Vérifiez votre e-mail | Verify your email |
| Delete-account confirmation | حذف حسابك؟ يبقى مجمَّدًا وقابلاً للاسترجاع لمدة 7 أيام — ثم يُحذف نهائيًا | Supprimer votre compte ? Il reste gelé et récupérable pendant 7 jours — ensuite, il disparaît définitivement | Delete your account? It stays frozen and recoverable for 7 days — then it's gone for good |
| Validation — required field | هذا الحقل مطلوب | Ce champ est requis | This field is required |
| Validation — invalid email | أدخل بريدًا إلكترونيًا صالحًا | Saisissez une adresse e-mail valide | Enter a valid email address |
| Validation — password too short | كلمة المرور: 8 أحرف على الأقل | Mot de passe : 8 caractères minimum | Password: 8 characters minimum |
| Locale-switched announcement (visually hidden) | لغة الواجهة: العربية | Langue de l'interface : Français | Interface language: English |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components` (or in shadcn defaults, when inherited). Component names use `DESIGN.md` kebab-case where a `DESIGN.md.Components` entry exists; composite or fully shadcn-inherited patterns (App header, Upgrade dialog, Saved searches list, Billing sections, Verify-email gate, Account deletion flow) are named in plain language.

| Component | Surfaces | Behavioral rules |
|---|---|---|
| App header | Every page | Logo → `/` (guest) / `/search` (authed). Hosts Locale switcher always; Credits pill + Subscription chip + user menu when authed; login + Start-free CTA when guest. Sticky. Logical-property layout only. |
| Footer | Every page | 3 columns (Product / Trust / Legal) + "Made by Akram in Algiers" bottom line + repeated Locale switcher. Body copy at `{typography.body.fontSize}` minimum. |
| Locale switcher | Header + footer, every page | Native-name dropdown (العربية / Français / English) with globe icon, shadcn Select. Persists to profile (authed) / cookie (guest) (FR-1). On select: preserves full in-flight state — filters, keyword, page/cursor, expanded reveal rows, scroll anchor, saved-search selection; fetches localized strings + facet labels only; never re-runs the query (protects FR-7 daily limits). Instant `dir` flip + logical-property reflow; short opacity fade on text swap only; no layout animation, no skeleton interstitial. Fully keyboard operable. **Focus contract:** focus is captured pre-flip and restored to the same logical control post-flip (by stable id, not DOM node); if the node was re-created, focus moves to the locale-switcher trigger; a visually-hidden `aria-live="polite"` status announces the new interface language in that language ("Interface language: Français"). |
| Credits pill | App header (authed) | Live balance, `{rounded.full}` pill. Decrements in place on reveal/export — no page reload; changes announced via `aria-live="polite"`. At ≤10 credits (paid users): shifts to `{colors.warning}` + tooltip. At 0: `{colors.danger}` zero state. Western Arabic numerals in all locales (FR-15). Click → `/credits`. |
| Subscription chip | App header (authed) | Starter: "Starter — renews on {date}" per FR-28. Free: "Free — upgrade" chip in `{colors.primary}` that opens the Upgrade dialog. |
| filter-sidebar | `/search`, `/search/companies` | Desktop: persistent inline-start sidebar (renders right in RTL). Mobile: bottom-sheet drawer triggered by a Filters(n) badge counting staged + active filters. Groups: industry, wilaya, seniority (People only), size (Company only), keyword. Staged edits; explicit Apply = 1 query = 1 search counted (FR-7). Multi-select groups offer select-all / clear. Keyword input is diacritic-insensitive (FR-13) and ANDs with structured filters. Include-unknown-size toggle exists, off by default (FR-12). |
| filter-chip | Above results | One removable chip per active filter value, gap `{spacing.4}`; removing a chip stages the removal — the query re-runs only on the next Apply (never silently burns the daily cap). Remove affordance keyboard-reachable. |
| Wilaya combobox | filter-sidebar | Searchable; matches code ("31"), AR, FR, or EN name; transliterated Arabic fallback per FR-10 — never a blank. Multi-select with chips. Display: code + localized name, e.g. "Oran (31)". Exactly the official 58 wilayas, codes 1–58 (FR-10). Keyboard model: Enter/Space toggles an option; selected chips inside the trigger are reachable in tab order with per-chip remove (Backspace/Delete also removes the last chip); the internal search input is labeled (`aria-label` minimum, never placeholder-only); Esc closes the popover and returns focus to the trigger. |
| Results table | `/search`, `/search/companies` | Sortable — active sort column carries `aria-sort` and sort changes are announced via the polite live region. People columns: name / role / company / wilaya + reveal action. Company columns: name / industry / wilaya / size / People-count. Pagination 100/page (no infinite scroll); >1,000 results truncated with notice + refine-your-filters prompt (FR-5). Column visual order flips in RTL; underlying column order stable for CSV (FR-2). Mobile: collapses to stacked rows. Company name renders as a real link → `/companies/:id` (keyboard-focusable; the row itself is not a click target). |
| reveal-button | Results rows (People; People under Company detail) | `aria-expanded` + `aria-controls` wired to the expanded contact region (labeled). Inline row expansion showing phone, email, address, source link; Credits pill decrements live; row stays expanded. Atomic deduction with rollback + toast on failure (FR-14). At 0 credits: `aria-disabled` button (stays focusable) + explanatory tooltip; click/Enter opens the recovery dialog — top-up packs for Starter users, Upgrade dialog for free users. Already-revealed ≤30d: fields auto-visible + subtle badge (`{rounded.md}`); re-reveal free and idempotent — no re-click. V1 scope: single-row only; no multi-select reveal, no reveal-all-on-page (bulk path is the Export modal). |
| Export modal | `/search` results toolbar | Always shown pre-export. Scope: full current result set (up to caps). Shows row count, credit cost breakdown (n revealed + m unrevealed = total credits), balance-after, confirm. "Include rows I have not revealed yet" checkbox checked by default with per-line cost (FR-17). Free tier: capped at 5 rows, first-by-current-sort, modal states this and previews which rows; literal watermark mini-preview (localized watermark header row, sample data rows, watermark footer row); xlsx button visibly disabled + localized upgrade tooltip (FR-19). At 5,000 rows/24h: come-back-tomorrow state replaces confirm (FR-20). |
| Upgrade dialog | Opened from every upgrade CTA | Single in-app dialog for all entry points (header chip, 0-credit recovery dialog, watermark modal, xlsx tooltip, daily-limit state). Content: Starter 1,500 DZD/mo, 200 credits + inclusions; CTA → Chargily checkout. No public pricing page dependency. |
| checklist-card | `/search` | Step completions announced via the polite live region, not visual-only. Dismissible 3-step card — Run first search / Reveal a contact / Export a CSV — with live check-off; vanishes when complete or dismissed. Appears after the 15-credit banner. |
| Saved searches list | Filter sidebar | Free-text name; one-click re-run (a re-run is a query and counts toward the FR-7 daily limit). Caps: 5 free / 25 Starter [ASSUMPTION per PRD Open Q2]. Persists across sessions and locale switches (FR-8). |
| Pack cards | `/billing` | Two cards side by side: 500 DZD / 75 credits (6.7 DZD/credit) and 1,500 DZD / 250 credits (6.0 DZD/credit); never-expires note on both; Best-value badge in `{colors.success}` on the 1,500 DZD card. Free users can buy packs too (FR-25). |
| Billing sections | `/billing` | Four stacked sections: current plan card (tier, renewal date, credits left); Pack cards; payment history (Chargily receipts); danger zone (cancel subscription → access-until-{date} confirmation, FR-26). |
| status-card | `/billing` (inline, on return from checkout) | Carries `role="status"` so polling→success/timeout flips are announced even before the toast. Polls up to 60s in "Confirming payment…" state → success flips the card to credits-posted (`{colors.success}`) + toast; timeout shows payment-received-credits-post-soon note. Non-blocking; webhook reconciliation is idempotent (FR-27). |
| banner (persistent variant) | All authenticated surfaces | Persistent, compact, non-dismissible, `{colors.danger}`; "update payment method" link → Chargily; notes prior-cycle credits remain usable until the next cycle would have begun (FR-28). Clears only on resolution. |
| Verify-email gate | `/verify-email` | Hard gate: no app access pre-verification. Resend link + 24h expiry notice (FR-21). On verification, 15 credits post with ledger type free_signup. |
| confirm-banner | First visit, any page | One-time locale-inference banner in the inferred locale: "We guessed your language — switch?" + switch button + dismiss. Shows once; the choice persists to profile (auth) / cookie (guest). Keyboard operable; dismissal stored so it never nags. |
| Account deletion flow | `/settings` | Multi-step destructive confirmation. States the 7-day grace: account frozen + recoverable; irreversible after; unrevealed-credit balance removed; anonymised ledger retained 90 days (FR-23). |

## State Patterns

| State | Surface(s) | Trigger | Treatment |
|---|---|---|---|
| Cold load | `/search` | First authenticated paint | Skeleton rows matching the results-table layout; filter panel renders immediately from cached taxonomy. Budget: first results ≤ 2.5s p95 on 4G (NFR-1). |
| Loading (query) | `/search`, `/search/companies` | Apply pressed / chip removed / saved search re-run | Results area skeletons; Apply shows busy state; chips and filters stay editable. |
| Empty results | `/search`, `/search/companies` | 0 matches | Suggest broadening wilaya or industry + one-click clear-all-filters (FR-5). Never a blank page. |
| Empty saved searches | Filter sidebar | None saved | One-line hint pointing at the save affordance on the active search. |
| Error (query failed) | `/search` | Network / server failure | Toast + inline retry; staged filters and chips preserved; the failed query does not consume the daily count [ASSUMPTION — confirm with PM]. |
| Truncated results | `/search` | >1,000 matches | Notice + refine-your-filters prompt; first 1,000 navigable at 100/page (FR-5). |
| Rate-limited (search) | `/search` | 30/day free, 100/day Starter | Query refused with the refine-or-come-back-tomorrow message (FR-7); Apply is `aria-disabled` (focusable) with the rate-limit message rendered inline adjacent to it and referenced via `aria-describedby`, until 00:00 Africa/Algiers; filters remain staged for tomorrow. |
| Rate-limited (export) | Export modal | 5,000 rows / 24h | Come-back-tomorrow state replaces the confirm button; resets 00:00 Africa/Algiers (FR-20). |
| Low-credit | Credits pill | ≤10 credits, paid users | Pill shifts to `{colors.warning}` + tooltip; no banner (FR-15). |
| 0-credit | `/search` + Credits pill | Balance hits 0 | Full banner with Top-up CTA (FR-15); reveal-buttons go `aria-disabled` → recovery dialog; pill shows `{colors.danger}` zero state. |
| Already-revealed | Results rows | Record revealed ≤30d ago | Contact fields auto-visible + Already-revealed badge; re-reveal free (FR-14). |
| 0-contacts company | `/search/companies`, `/companies/:id` | Company with no known People | "0 contacts known" badge — shown, never hidden (FR-6). |
| Ledger window empty | `/credits` | No activity in last 90 days | Empty note + link to `/search`; CSV export still offered (headers only). |
| Webhook-pending | `/billing` | Return from Chargily checkout | Status card polls ≤60s; on timeout, payment-received-credits-post-soon note; non-blocking (FR-27). |
| Payment-failed (renewal) | All authenticated surfaces | Declined renewal | Persistent non-dismissible banner (persistent variant); prior-cycle credits usable until next cycle would have begun (FR-28). |
| Unverified | `/verify-email` | Post-signup, link unopened | Hard gate — no app access; resend link + 24h expiry notice; credits post on verification (FR-21). |
| Deletion-grace | `/settings`, `/login` | Within 7 days of delete request | Login lands on a frozen-account screen with a recover action; after 7 days, deletion is irreversible (FR-23). |

## Interaction Primitives

- **Apply-not-instant filtering.** Filter edits are staged locally; only the explicit Apply button fires the query, and one Apply = one search counted against the daily limit (FR-7). Instant-apply would burn the 30/day free cap invisibly — banned.
- **Disabled-but-actionable.** Metering-blocked actions (reveal at 0 credits, xlsx for free users) use `aria-disabled`, not `disabled`: they stay focusable, carry an explanatory tooltip, and activate a recovery path (dialog or upgrade) instead of dead-ending.
- **Live-balance updates without reload.** Every credit mutation (reveal, export, pack purchase, verification grant) updates the Credits pill and any visible balance-after in place; announced via `aria-live="polite"`.
- **Destructive-action confirmation.** Account deletion and subscription cancellation go through an explicit multi-step confirmation stating the consequence (7-day grace / access-until-{date}) before the point of no return.
- **Optimistic UI with rollback.** Reveal expands inline and decrements immediately; on failure the balance rolls back and a toast explains — atomic deduction guarantees no half-state (FR-14).
- **Polling with timeout.** Payment confirmation polls for at most 60s, then degrades to a non-blocking "posts soon" note; idempotent webhooks reconcile out-of-band (FR-27). No manual "I've paid" retry button.

**Banned everywhere:** instant-apply filtering; infinite scroll (pagination only); multi-row or reveal-all reveal in V1; layout animation or skeleton interstitials on locale switch; modal stacks deeper than one level; silent fall-through for untranslated strings.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md` (shadcn AA-compliant defaults inherited; brand overrides must hold ratios).

- **Public pages** (homepage, /about, /how-we-verify, /privacy, /terms, /refund-policy, /wilayas, auth pages): **WCAG 2.1 AA** (NFR-6) — they carry the trust and SEO burden.
- **Authenticated app**: WCAG 2.1 A floor, with **AA on every form and interactive surface** (filters, reveal, export modal, billing).
- **RTL traps (FR-2):** focus order follows visual order in both directions; icons that carry direction meaning (back arrows, chevrons-in-flow) DO mirror in RTL, icons that don't (globe, download) never mirror; numbers, phone numbers, and codes stay LTR inside RTL text with bidi isolation (`<bdi>` / `unicode-bidi: isolate`).
- **aria-disabled pattern** keeps blocked actions focusable; their tooltips are keyboard-reachable (focus triggers the same explanation hover does).
- **Locale switcher** is fully keyboard operable (open, arrow, Enter, Esc) in both header and footer instances.
- **`aria-live="polite"`** announces credit-balance changes and all toast notifications; toasts never announce assertively unless a payment failed.
- **Arabic screen readers:** Arabic content carries `lang="ar" dir="rtl"` at the root when AR is active; mixed-locale fragments (e.g., FR string inside AR UI under fall-through) carry their own `lang`.
- **Touch targets ≥ 44px** on mobile, including chip remove buttons, combobox options, and the bottom-sheet handle.
- **Reduced motion:** under `prefers-reduced-motion`, the locale-switch text fade is disabled (instant swap), color transitions (credits pill states) are instant, and spinners are replaced by a static busy indicator + text.
- **Forms (AA — all auth + billing surfaces):** every field has a visible label (never placeholder-as-label); `autocomplete` tokens set (`email`, `current-password`, `new-password`); validation errors render inline per field with `aria-invalid` + `aria-describedby`, plus an error summary on submit; errors render in the active locale and `dir`; password requirements are stated adjacent to the field before submit. Localized validation strings live in the Voice and Tone table.
- **Touch tooltips:** on touch devices, first tap on a tooltip-bearing control (aria-disabled reveal-button, disabled xlsx button, warning credits pill) shows the tooltip; second tap activates the control's path (recovery dialog / upgrade / `/credits`).
- **Touch targets:** named component heights in `DESIGN.md` are desktop (`≥ md`) values; on `< md` all interactive targets inflate to ≥ 44px via padding while visual height is preserved.
- **Dialogs:** all dialogs trap focus, set initial focus to the first focusable element (destructive flows: to the safe control), and return focus to the invoking control on close — including `aria-disabled` invokers, which therefore remain in the DOM.
- **Bypass blocks:** a skip-to-content link (first focusable, visible on focus) on every page; search surfaces add skip-to-results.
- **Per-fragment language:** any Arabic-script fragment carries `lang="ar" dir="rtl"` on its own element regardless of source — string fall-through OR data (wilaya combobox options, results-table wilaya cells, the /wilayas table, CSV-preview rows, Arabic proper nouns in FR/EN UI).
- **Bottom sheet:** dismisses via visible close button, scrim tap, swipe-down, and Esc (hybrid devices); focus returns to the Filters(n) trigger on close.
- **Public content pages:** valid heading hierarchy per page (single h1, ordered h2/h3) — they carry the SEO + AA burden.

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| `≥ md` (desktop / tablet landscape) | filter-sidebar = persistent inline-start sidebar; Results table = full sortable table; Export modal = centered dialog. |
| `< md` (mobile web) | filter-sidebar = bottom-sheet drawer with Filters(n) badge; Results table = stacked rows with the same field set and reveal-button; touch targets ≥ 44px. |

[ASSUMPTION: breakpoint values inherit Tailwind defaults (`md` = 768px); memlog specifies behavior, not pixel values.]

Mobile web is a first-class V1 surface (research and payment flows included), but no native app ships in V1 (PRD non-users). Browser matrix: latest 2 versions of Chrome, Firefox, Safari, Edge (NFR-5). No Internet Explorer support — `dir`-aware logical properties are assumed.

## Trilingual & RTL Interaction Model

The locale system is a lifecycle, not a dropdown:

1. **Infer.** First visit reads `Accept-Language` and renders the best guess (AR → RTL immediately, not after a flash of LTR).
2. **Confirm.** A one-time dismissible banner names the inferred language and offers the other two — inference is never silent or irreversible-feeling.
3. **Persist.** Authenticated users: written to profile. Guests: cookie. Returning users get their last choice back (FR-1).
4. **Switch.** See Locale switcher: full in-flight state preservation, instant `dir` flip, text-only fade, zero query re-runs.

**Fall-through rules (FR-1):** in production, an untranslated string falls through to FR for AR/FR users and to EN for the EN default — never to a raw key. In dev/staging, untranslated strings are visibly flagged so gaps are caught before launch.

**Beyond chrome (FR-3):** system emails (signup confirm, payment receipt, credit-pack receipt, low-credit warning) render in the recipient's active locale, RTL-aware where the client supports it; CSV/xlsx column headers localize to the export-session locale. Data values are never translated; wilaya display follows FR-10's localized-name rule with transliterated-Arabic fallback.

**Numerals:** Western Arabic numerals (0–9) in every locale including AR (FR-15) — credits, prices, dates, codes.

## Credit Metering & Reveal States

Reveal state machine (per row):

```
idle ──click──▶ confirming ──success──▶ revealed (fields visible, pill decremented, row stays expanded)
                    │
                    └──failure──▶ rollback (balance restored, row collapses back, toast explains)
```

- Deduction is atomic server-side; the UI is optimistic and reconciles on response (FR-14). Reveal budget: ≤ 1.5s p95 (NFR-1).
- **Already-revealed ≤30d** short-circuits the machine: fields render auto-visible with the badge; re-reveal is free and idempotent (FR-14).
- **0-credit recovery paths diverge by user type:** free users → Upgrade dialog; Starter users → top-up path (Pack cards / `/billing`). Free users may also buy packs directly (FR-25).
- **Drawdown order:** subscription credits are consumed before pack credits [ASSUMPTION per FR-25 note — confirm with PM].
- **Balance surfaces are always consistent:** header Credits pill (live), Export modal balance-after (preview), `/credits` ledger (record).

**Ledger surface (`/credits`, FR-16):** last 90 days of activity; each row = type, amount, timestamp, balance-after, reference (order id, reveal id). Types: free_signup grant, renewal grant, add-on pack grant, promotional grant, reveal debit, export-row debit, expiry. Exportable as CSV from the page.

## Export Gating & Watermark

| Capability | Free | Starter |
|---|---|---|
| Row scope | First 5 rows of current result set, current sort order | Full current result set (up to caps) |
| Cost | 1 credit per row (a 5-row CSV = 5 credits) | 1 credit per row, revealed and unrevealed alike (FR-17) |
| Unrevealed rows | Same opt-in checkbox, checked by default, per-line cost | Same |
| Watermark | Localized header row + footer row, literal mini-preview in modal | None |
| `.xlsx` | Visibly disabled + localized upgrade tooltip (FR-19) | Enabled; phones preserved as text, explicit column types (FR-18) |
| 24h ceiling | 5,000 rows → come-back-tomorrow (FR-20) | 5,000 rows → come-back-tomorrow (FR-20) |

The watermark is a **conversion surface**, not a punishment: the modal shows the literal CSV mini-preview (watermark header, sample rows, watermark footer) so the user sees exactly what upgrade removes before paying. All upgrade entry points converge on the single Upgrade dialog. Column headers localize per FR-3; the watermark string itself localizes per FR-19.

## Billing & Payment Reconciliation UX

- **Rail:** Chargily checkout only — CIB and EDahabia, no foreign-card fallback in V1 (FR-24). All paywall CTAs route into it.
- **Return flow:** checkout returns to `/billing`, where the status-card polls ≤60s → success (card flips to credits-posted + toast) or timeout (payment-received-credits-post-soon note). The user is never asked to retry or re-pay; reconciliation is idempotent on webhook event id, and a missed grant is corrected out-of-band (FR-27).
- **Failed renewal lifecycle (FR-28):** decline → persistent non-dismissible banner on every app surface with a Chargily update-payment link; prior-cycle credits remain usable until the next cycle would have begun; banner clears only on resolution; no new grant until payment succeeds.
- **Cancellation (FR-26):** self-serve from the danger zone with an access-until-{date} confirmation; no refund of the current cycle; `/refund-policy` documents the no-refund-by-default stance (documented payment errors handled by ops manually).
- **Non-rollover:** monthly grants are 200 fresh credits; unused subscription credits do not roll over (FR-24). Pack credits never expire (FR-25). Both facts are stated on the surfaces where the purchase happens, not buried in /terms.

## Trust Surfaces

Public, localized, crawlable semantic HTML, no auth — these carry the credibility argument against incumbents:

- **`/how-we-verify` (FR-29):** Sources-we-use cards (Google Places API, El Mouchir public pages, Pages Jaunes Algérie — with the rate-limit note) followed by a Sources-we-do-NOT-use block (CNRC, LinkedIn) with a one-line rationale each. Saying what we refuse to scrape is the trust move.
- **`/about` (FR-30):** founder narrative "Made by Akram in Algiers" in the founder's voice, translated — not machine-translated — for AR and FR. Headshot and contact email are deferred pre-launch [Open Q10]; `DESIGN.md` holds the token slots. Alt-text rule survives the deferral: the supplied headshot gets informative alt ("Akram, founder"); the interim placeholder block is decorative (`alt=""`, aria-hidden).
- **`/privacy` (FR-31, FR-23):** references Loi 18-07 du 10 juin 2018 and the ANPDP (declaration reference when filed — [Open Q8: filing status unconfirmed; /privacy wording must not claim a filing that has not happened]), documents the takedown / data-subject request process, and commits to a 30-day response window.
- **`/terms` (FR-31):** subscription terms, add-on pack non-renewal, no-refund-by-default.
- **`/refund-policy` (FR-26):** the no-refund-by-default stance with the payment-error exception path.
- **`/wilayas` (FR-10):** the canonical taxonomy — all 58 wilayas in code order with AR / FR / EN names, plus a small client-side filter input (visibly labeled, not placeholder-only). Table semantics are mandatory on this AA page: `<caption>` ("The 58 wilayas of Algeria — codes 1–58 with Arabic, French, and English names"), `th scope="col"` per language column, `th scope="row"` on the code cell, and per-cell `lang` attributes on Arabic/French/English name cells. Publishing the full 58 (against incumbents' 48/69) is a deliberate credibility differentiator.
- **Homepage trust strip:** 58 wilayas, verified sources, Made in Algiers — the same three claims, one glance.

## Key Flows

### Flow 1 — UJ-1. Yasmine evaluates the free trial before paying (Yasmine, solo advertising freelancer in Oran, AR-first, burnt once by an auto-renew SaaS)

1. Yasmine lands on `/` from a Facebook ad; `Accept-Language: ar` renders the RTL homepage immediately, with the one-time confirm banner offering Français and English. She stays in Arabic.
2. She taps **ابدأ مجاناً** (Start free) → `/signup`: email + password only. No card is asked for — the no-card note next to the CTA said so, and the form proves it.
3. She verifies her email from the Verify-email gate (hard gate; resend available; 24h expiry notice). On verification, 15 credits post to her account (ledger type free_signup).
4. She lands on `/search` (People tab) under the 15-credit banner — "تبقّى 15 رصيدًا" — with the 3-step checklist-card below it. First step checks off live: her search is next.
5. She stages filters in the sidebar — industry=Advertising, wilaya=Oran (31) via the combobox, seniority=Owner/CEO — and hits Apply once. One search counted; results render within budget; chips appear above the table.
6. She reveals one record inline: phone, email, address, source link expand in the row; the Credits pill ticks 15 → 14 without a reload. Checklist step two checks off.
7. Trust check: she opens `/how-we-verify` (sources used, sources NOT used — CNRC and LinkedIn excluded with reasons) and `/about` (Akram's narrative, in Arabic). Both reachable from the footer, both in AR.
8. **Climax:** back on `/search`, she opens the Export modal: scope 5 rows (free cap, first-by-sort), cost breakdown 0 revealed + 5 unrevealed = 5 credits, balance-after 9 — and a literal mini-preview of the CSV showing the watermark header row, her five rows, the watermark footer row. She confirms; the pill drops to 9. She opens the CSV in Excel: the data is real, the wilaya reads "Oran (31)", matching the official code. Checklist complete; the card vanishes.
9. **Failure/edge path:** the watermark is right there in her spreadsheet, header and footer. Annoying — but honest, and she knew before downloading. The modal's xlsx button is disabled with its upgrade tooltip; both point to the single Upgrade dialog. She has her signal: when the 9 remaining credits run low, she upgrades.

### Flow 2 — UJ-2. Karim, paid user, runs out of mid-month credits and tops up (Karim, agency founder in Constantine, Starter tier, day 12 of his cycle, FR/AR user)

1. Karim opens `/search` and hits the 0-credit state: full banner "0 crédit restant" with the **Recharger** CTA; every reveal-button is aria-disabled with its tooltip.
2. He taps Recharger → `/billing`. The two Pack cards sit side by side: 500 DZD / 75 credits (6.7 DZD/credit) and 1,500 DZD / 250 credits (6.0 DZD/credit, Best-value badge, never-expires note).
3. He picks 500 DZD / 75 → Chargily checkout → pays with his CIB card.
4. Return to `/billing`: the status-card appears inline, polling — "Confirmation du paiement…".
5. **Climax:** within the 60s window the card flips to credits-posted and a toast lands: "75 crédits ajoutés — les crédits de pack n'expirent jamais." The Credits pill reads 75.
6. He re-runs the saved query he had pending from the Saved searches list (one click; one search counted) and reveals the 12 records he needs — 12 credits deducted inline, pill ticking down live with each expansion: 75 → 63.
7. **Failure/edge path:** the webhook is delayed — the card keeps polling, hits 60s, and degrades to the payment-received-credits-post-soon note instead of an error. The credits post moments later via idempotent reconciliation, announced by the same toast. He never re-pays, never retries, never contacts support.

### Flow 3 — UJ-3. Lila, francophone bio, switches the UI to French mid-session (Lila, biology PhD consulting for pharma distributors, prefers French; authenticated, mid-session)

1. A colleague shares a link; Lila opens it and the app renders in Arabic, RTL — the shared session's locale, not hers.
2. She opens the Locale switcher in the header — native names, no flags: العربية / Français / English — and picks **Français**.
3. The layout re-flips RTL → LTR instantly: `dir` attribute flip, logical-property reflow, a short opacity fade on the text only. No reload, no skeleton, no lost work — her saved query selection, staged filters, page position, expanded reveal rows, and scroll anchor are all exactly where she left them. Only the strings and facet labels re-fetch.
4. She runs her search (one Apply) and opens the Export modal.
5. **Climax:** she exports the CSV and the column headers come through in French — localized at export time from her active locale, without re-running the query. The wilaya values resolve to their French names.
6. **Failure/edge path:** one wilaya in her result set has no French name cached — the cell falls back to the transliterated Arabic name instead of a blank or a raw key (FR-10). The CSV is usable end to end; nothing ships broken.
