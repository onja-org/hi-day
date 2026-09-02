# Backend Conventions

Rules for working in this NestJS backend, a pnpm workspace package (`backend`) alongside `frontend`. See the root [`CONTEXT.md`](../CONTEXT.md) for domain terms (Organisation, Membership, etc.) and [`docs/DEPLOYMENT_READINESS.md`](../docs/DEPLOYMENT_READINESS.md) for what's planned but not yet built.

## Commands

- **Run backend scripts via `pnpm --filter backend <script>` from the repo root** (e.g. `pnpm --filter backend test`, `pnpm --filter backend lint`, `pnpm --filter backend migration:run`) — this is a pnpm workspace package, not a standalone project. `cd backend && npm run ...` uses the wrong package manager.

## Folder structure

```
backend/
├── src/
│   ├── app.controller.ts / app.controller.spec.ts / app.service.ts / app.module.ts   — Nest scaffold, stays flat (see below)
│   ├── main.ts
│   ├── <feature>/                        — e.g. auth, organisations, audit-log, email
│   │   ├── controllers/<feature>.controller.ts
│   │   ├── services/
│   │   │   ├── <name>.service.ts
│   │   │   └── tests/<name>.service.spec.ts
│   │   ├── modules/<feature>.module.ts   (plus any secondary modules, e.g. auth/modules/jwt-auth.module.ts)
│   │   └── dto/
│   │       ├── <name>.dto.ts
│   │       └── tests/<name>.dto.spec.ts
│   └── database/
│       ├── database.module.ts   — TypeOrmModule.forRootAsync (the DB connection)
│       ├── data-source.ts       — DataSource used by the TypeORM CLI (migrations)
│       ├── entities/            — one file per entity (+ tests/ once an entity spec exists)
│       └── migrations/
```

- **Every feature module lives in its own top-level folder under `src/`, split by concern into subfolders: `controllers/`, `services/`, `modules/`, `dto/`.** Only create the subfolders a feature actually needs — `audit-log` and `email` have no `controllers/` (no HTTP surface) or `dto/` (no request bodies); `audit-log` has only `services/` and `modules/`. Never leave a `.controller.ts`/`.service.ts`/`.module.ts`/`.dto.ts` loose at the feature root — it belongs in its matching subfolder.
- **Unit tests live in a `tests/` folder nested inside the subfolder they test** — `services/tests/`, `dto/tests/`, `src/database/entities/tests/` — not colocated next to the source file. Only create a `tests/` folder once there's an actual spec to put in it; don't scaffold an empty one preemptively.
- **Controllers and modules are the one exception**: a `.controller.spec.ts`/`.module.spec.ts`, if one exists, stays directly next to its `.controller.ts`/`.module.ts` — not inside a nested `tests/` folder. (`app.controller.spec.ts` next to `app.controller.ts` is the existing example.)
- `app.*` at the `src/` root is the leftover Nest scaffold (health check + hello-world), not a real feature — it stays flat, unsplit.
- e2e tests (`test/*.e2e-spec.ts`, `supertest` against a real `INestApplication`) were removed for now; revisit if/when e2e coverage comes back.

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

- **Auth is email/password only for now — signup, email verification, login, logout, password reset, and refresh tokens all live in `src/auth/`.** See `docs/adr/0002-self-rolled-auth-for-registration.md` through `docs/adr/0005-role-checks-reresolve-from-database-not-jwt.md` for why and how. Don't add a new auth/session mechanism without reading those first — the reasoning (especially around anti-enumeration and never trusting the JWT for anything mutable) applies to any new endpoint you add here too.
- **SSO was scoped out deliberately (cost — WorkOS bills per SSO connection — vs. the value of a free "Sign in with Google" style button, which is a different, unresolved product question) — don't add it back without confirming the approach again first.**
- **Role is always resolved fresh from the database, never trusted from a JWT claim.** See `docs/adr/0005-role-checks-reresolve-from-database-not-jwt.md`.
