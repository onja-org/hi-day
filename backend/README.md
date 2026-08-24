# Workforce Monitoring — Backend API

The multi-tenant API behind the Workforce Monitoring Platform: auth, event ingestion, and business logic for time tracking, reporting, payroll, and invoicing.

Built with **NestJS** and **TypeScript**. Tests run on the built-in **Jest** setup.

---

## Quick Start

### 1. Install and run Postgres locally

Any Postgres 16+ server works — pick whichever is easiest on your OS:

- **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
- **Linux**: `sudo apt install postgresql` (or your distro's package), then `sudo systemctl start postgresql`
- **Windows**: install via the [official installer](https://www.postgresql.org/download/windows/), which sets it up as a running service

Then create the database this app expects:

```bash
createdb workforce_monitoring
# or, from psql: CREATE DATABASE workforce_monitoring;
```

### 2. Configure and run the app

```bash
cp .env.example .env               # then edit DATABASE_URL to match your local Postgres user/password/port
pnpm install
pnpm migration:run                 # applies migrations to your local database
pnpm start:dev
```

API runs on [http://localhost:3001](http://localhost:3001).

Already have Postgres running elsewhere (a different port, a cloud dev instance, etc.)? Skip step 1 and just point `DATABASE_URL` in `.env` at it — nothing else in this app assumes a specific local setup.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm start:dev` | Start in watch mode |
| `pnpm start` | Start without watch |
| `pnpm start:prod` | Run the compiled build |
| `pnpm build` | Compile to `dist/` |
| `pnpm lint` | Lint |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests |
| `pnpm test:cov` | Test coverage |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:revert` | Revert the last-applied migration |
| `pnpm typeorm migration:generate src/database/migrations/<Name>` | Generate a migration from entity changes (DB must be running) |

## Project Structure

```
src/                    — App module, controllers, services, main.ts entry point
src/database/           — TypeORM DataSource, entities, and migrations
test/                   — e2e tests
```
