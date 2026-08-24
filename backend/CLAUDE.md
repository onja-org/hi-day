# Backend Conventions

Rules for working in this NestJS backend, a pnpm workspace package (`backend`) alongside `frontend`. See the root [`CONTEXT.md`](../CONTEXT.md) for domain terms (Organisation, Membership, etc.) and [`docs/DEPLOYMENT_READINESS.md`](../docs/DEPLOYMENT_READINESS.md) for what's planned but not yet built.

## Commands

- **Run backend scripts via `pnpm --filter backend <script>` from the repo root** (e.g. `pnpm --filter backend test`, `pnpm --filter backend lint`, `pnpm --filter backend migration:run`) — this is a pnpm workspace package, not a standalone project. `cd backend && npm run ...` uses the wrong package manager.

## Folder structure

Current layout — an early-stage Nest scaffold plus one hand-added module:

```
backend/
├── src/
│   ├── app.controller.ts / app.controller.spec.ts / app.service.ts / app.module.ts
│   ├── main.ts
│   └── database/
│       ├── database.module.ts   — TypeOrmModule.forRootAsync (the DB connection)
│       ├── data-source.ts       — DataSource used by the TypeORM CLI (migrations)
│       ├── entities/            — one file per entity
│       └── migrations/
└── test/                 — e2e specs (*.e2e-spec.ts) + jest-e2e.json
```

- **New feature modules go in their own top-level folder under `src/`, following the standard Nest pattern: `src/<feature>/<feature>.module.ts`, `.controller.ts`, `.service.ts`, and a `dto/` subfolder for request/response DTOs.** No real example of this exists yet — `app.*` is just the leftover scaffold — but this is the pattern to follow, not improvise around, once real features start landing.
- **Unit tests are colocated `*.spec.ts` files next to the source they test.** E2e tests live in `test/*.e2e-spec.ts`, bootstrapping a real `INestApplication` and hitting it with `supertest`.

## Multi-tenancy & data access

- **Every TypeORM query touching organisation-owned data MUST be scoped by `organisationId`.** There's no base repository or interceptor enforcing this yet, so it has to be done by hand at each call site until one exists. Skipping this is a cross-tenant data leak, not just a bug.
- **Entities live in `src/database/entities/`, one file per entity, registered via `TypeOrmModule.forFeature([...])` in whichever feature module owns them** — don't add a new global service that exposes every repository. Keep table names explicit (`@Entity({ name: '...' })`) and snake_case-friendly; column names stay camelCase on the entity, matching the DB column via the property name.
- **Create migrations with `pnpm --filter backend typeorm migration:generate src/database/migrations/<Name>` (requires the DB to be running so TypeORM can diff the current schema), and apply them with `pnpm --filter backend migration:run`.** Never hand-edit a file under `src/database/migrations/` once it's been run against a shared database — add a new migration instead.

## Config & environment

- **Read env vars through `ConfigService`, never `process.env` directly.** `ConfigModule` is registered globally (`app.module.ts`), so `ConfigService` is injectable anywhere without re-importing it.
- **Use `configService.getOrThrow(...)` for required vars (e.g. `DATABASE_URL`) and `.get(key, default)` only for genuinely optional ones (e.g. `PORT`, `CORS_ORIGIN`).** Silently defaulting a required var hides misconfiguration until it breaks something downstream.
- **Add any new env var to `.env.example` in the same change that introduces it.** `.env` is gitignored — `.env.example` is the only record of what the backend needs to run.
- **Never widen CORS beyond the single configured `CORS_ORIGIN`.** It's deliberately locked to one origin (default `http://localhost:3000`), not `*` — don't "fix" a CORS error by loosening this.

## TypeScript & linting

- **`any` is allowed here, unlike the frontend** (`@typescript-eslint/no-explicit-any` is off in `backend/eslint.config.mjs`). This is an intentional divergence, not an inconsistency to fix — don't tighten it without being asked.
- Formatting is Prettier-enforced (`singleQuote`, `trailingComma: all`) via `eslint-plugin-prettier` — run `pnpm --filter backend lint` rather than hand-formatting.

## Auth

- **Auth is not implemented yet, and the provider (WorkOS vs. Clerk) is still an open decision — see `docs/DEPLOYMENT_READINESS.md`.** Don't add authentication/authorization logic, guards, or a specific provider's dependencies without confirming the approach first.
