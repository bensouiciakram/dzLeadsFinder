# 11. Constraints and Guardrails

## 11.1 Privacy
- Personal emails and phone numbers ARE personal data under Algerian Loi 18-07 du 10 juin 2018, even in B2B role-based context. The /privacy page must explain this scope, and the data-subject request process must respond within 30 days.
- The ANPDP declaration reference is required on /privacy once filed; until filed, /privacy must commit to filing and a status note.
- A published takedown/contact address must accept both individual opt-out and company-level opt-out requests.
- Re-reveal idempotency (FR-14) limits over-charging but does not affect privacy; data-subject opt-out removes the record from search results within 72h of confirmation.

## 11.2 Compliance and Regulatory
- Algerian data-protection law (Loi 18-07) governs this product. V1 operates in Algeria on Algerian-resident personal data; no cross-border data transfer to non-Algerian jurisdictions is in scope (matches V1 non-goal: no international data).
- No CNRC-scraped data and no LinkedIn-scraped data in V1 (per the data-sourcing legality brief). Public web-published LinkedIn URLs (where a company publishes them on its own site) are allowed; scraped LinkedIn URLs are not.
- The data-sourcing legality brief is explicitly NOT a legal opinion; a formal Algerian legal review is required before V2 adds CNRC data. Flagged in §8 Open Questions.
- Chargily is a regulated PSP; its ToS and webhook format govern the integration. Refund handling (FR-26) and chargeback response follow Chargily's published policies.

## 11.3 Cost Guardrails
- V1 is a 3–4 week MVP. Any feature whose implementation estimate exceeds ~3 dev-days triggers a scope conversation, not silent inclusion.
- Add-on credit pack economics must clear the gross margin floor: pack price must cover per-credit data-acquisition cost (Google Places API quota, ops scraper time) plus a target margin ≥60%. The 500 DZD/75 pack at 6.7 DZD/contact and the 1,500 DZD/250 pack at 6.0 DZD/contact clear this floor at V1's data-cost baseline; revisit if per-credit data-cost exceeds 2.0 DZD.
- Google Places API cost is the dominant variable data cost. V1 must cap Google Places API monthly spend at an ops-config threshold; on breach, the scraper gracefully pauses the Google source and continues with other sources.
- Facebook ads test budget is 20,000 DZD (~$150) for the launch campaign; this is a marketing budget, not a build item, and is documented in the research GTM shard.

## 11.4 Platform
- Web application only. Mobile browsers are supported responsively. No native mobile app, no PWA install prompt in V1 [ASSUMPTION: PWA install prompt deferred — confirm with PM if a V1 install-prompt is wanted; it is cheap but adds polish scope].
- Hosted in a single region close to Algeria; latency-sensitive surfaces (search, reveal) are served from the same region as the data layer.
