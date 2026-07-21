# 2. Target User

## 2.1 Jobs To Be Done

- **Find buyers fast:** "As a solo SMB seller in Algiers, I want to pull a list of verified decision-makers in my industry and wilaya so I can stop scrolling Pages Jaunes and start selling."
- **Trust the data:** "As an agency founder, I want the wilaya list to match the official 58 so I trust the rest of the dataset."
- **Pay the way I pay:** "As an Algerian buyer, I want to pay with my CIB card or EDahabia in dinars, not a foreign card via Stripe, because that's what I have."
- **Use my language:** "As an Arabic-speaking seller, I want to navigate the whole app in Arabic with correct RTL layout, not a French-only interface that assumes I'm francophone."
- **Try before I commit:** "As a cautious buyer burnt by auto-renew subscriptions, I want 15 free credits with no card on file before I decide."
- **Buy more without upgrading:** "As a heavy user mid-month, I want to buy a one-time credit pack instead of being forced onto a higher tier."

## 2.2 Non-Users (V1)

- Exporters needing cross-border / international contact data (V3 territory)
- Technical buyers wanting an API (under 10% of V1 TAM)
- Agencies wanting shared team workspaces (V2 territory)
- Mobile-first users requiring a native app (web app is the V1 surface)
- Buyers wanting outreach automation, sequences, or CRM (V2 territory)

## 2.3 Key User Journeys

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
