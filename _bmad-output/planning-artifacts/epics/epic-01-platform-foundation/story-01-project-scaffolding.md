---
title: Story 1.1 — Project Scaffolding
story_id: 1.1
epic: 1
status: draft
frs: [FR-1, FR-2, FR-4, FR-10, FR-29, FR-30, FR-31]
ads: [AD-1, AD-17]
---

# Story 1.1: Project Scaffolding

As a **developer**,
I want **the full project scaffold initialised with Next.js 14 App Router and Django REST Framework, running in Docker Compose behind Caddy with CI/CD pipelines**,
So that **I can build features on a reproducible, deployable foundation from day one**.

## Acceptance Criteria

**Given** no project code exists yet
**When** I run `docker compose up --build` from the repository root
**Then** six containers start successfully: Caddy, Next.js, Django (gunicorn), Celery worker, Redis, and PostgreSQL
**And** the Next.js dev server responds at `http://localhost:3000` with a health-check page

**Given** the project is running
**When** I visit `http://localhost` on port 443 (Caddy)
**Then** Caddy terminates TLS (self-signed in dev, Let's Encrypt in production) and routes:
- `/*` → Next.js
- `/api/*` → Django
- `/admin/*` → Django

**Given** Caddy proxies to Django
**When** a request hits `/api/health/`
**Then** Django responds 200 with `{"status": "ok"}`
**And** no CORS headers are set (Caddy is the same origin)

**Given** the Django container starts
**When** Celery initialises
**Then** the Celery worker connects to Redis as broker and result backend
**And** Celery beat starts for scheduled tasks

**Given** a PR is opened against `main`
**When** GitHub Actions CI runs
**Then** it executes:
- `frontend/: npm run lint + npm run typecheck + npm run test`
- `backend/: ruff check . + mypy . + pytest`
**And** PR check results are reported

**Given** code is merged to `main`
**When** GitHub Actions deploy runs
**Then** it SSHes into the VPS, pulls latest, runs `docker compose up -d --build`
**And** Caddy reloads config automatically

**Given** the project scaffold
**When** I inspect the repository structure
**Then** it follows the Architecture spine:
- `frontend/` — Next.js 14 App Router
- `backend/` — Django project with `config/`, `apps/`, `celery.py`, `tasks/`, `scrapers/`
- `docker-compose.yml` — all six containers
- `Caddyfile` — path-based routing rules

### File Structure Created

```
/
  docker-compose.yml
  Caddyfile
  .github/workflows/
    ci.yml
    deploy.yml
  frontend/
    package.json
    next.config.js
    tsconfig.json
    tailwind.config.ts
    src/
      app/
        layout.tsx
        page.tsx
      middleware.ts
  backend/
    requirements.txt
    Dockerfile
    manage.py
    config/
      settings/
        base.py
        development.py
        production.py
      urls.py
      wsgi.py
      asgi.py
    apps/
      accounts/
      search/
      credits/
      billing/
      exports/
    celery.py
    tasks/
    scrapers/
      management/commands/
```
