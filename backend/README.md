# Workforce Monitoring — Backend API

The multi-tenant API behind the Workforce Monitoring Platform: auth, event ingestion, and business logic for time tracking, reporting, payroll, and invoicing.

Built with **NestJS** and **TypeScript**. Tests run on the built-in **Jest** setup.

---

## Quick Start

```bash
pnpm install
pnpm start:dev
```

API runs on [http://localhost:3001](http://localhost:3001).

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

## Project Structure

```
src/   — App module, controllers, services, main.ts entry point
test/  — e2e tests
```
