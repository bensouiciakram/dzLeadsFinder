# Market Research Conclusion

## Summary of Key Findings

1. **Validated wedge** — Price (sub-2,000 DZD/mo) + Arabic UI + 58-wilaya accuracy is independently unmet by every Algerian competitor (HIGH confidence).
2. **Revenue model** — Adopt a single-tier subscription + add-on credit packs (Option A hybrid), with 1,500 DZD/mo for 200 credits as the V1 paid anchor, scaled upward via V1.5 mid-tier and V2 sequences/CRM ops.
3. **Payment rails** — Chargily (CIB + EDahabia) is non-negotiable and is what DzLeads uses; defer BaridiMob to V1.5; skip Stripe.
4. **Data legality** — Google Places API + El Mouchir + Pages Jaunes is the V1-safe mix. Defer CNRC to V2 pending legal opinion. Never scrape LinkedIn.
5. **GTM** — 20K DZD FB test targeted at (a) SMB founders in mega-cities, (b) freelancers/agencies, (c) retargeting. Success threshold: 100+ free signups, 10+ paid users.
6. **Revenue trajectory** — illustrative path: 50K DZD MRR month 1 → 500K-1M DZD MRR month 6 → 2-5M DZD MRR month 12 (uncapped; V2/V3 upsell ladder is the mechanism, not a target).

## Strategic Impact Assessment

The triple wedge + uncapped revenue ladder gives you a defensible path into the Algerian B2B lead-data market. Primary risk is competitive reaction within 3-6 months — speed of V1 execution matters more than feature breadth. Do not over-build; ship the wedge.

## Next Steps Recommendations

1. ✅ Transition to **John (PM) — bmad-prd** to draft the V1 PRD with locked-in scope: trilingual UI, search+filter, CSV export, Chargily billing, 15 free credits, 1,500 DZD/mo paid tier, 200 credits. Explicit non-goals listed in this synthesis.
2. ✅ Then transition to **Winston (Architect) — bmad-architecture** for stack decision (Next.js + Django/DRF or Next.js + Supabase + Playwright + Postgres), Chargily integration design, data-source module architecture.
3. ✅ Concurrent legal consultation with an Algerian lawyer on CNRC + Pages Jaunes data sourcing — independent of the build path (do not block V1 on this).
4. ✅ Concurrent ANPDP declaration preparation — file before V1 launch.

---

**Market Research Completion Date:** 2026-07-16
**Research Period:** 6-step BMad market-research workflow
**Source Verification:** All competitor pricing and UI-language facts live-verified on 2026-07-16
**Market Confidence Level:** HIGH for competitive/pricing findings; MEDIUM for buyer-psychology findings; LOW (with explicit flag) for long-term outlook

_This comprehensive market research document serves as the authoritative market reference for the Algerian B2B lead-generation platform and informs the V1 PRD and architecture decisions that follow._