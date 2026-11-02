# Hi Day

A transparent, consent-first time-tracking and productivity-monitoring platform for distributed teams — company registration, team and project management, time tracking via a web console and desktop agent, reporting, payroll and invoicing, backed by a single multi-tenant API.

pnpm workspace monorepo with two packages: **`frontend`** (Next.js web console) and **`backend`** (NestJS API).

---

## Quick Start

```bash
pnpm install                          # installs deps for both packages

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# install Postgres locally and update backend/.env's DATABASE_URL to match —
# see backend/README.md's Quick Start for OS-specific install steps
pnpm --filter backend migration:run   # creates the database tables

pnpm --filter frontend dev            # http://localhost:3000
pnpm --filter backend start:dev       # http://localhost:3001
```

See each package's own README for details: [frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md).

## Self-hosting and billing

**Self-hosted Hi Day is free, forever, for any team size.** Running it
yourself gives you the whole product: no trial, no countdown, no paywall and
no seat limit, and you never need a payment-provider account. Hi Day is
licensed under [AGPL-3.0](LICENSE).

That is the default. One backend variable separates a self-hosted install
from Hi Day Cloud, and it is **off** unless you turn it on:

```
backend/.env    BILLING_ENABLED=false
```

There is no matching frontend variable. The browser asks the backend at
runtime (`GET /config`), so the same built frontend serves both shapes and
there is nothing to keep in sync. Copying the `.env.example` files, as the
Quick Start above does, already leaves billing off — a fresh install needs
no configuration to be free.

**With billing off** there is no trial and no subscription record, no trial
banner, no Billing section in Settings (those API routes are not registered
and those pages 404 — they are not merely hidden), no seat-consent notice in
the invite forms, no seat synchronisation, no trial reminder emails, and no
Stripe keys required to start.

**With billing on** — Hi Day Cloud — every billing feature works, and
`STRIPE_SECRET_KEY` becomes required: the backend refuses to start without
it, rather than running on as a deployment that looks healthy but cannot
charge anybody.

Internally the split is one interface, `Entitlements`, with two
implementations (`CloudEntitlements` and `SelfHostedEntitlements`). Code that
creates an organisation or accepts an invitation talks to that, never to
Stripe, so neither shape is a special case of the other and both are covered
by the same test suite.

## Documentation

| Topic | File |
| --- | --- |
| Product requirements | [docs/PRD.md](docs/PRD.md) |
| Technical design | [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md) |
| Capabilities FAQ | [docs/CAPABILITIES_FAQ.md](docs/CAPABILITIES_FAQ.md) |

## Project Structure

```
frontend/  — Next.js web console
backend/   — NestJS API
docs/      — Product & technical design docs
```
