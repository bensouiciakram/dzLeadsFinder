# 10. Cross-Cutting NFRs

- **NFR-1: Performance.** Average first-search-results page must render in ≤2.5s at the 95th percentile on a 4G Algerian mobile connection; reveal action must return within ≤1.5s at the 95th percentile.
- **NFR-2: Availability.** The application must target 99.5% monthly availability for V1 (≈3.5h downtime/mo allowance). Search and export must stay available even when the upstream data scraper pipeline is paused.
- **NFR-3: Observability.** Every reveal, export, payment, and credit-purchase emits a structured event to the application log with user id (hashed), event type, amount, and timestamp; logs are retained 90 days.
- **NFR-4: Localisation correctness.** No string appears in the UI in a non-matching locale. CI must fail the build on missing-translation keys for any of AR/FR/EN; the build flag list is the same three locales for V1.
- **NFR-5: Browser support.** V1 supports the latest two major versions of Chrome, Safari, Edge, and Firefox on desktop, and the latest two mobile Chrome (Android) and Safari (iOS) versions. Internet Explorer is not supported.
- **NFR-6: Accessibility.** Public pages (/, /how-we-verify, /about, /privacy, /terms, /wilayas, the signup flow, the login flow) target WCAG 2.1 AA. Authenticated app surfaces target WCAG 2.1 A as a V1 floor with AA commitments for any form or interactive surface.
- **NFR-7: Data refresh.** The People and Company dataset is refreshed on a per-source schedule maintained in an ops config; the slowest source refreshes at least once every 30 days. Stale records carry a "last verified on" timestamp surfaced on reveal.
- **NFR-8: Secrets.** No Chargily key, third-party API key, or scraper credential lives in the client bundle or in the application log. Secrets are server-only and rotated quarterly.
