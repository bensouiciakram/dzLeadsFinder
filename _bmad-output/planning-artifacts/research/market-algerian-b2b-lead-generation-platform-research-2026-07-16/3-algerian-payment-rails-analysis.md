# 3. Algerian Payment-Rails Analysis

## Required Table-Stakes

CIB (Interbank Card) and EDahabia (Algeria Post card) processing is **non-negotiable** for an Algerian-priced B2B tool. Stripe direct does not work for most Algerian cards; PayPal is technically allowed but operationally painful; BaridiMob is rising but not yet universal.

## PSP Options (verified grounded; MEDIUM confidence on current fees)

| PSP | Algerian cards supported | Setup | Settlement | Fees (approx) | Verdict |
|---|---|---|---|---|---|
| **Chargily** | CIB + EDahabia | Easy, online signup | Bank transfer (Baghli Bank / public bank account) | ~1.5-2.5% + fixed per tx | ✅ **RECOMMENDED** — used by DzLeads (verified on dzleads.io), fast to integrate, modern |
| **Satim (via bank partner)** | CIB + EDahabia | Heavy — requires company + bank partnership + application | Bank account credit (T+2-T+7) | ~1.5-3% | Viable but setup takes 4-8 weeks; overkill for V1 |
| **BaridiMob BARidIMP** | BaridiMob accounts only | Medium — BaridiMob merchant signup | BaridiMob account | ~1-2% | Optional add-on for V1.5; not sufficient alone for V1 |
| **Stripe (Moonpay workaround)** | Some CIB cards (50-70% success rate) | Easy if inc. abroad | USD bank deposit (FX risk) | ~3-5% | ❌ Not viable as primary; user already chose local rails |

## Recommendation

- **Start with Chargily** for V1 (matches DzLeads, modern API, fast setup).
- **Market "Chargily / CIB / EDahabia"** visibly on the pricing page as a trust signal — DzLeads does this; you should too.
- **Add BaridiMob in V1.5** for buyers who prefer BaridiMob wallet payments.
- **Do not pursue Stripe direct** for V1 — Algerian card success rates will cause checkout abandonment and refund pain.

## Implementation Note for the Architect Stage

Chargily has a hosted-checkout flow (redirect to Chargily, callback with webhook). It avoids PCI scope entirely. Use Chargily's hosted checkout — V1 does not need a custom card form.
