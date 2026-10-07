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
