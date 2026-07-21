# 3. Glossary

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
