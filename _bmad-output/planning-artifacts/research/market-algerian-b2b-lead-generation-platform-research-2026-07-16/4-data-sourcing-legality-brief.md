# 4. Data-Sourcing Legality Brief

## Risk-Flagging Approach

This is a **brief risk note + mitigations**, not a legal opinion. You must consult an Algerian lawyer before commercializing CNRC-scraped data. Confidence: MEDIUM (analyst view grounded in Algerian data-protection context); not legal advice.

## Per-Source Risk Flags

**1. CNRC (Registre National du Commerce)**
- Risk: HIGH. The commercial register is a public-actor data source (Ministry of Commerce). Scraping it may violate ToS, and re-commercializing the data without licensing may breach Algerian commercial data regulations. Post-publication bans on bulk redistribution are plausible.
- Mitigation:
  - **Do NOT scrape CNRC in V1.** Defer CNRC data to V2 after a legal opinion is obtained.
  - V1 can include a "Data sourced from: Pages Jaunes, El Mouchir public listings, Google Maps, web enrichment" notice instead.
- Confidence: MEDIUM (legal posture unverified; the safe path is to defer).

**2. Pages Jaunes Algérie (pagesjaunes-dz.com / yellow pages)**
- Risk: MEDIUM. Pages Jaunes is a private directory; its ToS almost certainly prohibits automated scraping and redistribution. Public business-directory data is generally considered lower-sensitivity than personal contacts, but ToS terms still apply.
- Mitigation:
  - Rate-limit aggressively; cache locally but never expose "scraped from Pages Jaunes on [date]" in the UI.
  - Add a clear process for takedown requests in /privacy.
- Confidence: MEDIUM.

**3. El Mouchir (mouchir.com / official public-tender & directory magazine)**
- Risk: LOW-MEDIUM. El Mouchir publishes public-tender information which is inherently public. Directory data may still carry ToS restrictions.
- Mitigation: tenders OK; directory entries enriched with public company info OK; avoid wholesale redistribution of "El Mouchir's directory dump" as a product.
- Confidence: MEDIUM.

**4. Google Maps (Places API and/or scraping)**
- Risk: LOW if using official Places API; HIGH if scraping Google Maps directly (ToS violation, IP-blocking risk).
- Mitigation:
  - **Use Google Places API** with quota; pay Google's per-call pricing; this is the safest path.
  - This is a defensible, legitimate V1 data source — a competitive edge because Linkiw lists "Google Maps" without clarifying its scraping methodology.
- Confidence: HIGH (Google Places API ToS is clear; peace-of-mind source).

**5. LinkedIn**
- Risk: HIGH. LinkedIn's ToS explicitly prohibits scraping (hiHive v. LinkedIn precedent established CFAA). Linkiw lists LinkedIn in its cascade-drop zone — this is a known legal grey zone.
- Mitigation:
  - **Do not scrape LinkedIn in V1.** Do not show LinkedIn URLs that came from automated scraping.
  - You may show **publicly provided** LinkedIn URLs in company records where the company itself publishes them on its website (public web source, not LinkedIn-scrape).
- Confidence: HIGH (LinkedIn's position is well-documented).

## Algerian Data-Protection Context (Loi 18-07 du 10 juin 2018)

Algeria's data-protection law (Loi 18-07) regulates personal-data processing. Key implications for the user's V1:
- Business contact data (B2B role-based: "CEO of Cevital, email X") is generally considered lower-risk than consumer PII, but **personal emails and phone numbers ARE personal data** under the law.
- Requires declaring data processing to the Algerian data-protection authority (Autorité nationale de protection des données personnelles, ANPDP).
- **Mitigation:** V1 should publish a clear /privacy policy explaining (a) what is collected, (b) verification methodology, (c) data-subject takedown process, (d) ANPDP declaration reference (once filed). This becomes a trust differentiator versus incumbents that don't address it.

## Recommended V1 Data Mix (Safe Order)

1. ✅ **Google Places API** (LOW RISK) — start here, this is your safest moat
2. ✅ **El Mouchir public tenders + directory public pages** (LOW-MEDIUM) — enrich company-level data
3. ✅ **Pages Jaunes directory scrape** (MEDIUM) — rate-limited, mitigated, takedown process published
4. ⚠️ **CNRC registry defer** to V2 — get a legal opinion before commercializing
5. ⚠️ **LinkedIn never scrape** in V1 — too risky for an MVP

## Architectural Note

The V1 scraper pipeline (Playwright-based, per user's skills) should treat each source as an independent module with its own ToS flag, rate-limit policy, and takedown-compliance mechanism. This makes it easy to disable any source if a complaint arrives.
