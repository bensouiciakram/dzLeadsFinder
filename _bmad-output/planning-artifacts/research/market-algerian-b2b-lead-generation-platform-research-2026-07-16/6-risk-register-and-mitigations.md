# 6. Risk Register and Mitigations

## Market Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Incumbent reacts with a sub-2000 DZD tier | MEDIUM | MEDIUM-HIGH | Lock in early adopters; differentiate on Arabic + 58-wilaya accuracy, not just price |
| New Algerian entrant copies your wedge | LOW-MEDIUM (Algerian data acquisition is the moat) | MEDIUM | Build data-freshness + verification methodology as moat |
| Apollo enters Algeria directly | LOW (next 18 mo) | LOW (different segment) | Stay focused on SMB segment that Apollo won't pursue |
| Algerian SMB tool budgets shrink (economic volatility) | MEDIUM | MEDIUM | Offer generous free tier + add-on packs (low-commitment model) |

## Regulatory Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| CNRC scraper licensing issue forces shutdown | MEDIUM (if scraped) | HIGH | **Do not scrape CNRC in V1**; defer to V2 after legal opinion |
| Pages Jaunes / El Mouchir ToS complaint | LOW-MEDIUM | LOW | Rate-limit + immediate takedown-compliance process; /privacy page |
| Loi 18-07 ANPDP non-compliance | MEDIUM | MEDIUM | File ANPDP declaration pre-launch; publish /privacy policy explaining processing |
| GDPR-style consumer-rights complaint | LOW (B2B-only, Algeria-only) | LOW | /privacy page + takedown mechanism |

## Operational Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Chargily outage / payment fraud | LOW | MEDIUM | Offer add-on credit packs (offline bank transfer alternative) for buy-side fallback |
| Data freshness falls behind promise | MEDIUM | HIGH | Make freshness a published cadence; don't over-promise. Quarterly-reverifield is realistic V1 |
| Solo founder burnout (1-person ops) | MEDIUM | HIGH | Strict V1 scope discipline; defer all V2 features. Use freelancers for marketing content + customer support if needed |
| Scraper breakage (source-page HTML changes) | HIGH | MEDIUM | Modular source adapters; alerting on schema mismatches; fall back to last-good cache |

## Competitive Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| DzLeads drops price to 1,000 DZD/mo | LOW-MEDIUM | HIGH | Compete on Arabic + 58 wilayas (harder for them to add than to copy pricing); add value (verification transparency, WhatsApp support) |
| Linkiw adds a sub-10K DZD monthly tier | MEDIUM | HIGH | Move to V1.5 fast — add mid-tier + saved searches before Linkiw re-tiers |
| Either incumbent publishes customer reviews | MEDIUM | MEDIUM | Be first — land 3 published case studies before competitors react |
