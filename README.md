# Workforce Monitoring Platform

A transparent, consent-first time-tracking and productivity-monitoring platform for distributed teams — a web console plus a desktop agent, backed by a single multi-tenant API.

pnpm workspace monorepo with two packages: **`frontend`** (Next.js web console) and **`backend`** (NestJS API).

---

## Quick Start

```bash
pnpm install                          # installs deps for both packages, generates the Prisma client

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up -d postgres         # starts a local Postgres for the backend
pnpm --filter backend exec prisma migrate dev   # creates the database tables

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
