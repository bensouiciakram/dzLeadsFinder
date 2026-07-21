---
title: Algerian B2B Lead Generation Platform — V1
created: 2026-07-18
updated: 2026-07-18
status: draft
---

# PRD: Algerian B2B Lead Generation Platform — V1

*Working title — confirm. Internal codename: "DZLeads V1". This PRD scopes the V1 build only. V1.5/V2/V3 upsell intentions are referenced in §6.2 but not specified.*

## 0. Document Purpose

This PRD is for: the PM (Bensouici Akram), the downstream architecture and UX workflow owners, and the implementing developer. It builds directly on Mary's completed market research (`_bmad-output/planning-artifacts/research/market-algerian-b2b-lead-generation-platform-research-2026-07-16/`) — in particular `1-strategic-synthesis-and-recommendations.md` (the V1 brief), `2-revenue-model-options-and-recommendation.md` (the revenue model), and `4-data-sourcing-legality-brief.md` (the data-source constraints baked into §5 Non-Goals and §10 Constraints). It does not duplicate that research; it specifies the V1 build.

The PRD uses Glossary-anchored vocabulary (§3), features grouped with globally numbered FRs (§4), inline `[ASSUMPTION: ...]` tags where the drafter inferred, and `[NOTE FOR PM]` callouts where a deferred item is emotionally load-bearing. Scope is **locked to V1** by user direction — non-goals in §5 are not negotiable for this build.

## 1. Vision

**Trilingual Algerian lead database — every official wilaya, verified contacts, easy export — from 1,500 DZD/mo.**

The Algerian B2B lead-generation market is a verified greenfield. Two under-built local incumbents (DzLeads.io, Linkiw.app) and one inaccessible global benchmark (Apollo.io) leave three independently-verified unmet needs: (1) a price wedge below DzLeads' 2,000 DZD/mo floor, (2) an Arabic UI — Algeria's official language, absent from both incumbents' primary navigation, and (3) data accuracy — both incumbents publish wrong wilaya counts (48 and 69) when Algeria officially has 58 since the 2021 reform.

V1 captures that wedge. It is a trilingual (Arabic/French/English, RTL-aware) web application that lets Algerian sellers find verified B2B contacts by industry, wilaya, seniority, company size, and keyword; view People and Company records across the official 58-wilaya taxonomy; and export results to CSV/Excel. It is priced to undercut DzLeads at 1,500 DZD/mo for 200 credits, with a 15-credit free trial requiring no card, and one-time add-on credit packs for top-ups. Payments flow exclusively through Chargily (CIB/EDahabia).

Why it matters: it gives Algerian SMBs a credible, affordable, locally-grounded alternative to incumbents who either overprice or under-serve the local market — and it crowns a founder-led product ("Made by Akram in Algiers") against competitors who obscure their founders. V1 establishes the wedge; V1.5/V2/V3 grow the ladder.

## 2. Target User

### 2.1 Jobs To Be Done

- **Find buyers fast:** "As a solo SMB seller in Algiers, I want to pull a list of verified decision-makers in my industry and wilaya so I can stop scrolling Pages Jaunes and start selling."
- **Trust the data:** "As an agency founder, I want the wilaya list to match the official 58 so I trust the rest of the dataset."
- **Pay the way I pay:** "As an Algerian buyer, I want to pay with my CIB card or EDahabia in dinars, not a foreign card via Stripe, because that's what I have."
- **Use my language:** "As an Arabic-speaking seller, I want to navigate the whole app in Arabic with correct RTL layout, not a French-only interface that assumes I'm francophone."
- **Try before I commit:** "As a cautious buyer burnt by auto-renew subscriptions, I want 15 free credits with no card on file before I decide."
- **Buy more without upgrading:** "As a heavy user mid-month, I want to buy a one-time credit pack instead of being forced onto a higher tier."

### 2.2 Non-Users (V1)

- Exporters needing cross-border / international contact data (V3 territory)
- Technical buyers wanting an API (under 10% of V1 TAM)
- Agencies wanting shared team workspaces (V2 territory)
- Mobile-first users requiring a native app (web app is the V1 surface)
- Buyers wanting outreach automation, sequences, or CRM (V2 territory)

### 2.3 Key User Journeys

- **UJ-1. Yasmine evaluates the free trial before paying.**
  - **Persona + context:** Yasmine, a solo advertising freelancer in Oran, burnt once by an auto-renew SaaS, sceptical of French-only tools.
  - **Entry state:** Unauthenticated, lands on homepage from a Facebook ad, AR locale inferred from browser `Accept-Language`.
  - **Path:** (1) Sees AR/RTL homepage with the trilingual switcher visible; (2) clicks "ابدأ مجاناً" / "Commencer gratuitement" / "Start free"; (3) signs up with email + password — no card asked; (4) lands on People search with a banner "15 credits restants"; (5) runs her first search: industry=Advertising, wilaya=Oran, seniority=Owner/CEO; (6) views one People record, a credit is deducted; (7) opens /how-we-verify to check the data sourcing; (8) opens /about, sees the founder narrative.
  - **Climax:** She exports a 5-row CSV (5 credits) and opens it in Excel — the data is there, wilaya is "Oran (31)" matching the official code.
  - **Resolution:** She has enough signal to upgrade when her 15 credits run out. **Edge case:** if her free-trial CSV rows are watermarked (per §4.5 FR-19), she sees the watermark and realises the upgrade unlocks clean export.

- **UJ-2. Karim, paid user, runs out of mid-month credits and tops up.**
  - **Persona + context:** Karim, agency founder in Constantine, on the Starter tier (200 credits/mo). 12 days in, credits exhausted.
  - **Entry state:** Authenticated, on the Starter plan, sees "0 crédits restants" banner on a search results page.
  - **Path:** (1) Banner offers "Recharger" / "إعادة الشحن" / "Top up"; (2) Karim opens the billing page, sees the two add-on packs (500 DZD/75, 1500 DZD/250); (3) picks 500 DZD/75; (4) Chargily checkout with CIB; (5) on success, banner shows 75 credits, never-expiry note displayed.
  - **Climax:** He runs the saved query he had pending; 12 credits deducted; results fill the page.
  - **Resolution:** He keeps working without forcing a tier upgrade. **Edge case:** if Chargily webhook is delayed, the page polls and the credits post within 60s with an explanatory toast.

- **UJ-3. Lila, francophone bio, switches the UI to French mid-session.**
  - **Persona + context:** Lila, a biology PhD who consults for pharma distributors, prefers French. She arrived via a French FB ad and accepted the FR locale.
  - **Entry state:** Authenticated, FR locale.
  - **Path:** (1) Realises a colleague shared an AR link; layout was RTL; she taps the language switcher → French; (2) entire layout re-flips to LTR without a page reload; (3) her saved query is preserved; (4) runs search, exports CSV, column headers come through in French.
  - **Climax:** She gets a French-labeled CSV without re-running the search.
  - **Resolution:** She keeps using the tool in her preferred language. **Edge case:** if a wilaya name has no FR translation cached, the system falls back to the official Arabic name transliterated (no broken blank).

## 3. Glossary

- **Wilaya** — Administrative region of Algeria. V1 uses the official 58-wilaya taxonomy established by the 2021 reform. Each wilaya has a stable numeric code (1–58). Relationships: a Company is located in exactly one Wilaya; a People record is located in the Wilaya of its employer's headquarters.
- **People record** — A B2B contact: a person at a company, with role/seniority, contact channels (email, phone where available), and a backlink to the parent Company record. Cardinality: many People per Company.
- **Company record** — A business entity: name, industry, wilaya, size band, public contact info, website, and a list of People records. Cardinality: one Company → many People.
- **Credit** — The atomic unit of consumption. Viewing a full People or Company record (the "reveal" action) costs 1 credit. Searches are free within daily limits (see FR-7). Exported rows cost 1 credit each per row included.
- **Credit pack** — A one-time, non-recurring purchase that adds credits to an account. Never expires; no auto-renew.
- **Starter tier** — The single V1 paid subscription: 1,500 DZD/mo for 200 credits/mo.
- **Free tier** — 15 credits on signup, no card required. CSV export watermarked.
- **Chargily** — The Algerian PSP used for CIB and EDahabia card processing. V1's sole payment rail.
- **CIB / EDahabia** — Algeria's two domestic card rails (interbank CIB; state-subsidised EDahabia). Both reachable via Chargily.
- **Reveal action** — The user-initiated step that unlocks the full contact details of a People or Company record and deducts 1 credit.
- **Saved search** — A named, persisted query (filters + keywords) the user can re-run. V1 keeps these per-account; not shared, not exported (V1 lists-feature parity with Linkiw is explicitly a non-goal).
- **58-wilaya taxonomy** — The official list of 58 wilayas (codes 1–58), published openly at /wilayas for credibility.

## 4. Features

### 4.1 Trilingual UI with RTL Support

**Description:** The entire user-facing surface is presented in Arabic, French, or English, with locale-appropriate layout direction (RTL for Arabic, LTR for French and English). The locale is inferred on first visit from `Accept-Language` and stored in user preferences thereafter. The language switcher is visible on every page (logged-in or logged-out). Switching locale does not reload the page, does not lose in-flight search state, and applies to navigation, content, UI chrome, emails, and CSV column headers. Realizes UJ-3.

**Functional Requirements:**

#### FR-1: Trilingual locale support

The system must render all UI strings, navigation, and chrome in AR, FR, or EN, with the active locale inferable from `Accept-Language` on first visit and overridable via a persistent language switcher.

**Consequences (testable):**
- Switching locale from AR to FR re-flips layout from RTL to LTR without a full page reload.
- A returning user retrieves their last-selected locale from their profile; guests retrieve it from a cookie.
- Untranslated strings are visibly flagged in dev/staging (never silently falling through to a default), and in production fall through to FR (not EN) for AR/FR users — and to EN for the EN default.

#### FR-2: RTL layout correctness

The system must render Arabic content in right-to-left layout, including navigation order, input alignment, table column order, icon directionality, and modal/drawer placement.

**Consequences (testable):**
- Logical-property CSS (e.g., `margin-inline-start`) is used throughout; no hardcoded `left/right` in component styles.
- Tables re-order columns visually in RTL while keeping the underlying column order stable for CSV export.
- Form labels and inputs align correctly in both directions on the same component.

#### FR-3: Localized emails and export headers

System-generated emails (signup confirm, payment receipt, credit-pack receipt, low-credit warning) and CSV/Excel export column headers must respect the recipient's active locale.

**Consequences (testable):**
- A user with AR locale receives an Arabic payment receipt with RTL layout in HTML email clients that support it.
- A CSV exported from a French-locale session has French column headers; the underlying data values themselves are not translated (wilaya names follow FR-12).

#### FR-4: Public founder and verification pages

The /about and /how-we-verify pages must be fully localized, including the founder narrative ("Made by Akram in Algiers") and the data-sourcing disclosure.

**Consequences (testable):**
- /about in AR includes the Arabic founder narrative; /how-we-verify in FR lists the V1 data sources (Google Places API, El Mouchir public pages, Pages Jaunes Algérie) and explicitly states CNRC and LinkedIn are not scraped.

### 4.2 People + Company Dual Search

**Description:** V1 surface revolves around two parallel search databases — People and Company — mirroring DzLeads' two-database model. The user toggles between them on the search screen; both share the same filter vocabulary (industry, wilaya, seniority, company size, keywords) but expose record-type-specific fields. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-5: People search

An authenticated user can search the People database by industry, wilaya, seniority, company size, and free-text keywords; results are paginated; each result row shows name, role, company, wilaya before reveal.

**Consequences (testable):**
- Empty-result state shows a helpful suggestion (broaden wilaya or industry), not a blank page.
- Pagination caps at 100 results per page; deep paging beyond 1000 results is truncated with a notice and a "refine your filters" prompt.

#### FR-6: Company search

An authenticated user can search the Company database by industry, wilaya, size, and keywords; results show company name, industry, wilaya, size band, and People count.

**Consequences (testable):**
- Clicking a Company result opens a Company detail view with its People records listed (People reveal still costs a credit per record).
- A Company with zero known People is shown with an explicit "0 contacts known" badge rather than hidden.

#### FR-7: Free searches, daily limit

Searches (query submits) are free for all users up to 30 searches/day for free users and 100/day for Starter users. Beyond the limit, the system shows a "refine or come back tomorrow" message and refuses the query (no silent failure).

**Consequences (testable):**
- The 30/day free limit is per-account, not per-IP (avoids gaming by clearing cookies).
- Rate limit resets at 00:00 Africa/Algiers.

#### FR-8: Saved searches

Any authenticated user can save a search (filters + keywords + sort) with a free-text name; saved searches appear in a sidebar list and can be re-run with one click.

**Consequences (testable):**
- Saved searches persist across sessions and across locale switches.
- Free-tier users can save up to 5 searches; Starter users up to 25 (V1 limit). [ASSUMPTION: these limits are product-judgement defaults; confirm with PM.]

### 4.3 Search Filters and 58-Wilaya Taxonomy

**Description:** The filter vocabulary is the spine of the search UX: industry, wilaya, seniority, company size, keywords. The wilaya filter uses the official 58-wilaya taxonomy, published openly at /wilayas with stable numeric codes. This taxonomy is a credibility differentiator versus incumbents publishing 48 or 69. Realizes UJ-1.

**Functional Requirements:**

#### FR-9: Industry filter

The system must expose an industry taxonomy filter; selecting one or more industries narrows results to Companies or People in those industries.

**Consequences (testable):**
- Industry taxonomy is curated by ops; V1 launches with at least 30 industries covering the bulk of registered businesses (e.g., Construction, Agroalimentaire, Pharma, Advertising, Telecom distribution). [ASSUMPTION: taxonomy list owned by ops, not user-generated.]
- Multi-select with "select all" and "clear" affordances.

#### FR-10: Wilaya filter on the 58-wilaya taxonomy

Wilaya filter values are exactly the official 58 wilayas (codes 1–58); each is displayed with its code, its Arabic name, its French name, and its English name. No "48 wilayas" or "69 wilayas" variants are exposed anywhere in the product.

**Consequences (testable):**
- The /wilayas public page lists all 58 with codes and trilingual names.
- Searching by wilaya filter never returns results tagged with a non-existent or retired wilaya code.
- Wilaya display name follows the user's active locale; if no localized name is cached, falls back to the transliterated Arabic name (no blank).

#### FR-11: Seniority filter

People search exposes a seniority filter with the bands: Owner/Founder, C-level, Director, Manager, Individual Contributor. [ASSUMPTION: bands are product-judgement defaults; confirm with PM.]

**Consequences (testable):**
- Seniority bands map to standardised role titles in the People dataset; a record missing seniority is excluded when any seniority filter is active.

#### FR-12: Company size filter

Company search exposes a size-band filter: 1–10, 11–50, 51–200, 201–500, 500+. [ASSUMPTION: bands are product-judgement defaults; confirm with PM.]

**Consequences (testable):**
- Companies whose size is unknown are excluded when any size filter is active; an "include unknown size" toggle exists off by default.

#### FR-13: Keyword search

The user can free-text search across People name, role, and Company name; keywords combine (AND) with the structured filters.

**Consequences (testable):**
- Keyword search supports diacritic-insensitive matching for Arabic and French (e.g., "café" matches "café" and "cafe").
- Empty keyword returns all records matching the active structured filters.

### 4.4 Reveal Action and Credit Metering

**Description:** Detailed contact data (the value moment) is gated behind a reveal action that consumes 1 credit per record. The metering is transparent: the user always sees their remaining credits before and after a reveal, and the deduction is atomic (no half-state if the operation fails mid-reveal). Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-14: Reveal with credit metering

An authenticated user with at least 1 credit can reveal a People or Company record's full contact fields; the system deducts 1 credit atomically and displays the resulting balance immediately.

**Consequences (testable):**
- Reveal is disabled (button disabled + tooltip reason) when the account has 0 credits; the user is offered the top-up path (paid user) or upgrade path (free user).
- Reveal of an already-revealed record in the same account within 30 days is free (re-reveal idempotency); the record is marked "already revealed" for the user.

#### FR-15: Credit balance surface

The header shows the user's remaining credits (with locale-appropriate number formatting — Western Arabic numerals for AR/FR, not Eastern Arabic numerals).

**Consequences (testable):**
- Credits update in place after a reveal without a full page reload.
- The banner includes a low-credit warning at ≤10 credits for paid users (visual + tooltip).

#### FR-16: Credit ledger

The system maintains a per-account ledger of credit grants (free signup, monthly subscription renewal, add-on pack, promotional), debits (reveal, export row), and expiry events. The user can view a /credits page with the last 90 days of activity.

**Consequences (testable):**
- Each ledger row has a type, amount, timestamp, balance-after, and a reference (e.g., order id, reveal id).
- The ledger is exportable as CSV from /credits.

### 4.5 CSV / Excel Export

**Description:** Exporting results is the universal buyer expectation in this market. Every paid user can export their search results to CSV (always) and Excel (.xlsx) (always); free users can export a watermarked CSV only (to surface the upgrade trigger without blocking discovery). Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-17: CSV export for paid users

A paid (Starter) user can export the current search result set to CSV; each row included in the export consumes 1 credit. The CSV includes header rows localized to the user's active locale, and the data fields the user has revealed in the current session plus any not-yet-revealed rows they have explicitly opted to include.

**Consequences (testable):**
- An export of N rows where M rows were already-revealed costs N credits (revealed and un-revealed alike cost 1 credit each to include in the export).
- The system warns the user of the credit cost before finalising the export.

#### FR-18: Excel (.xlsx) export for paid users

A paid user can export the current search result set to .xlsx with the same field set and credit cost as CSV.

**Consequences (testable):**
- .xlsx opens cleanly in Microsoft Excel and LibreOffice Calc; numerics are not mangled (e.g., phone numbers preserved as text).
- Column types are explicit (text, number, date) to avoid Excel auto-coercion bugs.

#### FR-19: Watermarked CSV export for free users

A free-tier user can export up to 5 rows of a CSV with a watermark ("DZLeads Free — upgrade to remove") in a header row and a footnote row.

**Consequences (testable):**
- Watermark text is localized to the user's active locale.
- Free-tier users cannot export .xlsx at all; the .xlsx button is visibly disabled with a tooltip "Upgrade to use Excel export".

#### FR-20: Export rate limit

To prevent bulk-scraping of the database via legitimate accounts, a single user cannot export more than 5,000 rows per 24h. [ASSUMPTION: 5,000/24h is a defensive default; tunable at ops config.]

**Consequences (testable):**
- Hitting the limit shows a "come back tomorrow" message; the limit resets at 00:00 Africa/Algiers.

### 4.6 Onboarding, Free Trial, and Authentication

**Description:** Signup requires only email + password — no card on file — and immediately grants 15 free credits. This matches or beats both incumbents and explicitly addresses the Algerian distrust of auto-renew subscriptions. Realizes UJ-1.

**Functional Requirements:**

#### FR-21: No-card signup with 15 free credits

A new user can register with email + password only; on email verification, the account is credited 15 free credits, never expiring. No payment method is requested during signup.

**Consequences (testable):**
- The signup form has no payment fields and no "default to a paid tier" preselection.
- Email verification link expires after 24h; on verification, the credit grant is recorded in the ledger with type "free_signup".

#### FR-22: Authentication and session

Standard email/password authentication with secure session handling (httpOnly cookie, CSRF protection). Password reset via email link. Sessions persist for 30 days of inactivity.

**Consequences (testable):**
- A reset link is single-use and expires after 1h.
- A session is invalidated on password change.

#### FR-23: Account deletion and GDPR/Loi 18-07 data subject request path

The user can self-delete their account from /settings; deletion removes personal data and any unrevealed-credit balance, retains anonymised ledger rows for 90 days (tax/finance records), and surfaces a clear confirmation flow. The /privacy page documents the data-subject request process.

**Consequences (testable):**
- Deletion is irreversible after a 7-day grace period during which the account is frozen and recoverable.
- An Algerian resident can email a takedown/address-request to a published address and receive a response within 30 days (V1 manual process).

### 4.7 Billing — Chargily CIB/EDahabia, Single Tier + Add-on Packs

**Description:** The V1 payment surface is purposefully narrow: one paid subscription tier (Starter, 1,500 DZD/mo for 200 credits/mo) and two one-time add-on credit packs. The only payment rail is Chargily (CIB and EDahabia). This matches DzLeads' table-stakes and matches the Algerian buyer's payment reality. Realizes UJ-2.

**Functional Requirements:**

#### FR-24: Starter subscription via Chargily

An authenticated user with no active subscription can subscribe to Starter via Chargily checkout; on successful payment the account is granted 200 credits and the subscription is recorded with start date and next-renewal date.

**Consequences (testable):**
- Payment methods exposed in the Chargily checkout are CIB and EDahabia only (no foreign-card fallback in V1).
- On monthly renewal, credits granted are 200 fresh credits; unused credits from the previous cycle do not roll over (V1 explicit non-goal — credit rollover is a V1.5 feature).

#### FR-25: Add-on credit packs (one-time, non-recurring)

A user with an active Starter subscription can buy a one-time add-on credit pack at any time: (a) 500 DZD → 75 credits, or (b) 1,500 DZD → 250 credits. Packs never expire and do not auto-renew.

**Consequences (testable):**
- Free-tier users can also buy add-on packs (this is the Option C–style hybrid the research recommended — broadens the cash-flow-fit funnel without forcing a subscription).
- Pack credits are drawn down only after monthly subscription credits are exhausted (subscription credits first; then pack credits). [ASSUMPTION: this drawdown order matches buyer mental model of "use what I paid for monthly first"; confirm with PM.]

#### FR-26: Cancellation and refund policy

A user can cancel their subscription at any time from /billing; cancellation stops the next renewal but does not refund the current cycle. Refunds are not issued in V1 except for documented payment errors (ops manual process).

**Consequences (testable):**
- Cancellation is self-serve and surfaces a clear "you will keep access until {date}" confirmation.
- A /refund-policy page documents the no-refund-by-default stance.

#### FR-27: Chargily webhook handling

The system ingests Chargily payment webhooks to reconcile subscription grants, pack grants, and renewals; reconciliation is idempotent on webhook event id.

**Consequences (testable):**
- A duplicate webhook event does not double-grant credits.
- If a webhook is delayed, the user-facing /billing page polls for up to 60s and shows an explanatory toast; final reconciliation corrects the ledger if a grant was missed.

#### FR-28: Subscription state and surfaces

The header surfaces subscription state: "Starter — renouvelle le {date}" / "Starter — يتجدد في {date}" / "Starter — renews on {date}". For free users, the header shows "Free — upgrade" with a CTA.

**Consequences (testable):**
- A failed renewal (card declined) surfaces a banner prompting the user to update their payment method via Chargily; credits from the previous cycle remain usable until the next cycle would have begun.

### 4.8 Public Marketing and Trust Surfaces

**Description:** Two public pages do outsized trust work for V1 versus incumbents that obscure sourcing and founders: /how-we-verify (data methodology) and /about (founder narrative). These are localized, navigable from the footer on every page, and indexed for search. Realizes UJ-1.

**Functional Requirements:**

#### FR-29: /how-we-verify public page

A public, localized page that lists the V1 data sources and explicitly states which sources are NOT used. Required content: Google Places API, El Mouchir public pages, Pages Jaunes Algérie (rate-limited). Explicit non-use: CNRC, LinkedIn.

**Consequences (testable):**
- The page is reachable without authentication and is crawlable.
- The localized page lists all three active sources; the FR page lists the two non-used sources as "non utilisées" with a one-sentence rationale each.

#### FR-30: /about founder narrative page

A public, localized /about page with the founder narrative "Made by Akram in Algiers" — operationally a paragraph in the founder's voice plus avatar/headshot and contact email.

**Consequences (testable):**
- The page is reachable from the footer on every public surface.
- The narrative is translated, not just machine-translated — the AR and FR versions read naturally in those languages. [ASSUMPTION: translations are reviewed by a native or fluent speaker before launch; confirm with PM.]

#### FR-31: /privacy and /terms pages

Public, localized /privacy (including data-subject request process, ANPDP declaration reference when filed, takedown process) and /terms (subscription terms, add-on pack non-renewal, no-refund-by-default policy).

**Consequences (testable):**
- /privacy references Loi 18-07 du 10 juin 2018 and the ANPDP and commits to a 30-day data-subject response window.

## 5. Non-Goals (Explicit)

V1 will **not** build, expose, or promise any of the following. These are not "later in V1"; they are out of V1 entirely.

- **No CRM / list persistence beyond saved searches.** Linkiw is winning here; competing in V1 risks scope blow-up. Saved searches (§4.2 FR-8) are the allowed surface; no list/tagging/note features.
- **No email sequences / outreach automation.** V2 territory.
- **No WhatsApp outreach integration.** V2 territory.
- **No WhatsApp inbound customer-support channel as a paid feature.** [ASSUMPTION: the research's "WhatsApp support even at the lowest paid tier" mention refers to a customer-support channel, not a product feature; if the user wants WhatsApp support for V1 customers, that's an ops-channel decision, not a build item — confirm with PM.]
- **No AI agent / auto-categorization.** Linkiw is building this; do not compete in V1.
- **No API.** Technical buyers are under 10% of V1 TAM.
- **No team seats / shared workspaces.** V2 territory.
- **No international / cross-border data.** V1 dataset is Algeria-only. V3 territory for exporters.
- **No mobile app.** Web app is the V1 surface; responsive web covers mobile browsers.
- **No CNRC-scraped data.** Deferred to V2 pending a legal opinion (see §10.3, §10.4).
- **No LinkedIn-scraped data or scraped LinkedIn URLs.** Too risky for an MVP (see §10.3). Publicly published LinkedIn URLs (from a company's own website) are allowed.
- **No credit rollover.** Unused monthly credits do not carry to the next cycle. V1.5 feature.
- **No annual pricing.** V1 is monthly only. V2 may add annual pricing with a discount framing.
- **No tiered pricing.** V1 has exactly one paid tier (Starter). Multi-tier is V1.5.
- **No foreign-card payment methods.** Chargily CIB/EDahabia only. No Stripe, no PayPal, no foreign cards in V1.
- **No multi-currency.** Prices are DZD only.
- **No referrer / affiliate program.** V2 consideration.

## 6. MVP Scope

### 6.1 In Scope

- Trilingual UI (AR/FR/EN + RTL) end-to-end (§4.1)
- People + Company dual search with shared filter vocabulary (§4.2, §4.3)
- 58-wilaya taxonomy, published at /wilayas, used as the sole wilaya filter values (§4.3 FR-10)
- Industry, seniority, size, keyword filters (§4.3)
- Saved searches per account, capped (§4.2 FR-8)
- Reveal action with credit metering and transparent balance (§4.4)
- Credit ledger viewable at /credits (§4.4 FR-16)
- CSV export always; Excel export for paid users; watermarked CSV for free users (§4.5)
- No-card signup with 15 free credits (§4.6)
- Starter subscription at 1,500 DZD/mo for 200 credits/mo via Chargily (§4.7)
- Two add-on credit packs: 500 DZD/75 credits and 1,500 DZD/250 credits, never expire, non-recurring (§4.7)
- Public /how-we-verify, /about, /privacy, /terms, /wilayas pages (§4.4 FR-4, §4.8)
- Account self-deletion and data-subject request process (§4.6 FR-23)

### 6.2 Out of Scope for MVP (with destination)

- **CRM features, lists, tagging** → V2 (Linkiw head-on fight).
- **Email sequences / outreach automation** → V2.
- **WhatsApp integration (product)** → V2.
- **AI agent / auto-categorisation** → V2.
- **API + public API surface** → V3.
- **Team seats / shared workspaces** → V2.
- **International / cross-border data (exporters)** → V3.
- **Native mobile app** → V2+ (responsive web covers V1 mobile).
- **CNRC data** → V2 pending legal opinion.
- **LinkedIn scrape / scraped LinkedIn URLs** → never; publicly-published LinkedIn URLs only.
- **Credit rollover** → V1.5 (~4–6 weeks post-V1 launch).
- **Mid-tier (~5,000 DZD/mo, 750 credits) for heavier solo + light agencies** → V1.5.
- **Three-tier subscription structure** → V1.5 (single Starter tier stays in V1).
- **Annual pricing with discount** → V2.
- **15,000 DZD/mo tier with sequences, basic CRM, WhatsApp-integration beta** → V2.
- **Custom + API + team seats + cross-border data (unbounded MRR phase)** → V3.

## 7. Success Metrics

**Primary**
- **SM-1**: Paid user activation — a new Starter subscriber runs at least one export within 7 days of subscribing. Target ≥60% within the first 60 days post-launch. Validates FR-17, FR-24.
- **SM-2**: Trial-to-paid conversion — share of free-signup users who subscribe to Starter within 14 days of signup. Target ≥8% in months 1–3. Validates FR-21, FR-24.

**Secondary**
- **SM-3**: AR-locale session share — % of sessions using the AR locale. Target ≥30% in months 1–3 (validates the language wedge is actually landing). Validates FR-1, FR-2.
- **SM-4**: Add-on pack attach rate — % of paid users who buy at least one add-on pack within 30 days of subscription. Target ≥15% in months 2–3. Validates FR-25.
- **SM-5**: Free-trial export-to-upgrade rate — % of free users who export the watermarked CSV and upgrade within 7 days. Target ≥10%. Validates FR-19, FR-24.
- **SM-6**: Data-credibility signal — % of search sessions that visit /wilayas, /how-we-verify, or /about during the session. Target ≥5% (this is a trust signal, not a revenue metric). Validates FR-10, FR-29, FR-30.

**Counter-metrics (do not optimize)**
- **SM-C1**: Total signup volume — pure top-of-funnel count. Do not optimise at the expense of trial-to-paid conversion; cheap signups that never pay are counter-productive.
- **SM-C2**: Average credits consumed per paid user — high consumption without add-on-pack attach or renewal is a churn signal, not a success signal. Counterbalances SM-4.

## 8. Open Questions

1. **WhatsApp customer-support channel**: Does the user want a WhatsApp number for V1 customer support (an ops decision, not a build item), or is email only sufficient for V1 launch?
2. **Saved-search limits**: Are 5 (free) / 25 (Starter) the right caps? (FR-8 assumption.)
3. **Seniority and size band taxonomies**: Confirm the five seniority bands (FR-11) and five size bands (FR-12) cover the V1 dataset adequately. Ops to curate the actual taxonomy.
4. **Localization review**: Who reviews the AR and FR translations of the founder narrative and the marketing pages before launch? (FR-30 assumption.)
5. **Credit drawdown order**: Subscription-first then pack (FR-25 assumption), or pack-first then subscription? Buyer-mental-model trade-off.
6. **Export rate limit**: Is 5,000 rows / 24h per account the right defensive default? (FR-20 assumption.)
7. **Industry taxonomy ownership**: Ops curates and maintains, or a one-time V1 launch set frozen for the cycle? (FR-9 assumption.)
8. **ANPDP declaration**: Has the formal declaration to the Autorité nationale de protection des données personnelles been filed? If not, when? Affects /privacy wording (FR-31).
9. **Refund-policy edge cases**: Documented payment errors only (FR-26); what counts as "documented" in the ops manual?
10. **Founders' headshot + contact email**: Confirm what email and avatar ship on /about for V1 launch (FR-30).

## 9. Assumptions Index

- §4.2 FR-8 — Saved-search caps: 5 free, 25 Starter.
- §4.3 FR-9 — Industry taxonomy is ops-owned, ~30 industries at launch.
- §4.3 FR-11 — Seniority bands: Owner/Founder, C-level, Director, Manager, IC.
- §4.3 FR-12 — Company size bands: 1–10, 11–50, 51–200, 201–500, 500+.
- §4.5 FR-20 — Export rate limit 5,000 rows / 24h per account.
- §4.7 FR-25 — Credit drawdown order: subscription credits first, then pack credits.
- §4.8 FR-30 — AR and FR founder-narrative translations reviewed by a native/fluent speaker pre-launch.
- §5 — The research's "WhatsApp support" mention is interpreted as an ops channel, not a product feature.

## 10. Cross-Cutting NFRs

- **NFR-1: Performance.** Average first-search-results page must render in ≤2.5s at the 95th percentile on a 4G Algerian mobile connection; reveal action must return within ≤1.5s at the 95th percentile.
- **NFR-2: Availability.** The application must target 99.5% monthly availability for V1 (≈3.5h downtime/mo allowance). Search and export must stay available even when the upstream data scraper pipeline is paused.
- **NFR-3: Observability.** Every reveal, export, payment, and credit-purchase emits a structured event to the application log with user id (hashed), event type, amount, and timestamp; logs are retained 90 days.
- **NFR-4: Localisation correctness.** No string appears in the UI in a non-matching locale. CI must fail the build on missing-translation keys for any of AR/FR/EN; the build flag list is the same three locales for V1.
- **NFR-5: Browser support.** V1 supports the latest two major versions of Chrome, Safari, Edge, and Firefox on desktop, and the latest two mobile Chrome (Android) and Safari (iOS) versions. Internet Explorer is not supported.
- **NFR-6: Accessibility.** Public pages (/, /how-we-verify, /about, /privacy, /terms, /wilayas, the signup flow, the login flow) target WCAG 2.1 AA. Authenticated app surfaces target WCAG 2.1 A as a V1 floor with AA commitments for any form or interactive surface.
- **NFR-7: Data refresh.** The People and Company dataset is refreshed on a per-source schedule maintained in an ops config; the slowest source refreshes at least once every 30 days. Stale records carry a "last verified on" timestamp surfaced on reveal.
- **NFR-8: Secrets.** No Chargily key, third-party API key, or scraper credential lives in the client bundle or in the application log. Secrets are server-only and rotated quarterly.

## 11. Constraints and Guardrails

### 11.1 Privacy
- Personal emails and phone numbers ARE personal data under Algerian Loi 18-07 du 10 juin 2018, even in B2B role-based context. The /privacy page must explain this scope, and the data-subject request process must respond within 30 days.
- The ANPDP declaration reference is required on /privacy once filed; until filed, /privacy must commit to filing and a status note.
- A published takedown/contact address must accept both individual opt-out and company-level opt-out requests.
- Re-reveal idempotency (FR-14) limits over-charging but does not affect privacy; data-subject opt-out removes the record from search results within 72h of confirmation.

### 11.2 Compliance and Regulatory
- Algerian data-protection law (Loi 18-07) governs this product. V1 operates in Algeria on Algerian-resident personal data; no cross-border data transfer to non-Algerian jurisdictions is in scope (matches V1 non-goal: no international data).
- No CNRC-scraped data and no LinkedIn-scraped data in V1 (per the data-sourcing legality brief). Public web-published LinkedIn URLs (where a company publishes them on its own site) are allowed; scraped LinkedIn URLs are not.
- The data-sourcing legality brief is explicitly NOT a legal opinion; a formal Algerian legal review is required before V2 adds CNRC data. Flagged in §8 Open Questions.
- Chargily is a regulated PSP; its ToS and webhook format govern the integration. Refund handling (FR-26) and chargeback response follow Chargily's published policies.

### 11.3 Cost Guardrails
- V1 is a 3–4 week MVP. Any feature whose implementation estimate exceeds ~3 dev-days triggers a scope conversation, not silent inclusion.
- Add-on credit pack economics must clear the gross margin floor: pack price must cover per-credit data-acquisition cost (Google Places API quota, ops scraper time) plus a target margin ≥60%. The 500 DZD/75 pack at 6.7 DZD/contact and the 1,500 DZD/250 pack at 6.0 DZD/contact clear this floor at V1's data-cost baseline; revisit if per-credit data-cost exceeds 2.0 DZD.
- Google Places API cost is the dominant variable data cost. V1 must cap Google Places API monthly spend at an ops-config threshold; on breach, the scraper gracefully pauses the Google source and continues with other sources.
- Facebook ads test budget is 20,000 DZD (~$150) for the launch campaign; this is a marketing budget, not a build item, and is documented in the research GTM shard.

### 11.4 Platform
- Web application only. Mobile browsers are supported responsively. No native mobile app, no PWA install prompt in V1 [ASSUMPTION: PWA install prompt deferred — confirm with PM if a V1 install-prompt is wanted; it is cheap but adds polish scope].
- Hosted in a single region close to Algeria; latency-sensitive surfaces (search, reveal) are served from the same region as the data layer.

## 12. Why Now

- **Incumbent reaction window is 3–6 months.** DzLeads and Linkiw have a documented window before they react to price cuts and Arabic UI. V1 must launch inside that window to convert greenfield share.
- **Algerian administrative reform window is closed and stable.** The 58-wilaya taxonomy has been stable since 2021; both incumbents' failure to align is now a credibility vulnerability V1 can attack with low risk of the taxonomy changing under us.
- **Chargily maturity.** Chargily now reliably exposes both CIB and EDahabia, making a dinar-denominated subscription viable without foreign-card processing. Two years earlier this would not have been possible.
- **Facebook-reachable SMB audience.** Algerian SMB sellers are reachable via Facebook ads at the 20,000 DZD test budget; the GTM economics pencil at the V1 price point.
- **Apollo.io is inaccessible in Algeria.** The global benchmark is gated, leaving the door open for a local-built alternative.

## 13. Risk and Mitigations

- **Risk: data-subject complaints on Pages Jaunes-sourced records.** Mitigation: rate-limited scrape, /privacy takedown process, 72h removal SLA, per-source disable switch in the scraper pipeline.
- **Risk: Chargily webhook delays cause user-perceived payment failures.** Mitigation: 60s polling on /billing with explanatory toast, idempotent reconciliation via webhook event id (FR-27). [ASSUMPTION: 60s polling frequency tunable at ops config; confirm with PM.]
- **Risk: a competitor cuts price below 1,500 DZD before V1 reaches 100 paid users.** Mitigation: anchor on the trilingual + 58-wilaya + founder-narrative wedge, not on price alone; the wedge survives a price cut by competitors because the wedge is multi-axis.
- **Risk: a major data source disappears (e.g., Google Places API pricing changes, Pages Jaunes bans the scraper).** Mitigation: the V1 scraper pipeline treats each source as an independent module (per the legality brief's architectural note), so disabling one source does not collapse the product; surfaced to the user as a reduced coverage notice, not as an outage.
- **Risk: AR/French copy quality is uneven at launch.** Mitigation: native-speaker review of the marketing pages (FR-30 assumption) before launch; CI gate on missing-translation keys (NFR-4).
- **Risk: an Algerian competitor launches an Arabic UI during the incumbent reaction window.** Mitigation: the 58-wilaya credibility edge and the founder narrative are independent of UI language and still differentiate.
- **Risk: credit-card on Chargily is declined at renewal due to expired CIB cards.** Mitigation: failed-renewal banner prompts re-payment via Chargily (FR-28); previous-cycle credits remain usable until the next cycle would have begun, so the user is not interrupted mid-work.

## 14. Assumptions Index (cross-cutting)

- §11.4 — PWA install prompt deferred (no V1 install prompt).
- §13 — Chargily webhook polling frequency tuned at ops config; 60s default.