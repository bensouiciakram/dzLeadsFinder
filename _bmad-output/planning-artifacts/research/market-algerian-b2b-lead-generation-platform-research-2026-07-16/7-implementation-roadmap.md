# 7. Implementation Roadmap

## Phase 1 — Foundation (Weeks 1-2, ~10 dev hours/week)
- Next.js trilingual UI scaffolding (AR/FR/EN, RTL support baked in)
- Supabase auth (Google OAuth + email)
- Postgres schema for People, Companies, Sources, Credits, Plans
- Basic Chargily integration with hosted-checkout + webhook

## Phase 2 — Product (Weeks 2-4, ~20 dev hours)
- Search + filter UI (industry, wilaya, seniority, size, keywords)
- People + Company dual search
- CSV/Excel export with credit deduction
- Free-credit model (15 free, no card)
- First paid tier (1,500 DZD/mo, 200 credits)
- Add-on credit packs as one-time Chargily payments

## Phase 3 — Data Pipeline (concurrent with Phase 2, ~10 dev hours)
- Google Places API importer (LOW RISK, primary)
- Pages Jaunes scraper module (Playwright, rate-limited)
- El Mouchir public-pages importer
- Postgres storage with source_id + last_verified_at columns

## Phase 4 — Launch (Week 4-5)
- Trilingual landing page with FB ads-ready conversion flow
- /how-we-verify public page
- /privacy page with ANPDP declaration reference
- WhatsApp support number activated
- Founder /about page

## Phase 5 — Ads Test (Week 5-6)
- Launch 20K DZD Facebook ads test across 3 audiences
- 14-day measurement window
- Retargeting activated after week 1

## Phase 6 — V1.5 Decision (Week 8-12)
- If 10+ paid users from FB test → scale FB budget, build V1.5 mid-tier
- If <5 paid users → pivot positioning (try English/Darija ad copy, lower free-credit friction)
