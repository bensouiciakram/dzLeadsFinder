# Architecture Spine — Algerian B2B Lead Platform V1

- **Status:** final
- **Created:** 2026-07-19
- **Updated:** 2026-07-19
- **Sources:** UX spines (DESIGN.md, EXPERIENCE.md, .memlog.md), PRD shards
- **Paradigm:** Split-stack: Next.js App Router (frontend + SSR) + Django REST Framework (API + Celery + Scrapy)

---

## System Architecture Overview

```
CADDY REVERSE PROXY (mydomain.com — auto TLS)
  │
  ├── /api/*  → proxy_pass http://django:8000/
  ├── /admin/* → proxy_pass http://django:8000/
  └── /*       → proxy_pass http://nextjs:3000/
       │
       ├── Next.js (Docker)
       │   ├── Server Components (public pages: /, /about,
       │   │   /how-we-verify, /privacy, /terms, /wilayas)
       │   ├── Client Components (search, reveal, export,
       │   │   billing, settings)
       │   └── Locale Middleware (Accept-Language → dir)
       │
       └── Django REST Framework (Docker) ─────────────┐
           ├── Auth (djoser + simplejwt)                │
           ├── Search + Reveal + Export endpoints       │
           ├── Billing + Chargily checkout creation     │
           ├── Chargily Webhook Handler (CSRF-exempt)  │
           ├── Django Admin (ops panel)                 │
           ├── Celery Worker ──────────────────────────┐│
           │   ├── grant_credits (reconciliation)       ││
           │   ├── send_*_email                        ││
           │   ├── check_low_credits (daily beat)      ││
           │   └── hard_delete_expired (daily beat)    ││
           └── Scraper Pipeline (management commands)  ││
               ├── Google Places API (ops-config cap)   ││
               ├── El Mouchir                           ││
               └── Pages Jaunes (rate-limited)          ││
                                                        ││
POSTGRESQL + REDIS (same Docker network) ◄─────────────┘┘
```

**Data flow (sync — search/reveal/export):**
```
Browser → Caddy → /api/search/people
  → Django (validate JWT from httpOnly cookie, query DB, return)
  → Caddy proxies response back to Browser
```

**Data flow (async — payment webhook):**
```
Chargily → Caddy → POST /api/webhooks/chargily/ (Django, CSRF-exempt)
  → Django validates HMAC signature
  → INSERT payment_transactions (idempotent check)
  → Celery task grant_credits.delay(payment_id)
  → 200 OK to Chargily within 5s
  → (async) Celery: credit_ledger + email
```

**Data flow (async — scraper):**
```
Django management command (Celery beat or system cron)
  → Scrapy/Requests → parse → Django ORM bulk upsert
  → people/companies tables updated
```

---

## Inherited Invariants

These are binding constraints from the UX spines and PRD — the architecture does not re-decide them.

| Constraint | Source | Detail |
|---|---|---|
| shadcn/ui + Tailwind, logical-property CSS only | DESIGN.md §Layout, FR-2 | No `margin-left/right`, `padding-left/right`, `left:`, `right:`, `text-align: left/right` anywhere |
| Western Arabic numerals (0-9) in all locales | DESIGN.md §Typography (FR-15), EXPERIENCE.md §Trilingual | Never Eastern Arabic numerals; `tabular-nums` on credit surfaces |
| Trilingual (AR/FR/EN) with instant dir flip | EXPERIENCE.md §Trilingual & RTL | No page reload, preserves full search state, text-only ≤150ms fade |
| Credit metering: atomic deduction, live balance | EXPERIENCE.md §Credit Metering | Optimistic UI with rollback; re-reveal idempotent ≤30d |
| Export: CSV always (free: 5-row cap + watermark), xlsx paid-only | EXPERIENCE.md §Export Gating (FR-17–FR-20) | Watermark is literal header/footer rows in file, not visual overlay |
| Payment: Chargily only (CIB/EDahabia) | PRD FR-24–FR-28 | No foreign cards; webhook idempotent; ≤60s polling |
| Subscription 1,500 DZD/mo (200 credits) + two packs (500/75, 1,500/250) | PRD FR-24–FR-25 | Pack credits never expire |
| Failed renewal: persistent non-dismissible banner | EXPERIENCE.md FR-28 | Credits usable through current cycle |
| Performance: first search ≤2.5s p95, reveal ≤1.5s p95 on 4G | EXPERIENCE.md §Foundation (NFR-1) | Binding behavioral constraint |
| WCAG 2.1 AA public pages, A+AA-interactive on app | EXPERIENCE.md §Accessibility Floor (NFR-6) | Skip links, aria-live, focus management, 44px touch targets |
| Light mode only (V1) | DESIGN.md §Colors | No dark-mode tokens defined |
| No native app, responsive web only (V1) | PRD §6.2 | Mobile web first-class; no PWA install prompt (assumption deferred) |

---

## AD-1: Next.js 14 App Router (frontend) + Django REST Framework (backend)

**Binds:** Framework split for the product.
**Prevents:** Monolithic Django (HTMX can't satisfy rich client-state requirements); pure Next.js API with no dedicated background worker (payment reconciliation reliability risk).
**Rule:**
- **Next.js** owns: SSR of all pages (public + app shell), client components for interactive surfaces (filters, reveal, export modal, billing polling, locale switch), locale middleware, i18n string serving.
- **Django REST Framework** owns: all business API endpoints (auth, search, reveal, export, billing), database ORM, Celery background jobs, Chargily webhook handler, Django Admin for ops, scraper pipeline.
- The client calls Django API endpoints directly through Caddy. Next.js has zero API route handlers, zero auth code, zero proxy logic.
- Server Components for all public pages. The authenticated app shell is SSR with client islands. No client-only routing for public pages.

## AD-2: shadcn/ui + Tailwind CSS 4 — Logical-Property Enforcement

**Binds:** UI component library.
**Prevents:** Component-by-component RTL hacks; hex hardcodes; broken layout after dir flip.
**Rule:**
- `tailwind.config` maps DESIGN.md tokens to CSS custom properties.
- All layout uses Tailwind 4 logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`).
- CI enforces: `stylelint` bans `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left:`, `right:`, `text-align: left/right`.
- Brand swap = one token file changed. No component hardcodes a hex.

## AD-3: PostgreSQL (Single Store)

**Binds:** Primary data store.
**Prevents:** MongoDB; Redis as primary store; in-memory state.
**Rule:** All user, credit, ledger, search, reveal, subscription, payment, export, and saved-search data lives in PostgreSQL. Full-text search via `tsvector` with Arabic/French/English configs. All credit and payment mutations run in `SERIALIZABLE` transactions. Django ORM is the sole writer to the database (Next.js never writes directly — it serves pages and lets the client call Django through Caddy). The scraper pipeline writes to the same database via Django ORM management commands. Redis is used exclusively as a Celery broker + result backend, never as a primary data store.

---

## Data Model

```sql
-- CORE TYPES
CREATE TYPE user_tier AS ENUM ('free', 'starter');
CREATE TYPE credit_event_type AS ENUM (
  'free_signup', 'subscription_grant', 'pack_grant', 'promotional_grant',
  'reveal_debit', 'export_row_debit', 'expiry'
);
CREATE TYPE subscription_status AS ENUM ('active', 'failed_renewal', 'cancelled', 'expired');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE export_format AS ENUM ('csv', 'xlsx');

-- USERS
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  locale              TEXT NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'fr', 'en')),
  tier                user_tier NOT NULL DEFAULT 'free',
  credits_balance     INTEGER NOT NULL DEFAULT 0,
  email_verified_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  deletion_scheduled_at TIMESTAMPTZ
);

-- CREDIT LEDGER (source of truth)
CREATE TABLE credit_ledger (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id),
  event_type    credit_event_type NOT NULL,
  amount        INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  pool          TEXT NOT NULL DEFAULT 'subscription' CHECK (pool IN ('subscription', 'pack')),
  reference_id  TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id),
  tier                   user_tier NOT NULL DEFAULT 'starter',
  status                 subscription_status NOT NULL DEFAULT 'active',
  current_period_start   TIMESTAMPTZ NOT NULL,
  current_period_end     TIMESTAMPTZ NOT NULL,
  chargily_subscription_id TEXT,
  cancelled_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAYMENT TRANSACTIONS
CREATE TABLE payment_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  chargily_event_id   TEXT UNIQUE NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('subscription_creation','subscription_renewal','pack_purchase')),
  amount_dzd          INTEGER NOT NULL,
  status              payment_status NOT NULL DEFAULT 'pending',
  credits_granted     INTEGER,
  chargily_checkout_url TEXT,
  chargily_metadata   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at       TIMESTAMPTZ
);

-- SEARCHES
CREATE TABLE searches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL CHECK (type IN ('people','company')),
  filters       JSONB NOT NULL,
  results_count INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SAVED SEARCHES
CREATE TABLE saved_searches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('people','company')),
  filters     JSONB NOT NULL,
  sort        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REVEALS
CREATE TABLE reveals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  record_type   TEXT NOT NULL CHECK (record_type IN ('people','company')),
  record_id     TEXT NOT NULL,
  credit_cost   INTEGER NOT NULL DEFAULT 1,
  was_free      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_reveals_user_record ON reveals(user_id, record_type, record_id)
  WHERE was_free = FALSE;

-- EXPORTS
CREATE TABLE exports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  format     export_format NOT NULL DEFAULT 'csv',
  row_count  INTEGER NOT NULL,
  credits_cost INTEGER NOT NULL,
  included_unrevealed BOOLEAN NOT NULL DEFAULT TRUE,
  watermark  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DAILY RATE LIMITS
CREATE TABLE daily_usage (
  user_id      UUID NOT NULL REFERENCES users(id),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  search_count INTEGER NOT NULL DEFAULT 0,
  export_rows  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- ENUMERATIONS
CREATE TABLE wilayas (
  code    SMALLINT PRIMARY KEY CHECK (code BETWEEN 1 AND 58),
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL
);

CREATE TABLE industries (
  id        SERIAL PRIMARY KEY,
  name_ar   TEXT NOT NULL,
  name_fr   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE app_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

### Credit Balance Rule (AD-4)

Balance is **computed from the ledger**, not stored as a denormalized column that can drift. `users.credits_balance` is a cache updated atomically in the same transaction as every ledger insert. On any audit or reconciliation, the ledger is queried directly:

```sql
SELECT COALESCE(SUM(amount), 0) FROM credit_ledger WHERE user_id = $1;
```

The display balance = subscription pool + pack pool. Drawdown order (AD-7, [ASSUMPTION]): subscription credits are consumed first.

---

## AD-13: Django auth via djoser + simplejwt

**Binds:** Authentication and session strategy.
**Prevents:** Supabase Auth (would require mapping table for every credit/payment Celery operation and kill Django Admin compatibility); NextAuth (would split user state across two systems).
**Rule:** djoser provides the auth endpoints (register, login, verify email, password reset). simplejwt issues JWTs stored in httpOnly cookies (not localStorage). Django's `auth.User` model is the single source of truth for identity — Celery workers, Django Admin, Chargily webhooks all resolve users through it directly. The 30-day inactivity expiry checks `User.last_login` on each authenticated request. Password change increments a `token_version` field, invalidating all existing JWTs.

## AD-14: Celery + Redis for background jobs

**Binds:** Background task execution.
**Prevents:** Inngest (new service to learn, serverless cold-starts on payment callbacks); cron-only (no retry, no idempotency guarantees).
**Rule:** Celery handles: Chargily webhook reconciliation (credit grant + email), subscription renewal processing, daily cron (rate-limit cleanup, low-credit warnings, 7-day account hard-delete). Redis as broker + result backend. Celery beat for scheduled tasks. All Celery tasks are idempotent on the event/record ID they process. Retry policy: 3 retries with exponential backoff for payment reconciliation, 1 retry for email.

## AD-15: Scraper pipeline as Django management commands with Scrapy

**Binds:** Data ingestion architecture.
**Prevents:** Separate scraper codebase (maintenance overhead); scheduled Inngest functions (less mature for long-running scrapes).
**Rule:** Each data source (Google Places API, El Mouchir, Pages Jaunes) is a Django management command that uses Scrapy or Requests/BeautifulSoup internally. Commands are scheduled via Celery beat or system cron. Each source has an ops-configurable pause switch in `app_config` (when Google Places API monthly spend threshold is breached, that command pauses gracefully). Output lands in `people` and `companies` tables with `source` and `last_verified_at` columns. A `last_verified_on` timestamp surfaces on reveal.

## AD-16: Django Admin as ops panel

**Binds:** Operational management interface.
**Prevents:** Building a custom admin panel (would cost sprint days); relying on Supabase Studio (read-only, SQL-only, no audit-friendly forms).
**Rule:** Django Admin is enabled for: User management (view, manually adjust credits, delete), CreditLedger viewing/searching, PaymentTransaction reconciliation review, Subscription lifecycle management, daily_usage monitoring. All admin actions are logged to Django's `LogEntry` for audit. Admin is restricted to staff users (a separate staff flag, not regular users).

## AD-17: Caddy reverse proxy — single domain, path-based routing

**Binds:** Communication between client and the two services.
**Prevents:** BFF proxy stubs in Next.js (would duplicate every Django endpoint declaration); CORS configuration (cross-origin breaks httpOnly cookies); separate subdomains for frontend and API.
**Rule:** Caddy 2 runs on the VPS as the sole entry point. It terminates TLS (auto Let's Encrypt) and routes by path prefix:
- `/api/*` and `/admin/*` → Django
- `/*` → Next.js
Django sets httpOnly JWTs on `POST /api/auth/login/` — the browser stores the cookie for `mydomain.com` and sends it on all subsequent `/api/*` requests automatically. Next.js has zero API route stubs, zero auth code. No CORS middleware on Django. All four containers (Caddy, Next.js, Django, Celery/Redis/PostgreSQL) share one Docker network on one VPS.

---

## Component Tree

**Frontend (Next.js) — React component hierarchy. Backend (Django) serves the data through Caddy.**

```
<RootLayout>                          // Server: reads locale, dir, session
  <SessionProvider>                    // Client
    <LocaleProvider>                   // Client: trilingual context + switch
      <CreditProvider>                 // Client: live balance context
        <AppShell>                     // Server: header + footer
          <Header>                     // Client islands
            <LocaleSwitcher />
            <CreditsPill />
            <SubscriptionChip />
            <UserMenu />
          </Header>
          {children}
          <Footer />                   // Server
        </AppShell>
      </CreditProvider>
    </LocaleProvider>
  </SessionProvider>
</RootLayout>

// Public pages (Server Components):
<Homepage />                           // /
<About />                              // /about
<HowWeVerify />                        // /how-we-verify
<Privacy />                            // /privacy
<Terms />                              // /terms
<RefundPolicy />                       // /refund-policy
<Wilayas />                            // /wilayas

// Auth (Server shell + Client interactive):
<LoginPage />                          // /login
<SignupPage />                         // /signup
<VerifyEmailPage />                    // /verify-email
<PasswordResetPage />                  // /password-reset

// App surfaces:
<SearchLayout>                         // /search, /search/companies
  <FilterSidebar>                      // Client
    <WilayaCombobox />
    <SavedSearchesList />
  </FilterSidebar>
  <ResultsArea>
    <ChecklistCard />
    <ActiveFilterChips />
    <ResultsTable />
    <ResultsTableStackedRow />
    <RevealButton />
    <ExportModal />
  </ResultsArea>

<CompanyDetailPage />                  // /companies/:id
<CreditsLedgerPage />                  // /credits
<BillingPage>                          // /billing
  <BillingPlanCard />
  <PackCards />
  <PaymentHistoryTable />
  <StatusCard />
  <DangerZone />

<SettingsPage />                       // /settings

// Shared modals (portal-rendered):
<UpgradeDialog />
<RecoveryDialog />
```

---

## Route / API Design

### SSR Routes (Server Components)

| Route | Notes |
|---|---|
| `GET /` | Hero → trust strip → how-it-works → pricing → founder note |
| `GET /about` | Founder narrative |
| `GET /how-we-verify` | Data-sourcing disclosure |
| `GET /privacy` | Loi 18-07, ANPDP, data-subject process |
| `GET /terms` | Subscription terms, no-refund |
| `GET /refund-policy` | No-refund-by-default |
| `GET /wilayas` | Semantic 58-wilaya table + client filter |
| `GET /login` | Email + password |
| `GET /signup` | Email + password only |
| `GET /verify-email` | Hard verification gate |
| `GET /password-reset` | Reset link request |

### API Routes — Django DRF endpoints (called directly by client through Caddy)

**No Next.js route stubs.** The client fetches these directly. Caddy routes `/api/*` to Django. Django sets httpOnly cookies, the browser sends them back automatically.

| Method | Django Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup/` | Register (djoser) |
| `POST` | `/api/auth/verify-email/` | Email verification (djoser) |
| `POST` | `/api/auth/login/` | Get JWT → set httpOnly cookie (djoser) |
| `POST` | `/api/auth/logout/` | Clear httpOnly cookie |
| `POST` | `/api/auth/password-reset/` | Request reset (djoser) |
| `POST` | `/api/auth/password-reset/confirm/` | Confirm reset (djoser) |
| `POST` | `/api/auth/refresh/` | Refresh JWT (simplejwt) |
| `GET` | `/api/search/people/` | People search |
| `GET` | `/api/search/companies/` | Company search |
| `POST` | `/api/search/saved/` | Save search |
| `GET` | `/api/search/saved/` | List saved |
| `DELETE` | `/api/search/saved/{id}/` | Delete saved |
| `PUT` | `/api/search/saved/{id}/` | Update saved |
| `POST` | `/api/reveal/{type}/{id}/` | Atomic reveal + debit |
| `POST` | `/api/export/` | Create export |
| `GET` | `/api/export/{id}/download/` | Download file |
| `GET` | `/api/credits/ledger/` | 90-day ledger |
| `GET` | `/api/billing/plan/` | Current plan + renewal |
| `GET` | `/api/billing/packs/` | Available packs |
| `POST` | `/api/billing/create-checkout/` | Chargily redirect URL |
| `GET` | `/api/billing/status/{txnId}/` | Payment polling |
| `POST` | `/api/settings/profile/` | Update profile |
| `POST` | `/api/settings/delete/` | Initiate deletion |
| `POST` | `/api/settings/undelete/` | Recover account |
| `POST` | `/api/webhooks/chargily/` | Chargily webhook (CSRF-exempt) |
| `GET` | `/api/i18n/{locale}/` | Localized strings |
| `POST` | `/api/emails/render/` | Render react-email TSX → HTML (called by Celery internally) |

---

### Django Project Structure

```
backend/
  manage.py
  config/                          # Django project settings
    settings/
      base.py                      # Shared settings
      development.py               # Dev overrides (debug, test Chargily keys, locale flagging ON)
      production.py                # Production (live keys, locale flagging OFF)
    urls.py                        # Root URL conf
    wsgi.py
    asgi.py                        # For potential future async needs
  apps/
    accounts/                      # Auth (djoser wraps around this)
      admin.py                     # User, UserProfile, subscription state
      models.py                    # UserProfile (locale, tier, credits_balance)
      serializers.py
      views.py                     # Custom profile endpoints
      urls.py
    search/                        # People + Company search + filters + saved
      admin.py                     # SavedSearches (read-only for support)
      models.py
      views.py
      serializers.py
      search_index.py              # tsvector sync logic
    credits/                       # Ledger + reveals
      admin.py                     # CreditLedger (searchable, filterable), Reveals
      models.py
      views.py
      serializers.py
    billing/                       # Subscriptions + packs + Chargily
      admin.py                     # PaymentTransaction reconciliation, Subscriptions
      models.py
      views.py
      serializers.py
      chargily.py                  # Chargily API client
      webhooks.py                  # Webhook handler + Celery tasks
    exports/                       # CSV + xlsx generation
      admin.py                     # Export history (read-only)
      models.py
      views.py
      export_service.py            # Generation logic
  celery.py                        # Celery app config
  tasks/                           # Shared Celery tasks
    billing_tasks.py               # grant_credits, subscription_renewal
    email_tasks.py                 # send_*_email
    maintenance_tasks.py           # hard_delete_expired, check_low_credits
  scrapers/                        # Django management commands
    management/commands/
      scrape_google_places.py
      scrape_el_mouchir.py
      scrape_pages_jaunes.py
  requirements.txt
  Dockerfile
  docker-compose.yml               # Django + Celery + Redis + PostgreSQL
```

---

## i18n Architecture

### Lifecycle (FR-1)

1. **Infer** — `middleware.ts` reads `Accept-Language`. Writes best match (AR→FR→EN) to `x-locale-hint` cookie. Sets `lang` and `dir` on `<html>`.
2. **Confirm** — `LocaleConfirmBanner` renders only when `x-locale-confirmed` is absent. Shows inferred locale in that locale with switch options. On action: writes `x-locale-confirmed` cookie (1yr); authed users also persist to `users.locale`.
3. **Persist** — Authed: `users.locale` column. Guest: `x-locale` cookie.
4. **Switch** — LocaleSwitcher updates `document.documentElement.lang` + `dir`. Fetches `/api/i18n/:locale` for localized strings and facet labels. No router refresh, no page reload. Focus preserved by stable element ID. `aria-live` announces new language.

### Translation Key Structure

UI strings live in Next.js. Transactional email templates are react-email TSX components in Next.js, rendered via an API endpoint called by Celery.

```
frontend/
  messages/
    ar/   (common.json, home.json, search.json, billing.json, trust.json, auth.json)
    fr/   (parallel structure)
    en/   (parallel structure)
  emails/
    components/
      BaseEmail.tsx          # Shared wrapper (dir="auto", inline styles, RTL)
      SignupConfirm.tsx
      PaymentReceipt.tsx
      PackReceipt.tsx
      LowCredit.tsx
    render/route.ts          # POST /api/emails/render
```

### Fall-Through Rules

- **Production:** AR → FR → EN. Missing AR key renders FR text; missing FR renders EN. EN is the ultimate fallback and must always be complete.
- **Dev/Staging:** `NEXT_PUBLIC_DEV_LOCALE_FLAG=true` wraps missing keys in `[MISSING: key.name]` for visibility.
- **CI:** `npm run check:i18n` verifies every key in `messages/en/` exists in `messages/fr/` and `messages/ar/`. Fails build on missing key.

### Numerals (AD-8)

All UI numerals use Western Arabic glyphs. For credit amounts, prices, codes:
```js
new Intl.NumberFormat('en', { useGrouping: true }).format(n)
```
Dates use `Intl.DateTimeFormat(locale)` — verify AR locale produces Western numerals on target browsers; fall back to manual formatting if needed. Apply `font-variant-numeric: tabular-nums` via `.tabular-nums` class on all credit surfaces.

---

## Chargily Webhook Event Model

### Event Mapping

| Chargily Event | Transaction Type | Action |
|---|---|---|
| `checkout.paid` (single) | `pack_purchase` | Grant pack credits (75 or 250) |
| `checkout.paid` (subscription creation) | `subscription_creation` | Grant 200 credits, create subscription |
| `checkout.paid` (subscription renewal) | `subscription_renewal` | Grant 200 credits, extend period |
| `subscription.payment_failed` | — | Set subscription to `failed_renewal`, trigger persistent banner |

**Webhook routing:** Chargily webhooks land at `POST /api/webhooks/chargily/` (Django view, CSRF-exempted via `@csrf_exempt` since Chargily does not provide a CSRF token). Chargily signature verified via HMAC-SHA256 against `CHARGILY_WEBHOOK_SECRET`. Returns 200 within 5s; actual work is a Celery task.

### Idempotency (AD-5)

```
Chargily POST → Django /api/webhooks/chargily/ (CSRF-exempt)
  1. Verify Chargily HMAC signature
  2. Parse event type + payload
  3. BEGIN (SERIALIZABLE):
     a. INSERT INTO payment_transactions (chargily_event_id, ...)
        ON CONFLICT (chargily_event_id) DO NOTHING RETURNING id
     b. If no row inserted → ROLLBACK → 200 OK (already processed)
     c. Enqueue Celery task: grant_credits.delay(event_id)
     d. COMMIT → 200 OK
```

Celery task `grant_credits`: determines credit amount based on event type, inserts `credit_ledger` row, updates `payment_transactions.status = 'succeeded'`, updates `users.credits_balance`, sends receipt email via Django email backend. All wrapped in a transaction with retry (3 attempts, exponential backoff).

### Polling Bridge (FR-27)

On return from Chargily to `/billing`, `StatusCard` polls `GET /api/billing/status/:txnId` every 5s for 60s. Once `payment_transactions.status = 'succeeded'`, card flips to success + toast. After 60s: "Payment received — credits will post shortly" (non-error). Final correction arrives via webhook background job.

---

## Credit State Machine

### Atomic Debit (FR-14)

```
BEGIN;
  SELECT SUM(amount) INTO subscription_balance
  FROM credit_ledger WHERE user_id=$1 AND pool='subscription';
  SELECT SUM(amount) INTO pack_balance
  FROM credit_ledger WHERE user_id=$1 AND pool='pack';
  IF (subscription_balance + pack_balance < 1) THEN ROLLBACK; RETURN error;
  -- Subscription-first drawdown
  computed_pool := CASE WHEN subscription_balance >= 1 THEN 'subscription' ELSE 'pack' END;
  INSERT INTO credit_ledger (...) VALUES ($1, 'reveal_debit', -1, ..., computed_pool, ...);
  INSERT INTO reveals (...) VALUES (...);
  UPDATE users SET credits_balance = credits_balance - 1 WHERE id=$1;
  RETURN contact_data;
COMMIT;
```

### Re-Reveal Idempotency

```
SELECT COUNT(*) FROM reveals
WHERE user_id=$1 AND record_type=$2 AND record_id=$3
AND created_at > NOW() - INTERVAL '30 days';
-- If > 0: return contact data without debit (was_free=TRUE)
```

The initial results API returns `revealed: true` per row when a ≤30d reveal exists, so the client renders the Already-revealed badge and contact fields immediately.

### Optimistic UI with Rollback

Client: reveal expands immediately, pill decrements by 1. On API error: row collapses, pill increments back, toast explains "Reveal failed — credits restored."

### Balance Computation (Read)

```sql
SELECT COALESCE(SUM(amount) FILTER (WHERE pool='subscription'), 0) AS subscription_balance,
       COALESCE(SUM(amount) FILTER (WHERE pool='pack'), 0) AS pack_balance
FROM credit_ledger WHERE user_id=$1;
```

Display balance = `subscription_balance + pack_balance`. Drawdown: subscription pool first (AD-7, [ASSUMPTION]).

---

## Search Architecture

### Query API

```
GET /api/search/people?filters={"industry":["..."],"wilaya":[31],"seniority":["..."],"keyword":"..."}&page=1&sort=name:asc
```

`filters` JSONB includes: `industry`, `wilaya`, `seniority` (People only), `size` (Company only), `keyword`, `include_unknown_size`.

### Full-Text Search

PostgreSQL `tsvector` columns with per-language text search configurations. Keyword converted via `websearch_to_tsquery('simple', keyword)`. Diacritic-insensitive matching via `unaccent` extension for French; Arabic diacritics (tashkeel) stripped at write time to a normalized search column.

### Pagination

100 per page (`LIMIT 100 OFFSET ($page - 1) * 100`). At 1,000 results the API returns `truncated: true` with the refine prompt. No infinite scroll.

### Rate Limiting (FR-7)

```sql
SELECT search_count FROM daily_usage WHERE user_id=$1 AND date=CURRENT_DATE;
-- If search_count >= 30 (free) / 100 (Starter) → 429.
-- On success: UPSERT daily_usage SET search_count = search_count + 1.
```

Reset at 00:00 Africa/Algiers via `daily_usage` insert/update with `date = CURRENT_DATE` (resets naturally each day). 429 response body includes localized `aria-describedby` message.

### Saved Searches

Full filters serialized as JSONB. Caps: 5 (free) / 25 (Starter) — Q1 [ASSUMPTION]. One-click re-run counts toward daily limit.

---

## Security

| Concern | Mechanism |
|---|---|---|
| Auth | Django User (bcrypt) + djoser + simplejwt. JWT stored in httpOnly cookie (not localStorage). 30-day inactivity expiry via `User.last_login` check on each request. Password change increments `token_version` invalidating all existing JWTs. |
| CSRF | simplejwt is token-based (no CSRF needed for JWTs). Django `@csrf_exempt` on webhook views. Standard CSRF middleware for Django Admin. |
| Payment tokens | `CHARGILY_API_KEY`, `CHARGILY_WEBHOOK_SECRET` — Django server-only env vars, never in client bundle. |
| Export rate limit | 5,000 rows/24h per account. Checked at Django export endpoint via `daily_usage` table. |
| Account deletion | `User.deleted_at` set → login frozen (middleware check) → 7-day grace → Celery cron hard-deletes. Anonymised ledger retained 90 days. `User.email` preserved during grace for recovery. |
| PII encryption | Email/phone encrypted at rest via Django `pgcrypto` integration or custom model field. |
| Webhook security | Chargily signature verified via HMAC-SHA256 against `CHARGILY_WEBHOOK_SECRET` in Django view before any processing. |

---

## Data Enumerations

### Wilaya Taxonomy (FR-10)

58 wilayas, codes 1-58. Trilingual names in `wilayas` table. Display: `code — locale name` with transliterated Arabic fallback per FR-10. Published at `/wilayas` as canonical reference.

### Industry Taxonomy (FR-9)

30+ curated industries seeded in `industries` table. Multi-select. Ops-configurable via `is_active` flag.

### Seniority Bands (FR-11, [ASSUMPTION])

`owner_founder`, `c_level`, `director`, `manager`, `individual_contributor`

### Size Bands (FR-12, [ASSUMPTION])

`1-10`, `11-50`, `51-200`, `201-500`, `500+`

Both stored in `app_config` with trilingual labels, ops-configurable.

---

## SEO + Public Pages

All public pages: Server Components with `generateMetadata()`. Semantic heading hierarchy (single `<h1>`, ordered `<h2>/<h3>`). `sitemap.xml` includes all 7 public pages × 3 locales. Structured data (SoftwareApplication schema) on `/`.

- `/about`, `/how-we-verify`, `/privacy`, `/terms`, `/refund-policy`: indexed for trust queries.
- `/wilayas`: key SEO asset — full `<table>` with `<caption>`, `scope` attributes, per-cell `lang` attributes. Client filter input labeled, not placeholder-only.

---

## Deployment

### Environments

| Environment | Chargily Mode | Locale Flagging |
|---|---|---|
| `development` | Test keys | ON |
| `staging` | Test keys | ON |
| `production` | Live keys | OFF |

### Hosting — Single VPS with Docker Compose

One **OVHcloud VPS** (or Scaleway, Hetzner) runs everything in Docker Compose:

| Container | Role |
|---|---|
| **Caddy 2** | Reverse proxy, TLS termination (auto Let's Encrypt), path-based routing |
| **Next.js** | SSR pages, client components, locale middleware |
| **Django** | REST API, auth, Chargily webhook handler, Admin |
| **Celery** | Background jobs (payment reconciliation, email, cron) |
| **Redis** | Celery broker + result backend |
| **PostgreSQL** | Primary data store |

```
┌─────────┐   :443    ┌──────────┐  /api/*  ┌────────┐  ┌──────────┐
│ Browser  │ ───────→  │  Caddy   │ ───────→ │ Django │→ │PostgreSQL│
└─────────┘            │ (TLS)    │  /admin/*│ (gunicorn)└──────────┘
                      │          │ ───────→ │        │
                      │          │  /*      └────────┘
                      │          │ ───────→ ┌────────┐
                      └──────────┘          │ Next.js│
                                             │(node)  │
                                             └────────┘
```

VPS minimum spec: 2 vCPU, 4 GB RAM, 50 GB SSD — runs all six containers comfortably for V1 traffic.

### CI/CD (GitHub Actions)

**Both services in one repo, one CI pipeline, one deploy target.**

```
On PR:
  frontend/: npm run lint + npm run typecheck + npm run check:i18n + npm run test
  backend/:  ruff check . + mypy . + pytest
  Result: PR checks pass or fail

On merge to main:
  GitHub Actions SSH into VPS → git pull → docker compose up -d --build
  Caddy reloads config automatically (no restart needed for route changes)
  Next.js, Django, Celery all rebuild and restart
```

---

## Email System

Transactional emails are react-email TSX components rendered on demand and sent from Celery via Django's email backend.

**Render flow:**
```
Celery task needs to send an email:
  1. HTTP POST to http://nextjs:3000/api/emails/render
     body: { template: "payment_receipt", locale: "fr", context: { userName, amount, credits } }
  2. Next.js API route (@react-email/render) renders the TSX component to HTML
  3. Returns HTML string to Celery
  4. Celery wraps in EmailMessage, sends via SMTP (Resend / SendGrid)
```

| Trigger | Celery Task | Template | Context |
|---|---|---|---|
| Post-signup | `send_verification_email.delay(user_id)` | `SignupConfirm` | verification_link |
| Payment received | `send_payment_receipt.delay(txn_id)` | `PaymentReceipt` | amount, credits_granted, date |
| Pack received | `send_pack_receipt.delay(txn_id)` | `PackReceipt` | pack_credits, amount, never_expires_note |
| Low-credit warning | Daily Celery beat: `check_low_credits` | `LowCredit` | remaining_credits, top_up_link |

Every email component extends `BaseEmail` which sets `dir="auto"` for RTL support and includes inline-styled responsive layout. Plain-text fallback auto-generated from the TSX content. `@react-email/components` and `@react-email/render` are frontend dependencies.

---

## Open Questions (Flagged Assumptions)

| ID | Question | Default Used | Revisit Condition |
|---|---|---|---|
| Q1 | Saved-search caps? | 5 free / 25 Starter | PM confirmation |
| Q2 | Seniority/size band taxonomies? | 5 bands each (listed above) | Ops curation |
| Q3 | Credit drawdown order? | Subscription-first → pack | PM confirmation |
| Q4 | 5,000 rows/24h export cap? | Configurable via `app_config` | PM confirmation |
| Q5 | ANPDP filing status? | /privacy wording must not claim filed | Legal confirmation |
| Q6 | Founder headshot + email? | Placeholder `<div>`, env vars | Founder supplies |
| Q7 | Translation review? | Strings marked `[PENDING REVIEW]` | Native-speaker review |
| Q8 | Failed queries count toward daily limit? | NOT counted | PM confirmation |
| Q9 | Django + Next.js project structure — monorepo or two repos? | Separate `frontend/` and `backend/` dirs in one repo | Dev preference — separable at any time |
| Q10 | Background worker on same VPS as Django or separate? | Same VPS for V1 | Scale-out at V2 |
| Q11 | Docker or bare-metal Django deployment on VPS? | Docker (docker-compose: Django + Celery + Redis) | V1 simplicity vs reproducibility |

---

## AD Index

| ID | Rule | Status |
|---|---|---|
| AD-1 | Next.js 14 App Router (frontend) + Django REST Framework (backend split) | [ADOPTED] |
| AD-2 | shadcn/ui + Tailwind CSS 4, logical-property CI enforcement | [ADOPTED] |
| AD-3 | PostgreSQL single store with SERIALIZABLE transactions for payments/credits | [ADOPTED] |
| AD-4 | Credit balance = computed from ledger (users.credits_balance is transactional cache) | [ADOPTED] |
| AD-5 | Chargily webhook idempotent on `chargily_event_id` UNIQUE constraint | [ADOPTED] |
| AD-6 | Locale switch: no page reload, preserves React component state | [ADOPTED] |
| AD-7 | Credit drawdown: subscription pool before pack pool | [ASSUMPTION] |
| AD-8 | Western Arabic numerals in all locales; tabular-nums on credit surfaces | [ADOPTED] |
| AD-9 | Logical CSS properties only; CI lint bans physical properties | [ADOPTED] |
| AD-10 | Public pages = Server Components; app = SSR + client islands | [ADOPTED] |
| AD-11 | Daily rate limits reset at 00:00 Africa/Algiers via `daily_usage` date key | [ADOPTED] |
| AD-12 | Charge balance display = subscription_pool + pack_pool (computed from ledger) | [ADOPTED] |
| AD-13 | Django auth via djoser + simplejwt (JWT in httpOnly cookie) | [ADOPTED] |
| AD-14 | Celery + Redis for all background jobs | [ADOPTED] |
| AD-15 | Scraper pipeline as Django management commands with Scrapy | [ADOPTED] |
| AD-16 | Django Admin as ops panel for user/credit/payment management | [ADOPTED] |
| AD-17 | Caddy reverse proxy — single domain, path-based routing, no BFF stubs, no CORS | [ADOPTED] |
