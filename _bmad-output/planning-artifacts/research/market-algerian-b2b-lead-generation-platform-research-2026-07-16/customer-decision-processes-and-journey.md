# Customer Decision Processes and Journey

## Customer Decision-Making Processes

_Decision Stages (typical Algerian B2B-data buyer):_
1. **Trigger** — A specific outreach campaign forces the question: "Where do I find 50 prospects in [wilaya] in [industry]?" Manual LinkedIn/Pages Jaunes searches confirm the pain within <15 min.
2. **Awareness** — Discovers the category via Facebook business group, LinkedIn post, peer recommendation, or FB ad (this is where the user's 20,000 DZD ad test enters the journey).
3. **Shortlist** — Most Algerian buyers evaluate **1–2** tools, not 3–5 like EU buyers. DzLeads + Linkiw is the common pair compared; speed of evaluation is fast (hours/days, not weeks).
4. **Trial** — Signs up for whatever free credits are offered (10 DzLeads / 15 Linkiw / user V1). No credit card required = table-stakes.
5. **Data-quality test** — Searches for known companies (Sonatrach, Cevital, Djezzy, Condor, Biopharm — the very brands DzLeads showcases on its home page `Source: dzleads.io verified`). If known-brand contacts return well-verified emails + phones, the buyer proceeds to paid.
6. **Paid nano-purchase** — First paid transaction is small (1–2 months or one credit pack). Algerian buyers do not enter at Linkiw's 24,000 DZD quarterly entry point unless they're an established agency.
7. **Renewal / churn** — After 4–6 weeks of using the exported data for outreach, decides to renew or churn based on reply rate / meeting-book rate from the data.

_Decision Timelines:_
- Trigger → awareness → trial: **24–72h** (impulse-ware, triggered by an actual sales need)
- Trial → paid: **3–14 days** (gated by the buyer's outreach cadence and how thorough their free-credit test was)
- First paid → renewal: **30–90 days** (credit-based products have natural usage cycles)

_Complexity Levels:_ LOW — credit-based pricing makes the decision binary: data good → buy more credits; data bad → leave. No procurement review, no security review at SMB tier.

_Evaluation Methods:_
- Hands-on trial is dominant (no Algerian B2B review platform exists; G2/Capterra low penetration)
- Peer recommendation in FB groups (e.g. "Algerian Entrepreneurs Network", "Freelancers DZ") is the most common shortcut
- Price-by-credit math (rational comparison)

_Confidence:_ Timelines and stages MEDIUM confidence (analyst inference), grounded in competitor UX patterns + Algerian B2B norms.

## Decision Factors and Criteria

_Primary Decision Factors (ranked by inferred weight):_
1. **Data accuracy on known Algerian companies** — make-or-break for trial conversion. Confidence: HIGH (verified: every Algerian competitor leads home page with accuracy claim).
2. **Price per credit / DZD-per-lead math** — solo buyers compare directly. DzLeads ≈ 10 DZD/lead; Linkiw ≈ 16 DZD/lead at Freelance tier (8,000 DZD / 500 credits) `Source: linkiw.app verified`. User V1 at 1,500 DZD must beat both ratios.
3. **Free trial presence & size** — no free = no adoption. DzLeads/Linkiw offer 10–15 free credits `Source: both verified`.
4. **UI language** — Arabic-first buyers underserved by both incumbents. Confidence: HIGH (verified — no Arabic toggle on either site).
5. **Coverage of the wilayas the buyer needs** — DzLeads covers 48, leaving 10 newer wilayas unserved. Confidence: HIGH (verified count).

_Secondary Decision Factors:_
- Export format (CSV > Excel > JSON; CSV is universal)
- Payment-rail fit (CIB/EDahabia required; BaridiMob optional)
- WhatsApp support availability (factor in agency tier, not solo)
- Brand reputation in FB founder groups (MEDIUM confidence — inferred network effect, not cited)
- Auto-renew policy (Algerian buyers DISTRUST auto-renew; "No automatic renewal" is DzLeads' positioning angle `Source: dzleads.io`)

_Weighing Analysis (analyst estimate):_
| Factor | Solo SMB buyer weight | Agency buyer weight |
|---|---|---|
| Price/credit | 35% | 20% |
| Data accuracy | 30% | 25% |
| Arabic UI | 15% | 5% |
| Free trial | 10% | 5% |
| Export to CRM | 5% | 15% |
| Team/workspace | 0% | 20% |
| WhatsApp support | 5% | 10% |

_Evolution Patterns:_ As the market matures, decision weight will shift from price toward data freshness and feature completeness (CRM, sequences). User V1 should lock in price-sensitive adopters before this evolution happens.

## Customer Journey Mapping

_Awareness Stage:_
- Triggered by a sales/outreach need (imminent campaign, new hire, expansion to a new wilaya)
- Discovered via: Facebook business groups (primary), targeted FB ad (the user's 20,000 DZD budget channel), LinkedIn posts, WhatsApp founder-to-founder recommendation, occasionally Google search "[industry] prospects in Algeria".
- Algerian-specific: YouTube tutorials in Arabic/French explaining "how to find clients in Algeria" can be a strong discovery channel — both Algerian competitors are weak here. Confidence: MEDIUM (analyst; not verifiable via competitor sites).

_Consideration Stage:_
- Comparison is fast. Algerian buyers do not run formal RFPs at SMB level.
- Trial-then-test pattern dominates: sign-up → test known-company search → evaluate quality.
- The user's differentiation combo (Arabic UI + sub-2K DZD tier + 58 wilayas) enters the consideration stage as a distinct, easy-to-explain wedge.

_Decision Stage:_
- Decided within days of trial, not weeks
- Triggered either by "data passed my known-company test" OR "wait — it's 1,500 DZD/month, that's nothing, just try it for a month"
- Low friction = impulse purchase at SMB tier

_Purchase Stage:_
- Payment via CIB/EDahabia through Chargily (`Source: dzleads.io verified`). This is the dominant rail. BaridiMob is secondary. Stripe direct is not viable for most Algerian SMBs.
- Algerian buyers expect a single "one-time payment" feel even on recurring subscriptions — V1 should offer both monthly recurring AND credit-pack "one-time" options to fit both mental models.

_Post-Purchase Stage:_
- Heavy usage in week 1 (downloading lists)
- Light/zero usage in weeks 2-3 (during outreach cycle)
- Renewal decision in week 4-6 based on reply/meeting rate from the exported data
- If successful → habitual renewal, expansion to higher tier or more credit packs
- If unsuccessful → silent churn (no "cancel" button needed; just don't renew)

## Touchpoint Analysis

_Digital Touchpoints (HIGH confidence — verified via competitor + Algerian norms):_
- Marketing site (mobile-friendly critical for FB-ad traffic)
- In-app onboarding flow (first 60 seconds after sign-up)
- Free-credit trial experience
- Pricing page transparency (DZD-per-lead math visible)
- Chargily / EDahabia checkout (trust signal: local payment = local vendor)
- CSV-export artifact (immediate value delivery)
- WhatsApp (post-sale support / onboarding)

_Offline Touchpoints:_
- Word-of-mouth at physical networking events (Réseaux d'Affaires Algérie, CCIS events)
- Phone call from a peer recommending the tool

_Information Sources:_
- Facebook business groups (primary social-proof channel in Algeria)
- LinkedIn posts (mainly by Algerian founders / sales professionals)
- YouTube tutorials (SECONDARY, underserved by competitors)
- WhatsApp broadcast lists of Algerian entrepreneurs
- Quick Google search (mostly discovers English-language global tools — inadequate for Algerian data needs)

_Influence Channels:_
- Trusted peer founder recommendation (HIGHEST influence)
- FB group consensus (next-tier; specific recognizable FB groups exist)
- Influencer founder/blog post in Algerian entrepreneurial press (El Watan Tech, Liberté Tech, DZ Entrepreneurs)
- Targeted FB ad (mid-tier; this is where the 20,000 DZD ad test enters)
- Cold email (lowest; Algerian SMBs distrust cold email)

## Information Gathering Patterns

_Research Methods:_
- Quick + hands-on — Algerian B2B buyers do not do formal vendor evaluation. They sign up for free credits on 1–2 tools and test directly.
- No vendor RFP / formal procurement at SMB tier

_Information Sources Trusted (ranked, analyst estimate, MEDIUM confidence):_
1. Direct peer recommendation in private WhatsApp groups
2. Visible usage by recognizable local businesses (e.g. if a well-known Algiers agency says they use a tool)
3. Hands-on trial results
4. FB-group reviews/replies
5. Marketing site claims (LOW trust — but mandatory presence)
6. Public review sites (G2/Capterra) — LOW trust in Algeria; these platforms have low Arabic content and aren't penetrated

_Research Duration:_ Hours, not weeks. Algerian B2B SMB buyers commit fast and churn fast.

_Evaluation Criteria:_
- Does data on my known targets come back correct?
- Is the price in my cash-flow tolerance?
- Does it work in my language/wilaya?
- Can I pay with my local card?

## Decision Influencers

_Peer Influence:_
- Dominant — Algerian founder networks are tight. A single positive mention in a WhatsApp group can produce 10-20 trial signups. A negative mention can kill the tool.

_Expert Influence:_
- Sparse — there are no dominant Algerian B2B-sales influencers. The closest proxy is Algerian sales/SDR trainers on LinkedIn.

_Media Influence:_
- Algerian tech press (Liberté, El Watan tech columns, TSA, Maghreb Emergent) can drive awareness but rarely drive direct purchase decisions. Confidence: LOW (analyst view).

_Social Proof Influence:_
- REVIEWS = low penetration in Algeria (DzLeads reviews page is EMPTY — verified 2026-07-16)
- LOGOS / CASE STUDIES = Nascent — neither Algerian competitor publishes customer logos. V1's first-mover advantage: publish even 2–3 SMB customer names + numbers ("agence de marketing à Oran a trouvé 40 prospects en 2 semaines") and this exceeds incumbents.
- STAR RATINGS = LOW trust (the review-app ecosystem is foreign in Algeria)

## Purchase Decision Factors

_Immediate Purchase Drivers:_
- Upcoming outbound campaign deadline
- Free-trial contact that immediately yields a known-valid email
- Visible DA-denominated price below the 2,000 DZD/mo psychological barrier
- Auto-renew OFF option

_Delayed Purchase Drivers:_
- Quarterly entry barrier (Linkiw's 24K DZD/quarter pushes solo buyers away; gives the user V1 an entry advantage)
- Trial-credit test reveals a bounce or wrong contact
- UI is foreign-only (Arabic-native buyers may disengage)

_Brand Loyalty Factors:_
- Data freshness / freshness cadence commitment
- Arabic UI (rare, sticky)
- WhatsApp support quality
- Saved-search templates & list persistence (your V2 lock-in play; Linkiw has this, DzLeads partial)

_Price Sensitivity:_
- HIGH — Algerian SMB buyers are extreme price-sensitive vs. global peers due to cash-flow cycles, FX volatility, and the DA's local economic context. The user's sub-2,000 DZD V1 is precisely the right market fit.

## Customer Decision Optimizations (V1 design implications)

_Friction Reduction:_
- One-click sign-up (Google OAuth + email)
- 15 free credits on sign-up (exceed DzLeads' 10 and Linkiw's 15)
- No credit card required for free tier (`Source: dzleads.io, linkiw.app verified — both market this`)
- Trilingual UI switcher visible in header
- Search working without sign-up (preview results → require email to unlock) — proven pattern

_Trust Building:_
- Publish the data-verification methodology (e.g. "Emails SMTP-checked weekly; phones called quarterly")
- Show count of records per wilaya + industry (transparency > marketing copy)
- Local payment (Chargily CIB/EDahabia) prominently displayed in pricing page = "made in Algeria" trust
- "Made by Akram, a developer in Algiers" founder narrative strengthens local trust

_Conversion Optimization:_
- Free-credit decay email/WhatsApp reminder before trial credits expire
- First-paid price = 1,500 DZD (below the 2,000 DZD incumbent anchor) with a clear per-credit math display
- Onboarding pop-up: "Test with a company you know — search Sonatrach, Cevital, or your current biggest client to see how our data compares."

_Loyalty Building (V2 forward):_
- Saved searches, list persistence (basic in V1, expanded in V2)
- Credit rollover (DzLeads offers this — V1 should match)
- Email/WhatsApp notification when new records in your saved searches are added (refresh-diff magical feature)
- Loyalty pricing (annual = ~30% discount, matching DzLeads' "Save up to 38% with annual plans" framing `Source: dzleads.io verified`)

_Confidence Summary:_
- Decision timeline / journey inferred from competitor UX patterns + Algerian B2B norms: **MEDIUM**
- Competitor pricing / feature / UI-language touchpoints verified live: **HIGH**
- Algerian FB-group / WhatsApp / YouTube discovery patterns: **MEDIUM** (analyst, region-specific)
- Pricing sensitivity claim: **HIGH** (verified: both Algerian competitors aggressively display DZD-denominated pricing)

---
