# 4. Features

## 4.1 Trilingual UI with RTL Support

**Description:** The entire user-facing surface is presented in Arabic, French, or English, with locale-appropriate layout direction (RTL for Arabic, LTR for French and English). The locale is inferred on first visit from `Accept-Language` and stored in user preferences thereafter. The language switcher is visible on every page (logged-in or logged-out). Switching locale does not reload the page, does not lose in-flight search state, and applies to navigation, content, UI chrome, emails, and CSV column headers. Realizes UJ-3.

**Functional Requirements:**

### FR-1: Trilingual locale support

The system must render all UI strings, navigation, and chrome in AR, FR, or EN, with the active locale inferable from `Accept-Language` on first visit and overridable via a persistent language switcher.

**Consequences (testable):**
- Switching locale from AR to FR re-flips layout from RTL to LTR without a full page reload.
- A returning user retrieves their last-selected locale from their profile; guests retrieve it from a cookie.
- Untranslated strings are visibly flagged in dev/staging (never silently falling through to a default), and in production fall through to FR (not EN) for AR/FR users — and to EN for the EN default.

### FR-2: RTL layout correctness

The system must render Arabic content in right-to-left layout, including navigation order, input alignment, table column order, icon directionality, and modal/drawer placement.

**Consequences (testable):**
- Logical-property CSS (e.g., `margin-inline-start`) is used throughout; no hardcoded `left/right` in component styles.
- Tables re-order columns visually in RTL while keeping the underlying column order stable for CSV export.
- Form labels and inputs align correctly in both directions on the same component.

### FR-3: Localized emails and export headers

System-generated emails (signup confirm, payment receipt, credit-pack receipt, low-credit warning) and CSV/Excel export column headers must respect the recipient's active locale.

**Consequences (testable):**
- A user with AR locale receives an Arabic payment receipt with RTL layout in HTML email clients that support it.
- A CSV exported from a French-locale session has French column headers; the underlying data values themselves are not translated (wilaya names follow FR-12).

### FR-4: Public founder and verification pages

The /about and /how-we-verify pages must be fully localized, including the founder narrative ("Made by Akram in Algiers") and the data-sourcing disclosure.

**Consequences (testable):**
- /about in AR includes the Arabic founder narrative; /how-we-verify in FR lists the V1 data sources (Google Places API, El Mouchir public pages, Pages Jaunes Algérie) and explicitly states CNRC and LinkedIn are not scraped.

## 4.2 People + Company Dual Search

**Description:** V1 surface revolves around two parallel search databases — People and Company — mirroring DzLeads' two-database model. The user toggles between them on the search screen; both share the same filter vocabulary (industry, wilaya, seniority, company size, keywords) but expose record-type-specific fields. Realizes UJ-1, UJ-3.

**Functional Requirements:**

### FR-5: People search

An authenticated user can search the People database by industry, wilaya, seniority, company size, and free-text keywords; results are paginated; each result row shows name, role, company, wilaya before reveal.

**Consequences (testable):**
- Empty-result state shows a helpful suggestion (broaden wilaya or industry), not a blank page.
- Pagination caps at 100 results per page; deep paging beyond 1000 results is truncated with a notice and a "refine your filters" prompt.

### FR-6: Company search

An authenticated user can search the Company database by industry, wilaya, size, and keywords; results show company name, industry, wilaya, size band, and People count.

**Consequences (testable):**
- Clicking a Company result opens a Company detail view with its People records listed (People reveal still costs a credit per record).
- A Company with zero known People is shown with an explicit "0 contacts known" badge rather than hidden.

### FR-7: Free searches, daily limit

Searches (query submits) are free for all users up to 30 searches/day for free users and 100/day for Starter users. Beyond the limit, the system shows a "refine or come back tomorrow" message and refuses the query (no silent failure).

**Consequences (testable):**
- The 30/day free limit is per-account, not per-IP (avoids gaming by clearing cookies).
- Rate limit resets at 00:00 Africa/Algiers.

### FR-8: Saved searches

Any authenticated user can save a search (filters + keywords + sort) with a free-text name; saved searches appear in a sidebar list and can be re-run with one click.

**Consequences (testable):**
- Saved searches persist across sessions and across locale switches.
- Free-tier users can save up to 5 searches; Starter users up to 25 (V1 limit). [ASSUMPTION: these limits are product-judgement defaults; confirm with PM.]

## 4.3 Search Filters and 58-Wilaya Taxonomy

**Description:** The filter vocabulary is the spine of the search UX: industry, wilaya, seniority, company size, keywords. The wilaya filter uses the official 58-wilaya taxonomy, published openly at /wilayas with stable numeric codes. This taxonomy is a credibility differentiator versus incumbents publishing 48 or 69. Realizes UJ-1.

**Functional Requirements:**

### FR-9: Industry filter

The system must expose an industry taxonomy filter; selecting one or more industries narrows results to Companies or People in those industries.

**Consequences (testable):**
- Industry taxonomy is curated by ops; V1 launches with at least 30 industries covering the bulk of registered businesses (e.g., Construction, Agroalimentaire, Pharma, Advertising, Telecom distribution). [ASSUMPTION: taxonomy list owned by ops, not user-generated.]
- Multi-select with "select all" and "clear" affordances.

### FR-10: Wilaya filter on the 58-wilaya taxonomy

Wilaya filter values are exactly the official 58 wilayas (codes 1–58); each is displayed with its code, its Arabic name, its French name, and its English name. No "48 wilayas" or "69 wilayas" variants are exposed anywhere in the product.

**Consequences (testable):**
- The /wilayas public page lists all 58 with codes and trilingual names.
- Searching by wilaya filter never returns results tagged with a non-existent or retired wilaya code.
- Wilaya display name follows the user's active locale; if no localized name is cached, falls back to the transliterated Arabic name (no blank).

### FR-11: Seniority filter

People search exposes a seniority filter with the bands: Owner/Founder, C-level, Director, Manager, Individual Contributor. [ASSUMPTION: bands are product-judgement defaults; confirm with PM.]

**Consequences (testable):**
- Seniority bands map to standardised role titles in the People dataset; a record missing seniority is excluded when any seniority filter is active.

### FR-12: Company size filter

Company search exposes a size-band filter: 1–10, 11–50, 51–200, 201–500, 500+. [ASSUMPTION: bands are product-judgement defaults; confirm with PM.]

**Consequences (testable):**
- Companies whose size is unknown are excluded when any size filter is active; an "include unknown size" toggle exists off by default.

### FR-13: Keyword search

The user can free-text search across People name, role, and Company name; keywords combine (AND) with the structured filters.

**Consequences (testable):**
- Keyword search supports diacritic-insensitive matching for Arabic and French (e.g., "café" matches "café" and "cafe").
- Empty keyword returns all records matching the active structured filters.

## 4.4 Reveal Action and Credit Metering

**Description:** Detailed contact data (the value moment) is gated behind a reveal action that consumes 1 credit per record. The metering is transparent: the user always sees their remaining credits before and after a reveal, and the deduction is atomic (no half-state if the operation fails mid-reveal). Realizes UJ-1, UJ-2.

**Functional Requirements:**

### FR-14: Reveal with credit metering

An authenticated user with at least 1 credit can reveal a People or Company record's full contact fields; the system deducts 1 credit atomically and displays the resulting balance immediately.

**Consequences (testable):**
- Reveal is disabled (button disabled + tooltip reason) when the account has 0 credits; the user is offered the top-up path (paid user) or upgrade path (free user).
- Reveal of an already-revealed record in the same account within 30 days is free (re-reveal idempotency); the record is marked "already revealed" for the user.

### FR-15: Credit balance surface

The header shows the user's remaining credits (with locale-appropriate number formatting — Western Arabic numerals for AR/FR, not Eastern Arabic numerals).

**Consequences (testable):**
- Credits update in place after a reveal without a full page reload.
- The banner includes a low-credit warning at ≤10 credits for paid users (visual + tooltip).

### FR-16: Credit ledger

The system maintains a per-account ledger of credit grants (free signup, monthly subscription renewal, add-on pack, promotional), debits (reveal, export row), and expiry events. The user can view a /credits page with the last 90 days of activity.

**Consequences (testable):**
- Each ledger row has a type, amount, timestamp, balance-after, and a reference (e.g., order id, reveal id).
- The ledger is exportable as CSV from /credits.

## 4.5 CSV / Excel Export

**Description:** Exporting results is the universal buyer expectation in this market. Every paid user can export their search results to CSV (always) and Excel (.xlsx) (always); free users can export a watermarked CSV only (to surface the upgrade trigger without blocking discovery). Realizes UJ-1, UJ-3.

**Functional Requirements:**

### FR-17: CSV export for paid users

A paid (Starter) user can export the current search result set to CSV; each row included in the export consumes 1 credit. The CSV includes header rows localized to the user's active locale, and the data fields the user has revealed in the current session plus any not-yet-revealed rows they have explicitly opted to include.

**Consequences (testable):**
- An export of N rows where M rows were already-revealed costs N credits (revealed and un-revealed alike cost 1 credit each to include in the export).
- The system warns the user of the credit cost before finalising the export.

### FR-18: Excel (.xlsx) export for paid users

A paid user can export the current search result set to .xlsx with the same field set and credit cost as CSV.

**Consequences (testable):**
- .xlsx opens cleanly in Microsoft Excel and LibreOffice Calc; numerics are not mangled (e.g., phone numbers preserved as text).
- Column types are explicit (text, number, date) to avoid Excel auto-coercion bugs.

### FR-19: Watermarked CSV export for free users

A free-tier user can export up to 5 rows of a CSV with a watermark ("DZLeads Free — upgrade to remove") in a header row and a footnote row.

**Consequences (testable):**
- Watermark text is localized to the user's active locale.
- Free-tier users cannot export .xlsx at all; the .xlsx button is visibly disabled with a tooltip "Upgrade to use Excel export".

### FR-20: Export rate limit

To prevent bulk-scraping of the database via legitimate accounts, a single user cannot export more than 5,000 rows per 24h. [ASSUMPTION: 5,000/24h is a defensive default; tunable at ops config.]

**Consequences (testable):**
- Hitting the limit shows a "come back tomorrow" message; the limit resets at 00:00 Africa/Algiers.

## 4.6 Onboarding, Free Trial, and Authentication

**Description:** Signup requires only email + password — no card on file — and immediately grants 15 free credits. This matches or beats both incumbents and explicitly addresses the Algerian distrust of auto-renew subscriptions. Realizes UJ-1.

**Functional Requirements:**

### FR-21: No-card signup with 15 free credits

A new user can register with email + password only; on email verification, the account is credited 15 free credits, never expiring. No payment method is requested during signup.

**Consequences (testable):**
- The signup form has no payment fields and no "default to a paid tier" preselection.
- Email verification link expires after 24h; on verification, the credit grant is recorded in the ledger with type "free_signup".

### FR-22: Authentication and session

Standard email/password authentication with secure session handling (httpOnly cookie, CSRF protection). Password reset via email link. Sessions persist for 30 days of inactivity.

**Consequences (testable):**
- A reset link is single-use and expires after 1h.
- A session is invalidated on password change.

### FR-23: Account deletion and GDPR/Loi 18-07 data subject request path

The user can self-delete their account from /settings; deletion removes personal data and any unrevealed-credit balance, retains anonymised ledger rows for 90 days (tax/finance records), and surfaces a clear confirmation flow. The /privacy page documents the data-subject request process.

**Consequences (testable):**
- Deletion is irreversible after a 7-day grace period during which the account is frozen and recoverable.
- An Algerian resident can email a takedown/address-request to a published address and receive a response within 30 days (V1 manual process).

## 4.7 Billing — Chargily CIB/EDahabia, Single Tier + Add-on Packs

**Description:** The V1 payment surface is purposefully narrow: one paid subscription tier (Starter, 1,500 DZD/mo for 200 credits/mo) and two one-time add-on credit packs. The only payment rail is Chargily (CIB and EDahabia). This matches DzLeads' table-stakes and matches the Algerian buyer's payment reality. Realizes UJ-2.

**Functional Requirements:**

### FR-24: Starter subscription via Chargily

An authenticated user with no active subscription can subscribe to Starter via Chargily checkout; on successful payment the account is granted 200 credits and the subscription is recorded with start date and next-renewal date.

**Consequences (testable):**
- Payment methods exposed in the Chargily checkout are CIB and EDahabia only (no foreign-card fallback in V1).
- On monthly renewal, credits granted are 200 fresh credits; unused credits from the previous cycle do not roll over (V1 explicit non-goal — credit rollover is a V1.5 feature).

### FR-25: Add-on credit packs (one-time, non-recurring)

A user with an active Starter subscription can buy a one-time add-on credit pack at any time: (a) 500 DZD → 75 credits, or (b) 1,500 DZD → 250 credits. Packs never expire and do not auto-renew.

**Consequences (testable):**
- Free-tier users can also buy add-on packs (this is the Option C–style hybrid the research recommended — broadens the cash-flow-fit funnel without forcing a subscription).
- Pack credits are drawn down only after monthly subscription credits are exhausted (subscription credits first; then pack credits). [ASSUMPTION: this drawdown order matches buyer mental model of "use what I paid for monthly first"; confirm with PM.]

### FR-26: Cancellation and refund policy

A user can cancel their subscription at any time from /billing; cancellation stops the next renewal but does not refund the current cycle. Refunds are not issued in V1 except for documented payment errors (ops manual process).

**Consequences (testable):**
- Cancellation is self-serve and surfaces a clear "you will keep access until {date}" confirmation.
- A /refund-policy page documents the no-refund-by-default stance.

### FR-27: Chargily webhook handling

The system ingests Chargily payment webhooks to reconcile subscription grants, pack grants, and renewals; reconciliation is idempotent on webhook event id.

**Consequences (testable):**
- A duplicate webhook event does not double-grant credits.
- If a webhook is delayed, the user-facing /billing page polls for up to 60s and shows an explanatory toast; final reconciliation corrects the ledger if a grant was missed.

### FR-28: Subscription state and surfaces

The header surfaces subscription state: "Starter — renouvelle le {date}" / "Starter — يتجدد في {date}" / "Starter — renews on {date}". For free users, the header shows "Free — upgrade" with a CTA.

**Consequences (testable):**
- A failed renewal (card declined) surfaces a banner prompting the user to update their payment method via Chargily; credits from the previous cycle remain usable until the next cycle would have begun.

## 4.8 Public Marketing and Trust Surfaces

**Description:** Two public pages do outsized trust work for V1 versus incumbents that obscure sourcing and founders: /how-we-verify (data methodology) and /about (founder narrative). These are localized, navigable from the footer on every page, and indexed for search. Realizes UJ-1.

**Functional Requirements:**

### FR-29: /how-we-verify public page

A public, localized page that lists the V1 data sources and explicitly states which sources are NOT used. Required content: Google Places API, El Mouchir public pages, Pages Jaunes Algérie (rate-limited). Explicit non-use: CNRC, LinkedIn.

**Consequences (testable):**
- The page is reachable without authentication and is crawlable.
- The localized page lists all three active sources; the FR page lists the two non-used sources as "non utilisées" with a one-sentence rationale each.

### FR-30: /about founder narrative page

A public, localized /about page with the founder narrative "Made by Akram in Algiers" — operationally a paragraph in the founder's voice plus avatar/headshot and contact email.

**Consequences (testable):**
- The page is reachable from the footer on every public surface.
- The narrative is translated, not just machine-translated — the AR and FR versions read naturally in those languages. [ASSUMPTION: translations are reviewed by a native or fluent speaker before launch; confirm with PM.]

### FR-31: /privacy and /terms pages

Public, localized /privacy (including data-subject request process, ANPDP declaration reference when filed, takedown process) and /terms (subscription terms, add-on pack non-renewal, no-refund-by-default policy).

**Consequences (testable):**
- /privacy references Loi 18-07 du 10 juin 2018 and the ANPDP and commits to a 30-day data-subject response window.
