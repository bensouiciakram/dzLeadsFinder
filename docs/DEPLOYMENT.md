# Deployment runbook — dzleadsfinder.akrambensouici.com

Single VPS, Docker Compose production stack, behind an **existing host-level
Caddy** (owns ports 80/443 and terminates TLS). The stack exposes only
`127.0.0.1:8004` (Django/gunicorn) and `127.0.0.1:3004` (Next.js standalone) —
**nothing binds public ports**.

Host port map (3000–3003 / 8000–8003 are taken by other apps on this VPS):

| App port | Container port | Service |
|---|---|---|
| 3004 | 3004 | nextjs (runner, `PORT` env) |
| 8004 | 8004 | django (gunicorn `--bind 0.0.0.0:8004`) |

```
Cloudflare DNS ──> VPS :80/:443 (host Caddy, Let's Encrypt)
                     ├─ /api/*, /admin/*, /static/*  ──> 127.0.0.1:8004 (django)
                     └─ everything else              ──> 127.0.0.1:3004 (nextjs)
```

---

## Step 0 — One-time prep changes (already in the repo)

| File | Purpose |
|---|---|
| `docker-compose.prod.yml` (new) | Production stack: postgres, redis, django (gunicorn ×3, `target: production`), celery_worker, nextjs (`target: runner`) — internal network, 127.0.0.1 binds, no Caddy service |
| `.env.prod.example` (new) | Committable template for the real `.env.prod` |
| `backend/config/settings/base.py` | whitenoise middleware + `STATIC_ROOT` + compressed static storage (gunicorn can't serve `/static` otherwise — `/admin` would be unstyled) |
| `backend/config/settings/production.py` | `SECURE_PROXY_SSL_HEADER` + secure session/CSRF cookies (required behind the TLS-terminating proxy) |
| `backend/requirements.txt` | + `whitenoise>=6.6,<7.0` |
| `.gitignore` | + `.env.prod` (secrets stay off-repo) |

---

## Step 1 — Cloudflare DNS (2 min)

In Cloudflare, zone `akrambensouici.com`:

- Type **A**, Name **dzleadsfinder**, IPv4 = **your VPS IP**, Proxy status
  **Proxied** (mirror the exact settings of your existing subdomain record).

## Step 2 — Host Caddy host block (5 min)

On the VPS, your per-subdomain Caddy convention (`/etc/caddy/sites/*.caddyfile`
is `import`ed by the main `/etc/caddy/Caddyfile`) — **create** a new file
`/etc/caddy/sites/dzleadsfinder.caddyfile` (same pattern as your template,
with a path split because this app is same-origin — no separate api subdomain):

```
dzleadsfinder.akrambensouici.com {
	@api path /api/* /admin/* /static/*
	handle @api {
		reverse_proxy 127.0.0.1:8004
	}
	handle {
		reverse_proxy 127.0.0.1:3004
	}
}
```

Reload (no restart of other sites):

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

Caddy issues the Let's Encrypt certificate automatically on first request.
Wait ~1–2 min, then verify TLS from your machine (`curl -I https://dzleadsfinder.akrambensouici.com`).

## Step 3 — Get the code onto the VPS (5 min)

```bash
cd ~ && git clone <your-repo-url> dzleadsfinder
cd dzleadsfinder
git checkout <branch-with-the-changes>   # if not main
```

Copy the template to the real env file:

```bash
cp .env.prod.example .env.prod
nano .env.prod   # fill real values (see Step 4)
```

## Step 4 — Fill `.env.prod` (10 min)

| Key | Value |
|---|---|
| `DJANGO_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DJANGO_ALLOWED_HOSTS` | `dzleadsfinder.akrambensouici.com` |
| `POSTGRES_PASSWORD` | long random password |
| `DJANGO_DEBUG` | `False` (already default in template) |
| `FRONTEND_PUBLIC_URL` | `https://dzleadsfinder.akrambensouici.com` |
| `DEFAULT_FROM_EMAIL` | must use a Resend-verified domain (Step 6) |
| `EMAIL_HOST_PASSWORD` | your Resend API key |

`CHARGILY_SUCCESS_URL` / `CHARGILY_FAILURE_URL` are derived from
`FRONTEND_PUBLIC_URL` in code — do **not** set them.

## Step 5 — Build and start the stack (10–20 min first time)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps   # all 5 services: Up (healthy)
```

**One-off bootstrap** (collect static, create schema, load search data):

```bash
docker compose -f docker-compose.prod.yml run --rm django \
  sh -c "python manage.py collectstatic --noinput && python manage.py migrate"

docker compose -f docker-compose.prod.yml run --rm django \
  python manage.py seed_demo_data
```

`seed_demo_data` writes 120 companies + 280 people (bilingual, keyword-search
ready). It refuses to run if data exists unless `--force`. Wilayas + industries
are seeded by the search migrations themselves.

Create the admin superuser (for `/admin/`):

```bash
docker compose -f docker-compose.prod.yml run --rm django \
  python manage.py createsuperuser
```

## Step 6 — Resend (email, 15 min)

1. Dashboard → **Domains** → **Add Domain** → `akrambensouici.com` (or a
   subdomain). Chose the "send" subdomain option; Resend shows **3 DNS
   records** (DKIM + SPF + optional MX).
2. Add those records in Cloudflare (DNS section) exactly as shown, wait for
   Resend to mark the domain **Verified**.
3. Resend → **API Keys** → create a key (full access).
4. Back in `.env.prod`:
   - `EMAIL_HOST=smtp.resend.com`, `EMAIL_PORT=587`, `EMAIL_HOST_USER=resend`
   - `EMAIL_HOST_PASSWORD=<the API key>`, `EMAIL_USE_TLS=true`
   - `DEFAULT_FROM_EMAIL=DzLeadsFinder <dzleadsfinder@akrambensouici.com>`
     (use the exact verified sender address)
5. Restart the app so it picks the env up:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Step 7 — Chargily (test mode, 10 min)

1. Chargily dashboard → **TEST** workspace → **Settings / API keys**:
   copy the test **API key** and **webhook secret** into `.env.prod`.
2. Register the webhook endpoint in the Chargily test dashboard:
   `https://dzleadsfinder.akrambensouici.com/api/webhooks/chargily/`
   (server-side path: `backend/apps/billing/urls/webhooks.py:8`)
3. Restart the stack. Your test checkout surface is fully functional —
   pay with Chargily's test cards.

## Step 8 — Smoke checklist

- [ ] `curl -I https://dzleadsfinder.akrambensouici.com` → 200, `Server: Caddy`
- [ ] Home + `/en/search` render; brand/layout intact
- [ ] Signup → verification email arrives (via Resend) in ~seconds
- [ ] Password reset link opens `https://dzleadsfinder.akrambensouici.com/password-reset/...`
- [ ] Search returns seeded companies; filters work
- [ ] `/admin/` styled + login works (superuser)
- [ ] Billing page loads; test checkout succeeds; StatusCard flips to success
      (billing carries the webhook event through `grant_credits`)
- [ ] `docker compose -f docker-compose.prod.yml logs -f` shows no errors
- [ ] 404/error pages don't leak stack traces (`DEBUG=False`)

---

## Day 2 — deploying updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
# only if the DB schema changed:
docker compose -f docker-compose.prod.yml run --rm django python manage.py migrate
# only if static assets changed:
docker compose -f docker-compose.prod.yml run --rm django python manage.py collectstatic --noinput
```

## Common ops

| Task | Command |
|---|---|
| Logs | `docker compose -f docker-compose.prod.yml logs -f django` / `nextjs` / `celery_worker` |
| Restart | `docker compose -f docker-compose.prod.yml restart` |
| DB backup | `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U dzleads dzleads > backup.sql` |
| DB restore | `docker compose -f docker-compose.prod.yml exec -T postgres psql -U dzleads dzleads < backup.sql` |

## Security notes

- Postgres/Redis are **internal-network only**; the compose binds nothing
  publicly (`127.0.0.1:` binds on 3004/8004 are for the host Caddy alone).
- Keep the VPS firewall to 80/443 (+22) as with your other subdomain.
- Rotate `DJANGO_SECRET_KEY` and the Resend/Chargily keys if they ever
  appear in logs or commits.