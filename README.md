# hiday

hiday is an open-source time-tracking and productivity-monitoring app for distributed teams. Admins set up their company, teams and projects. People track time from the web console or the desktop agent. Managers see it in timesheets and reports, and can export it as CSV. Payroll and client invoicing are planned.

It's built to be open with staff. Admins choose what gets collected, people are told about it, and nothing is tracked in secret. Self-hosting is free for any team size, and the code is licensed under [AGPL-3.0](LICENSE).

## What's in the repo

This is a pnpm monorepo with three apps:

| Folder | What it is | Stack |
|---|---|---|
| [`backend/`](backend/README.md) | The API, shared by the web console and the desktop agent | NestJS, TypeORM, PostgreSQL |
| [`frontend/`](frontend/README.md) | The web console | Next.js |
| [`desktop/`](desktop/README.md) | The desktop agent: timer, idle detection, app and screenshot capture | Electron |

Other useful places:

- [`CONTEXT.md`](CONTEXT.md) defines the domain terms we use (Organisation, Membership and so on).
- [`docs/adr/`](docs/adr/) records past design decisions and why we made them.
- [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) is the full guide to running hiday on your own server.
- [`docs/`](docs/README.md) has the product spec, technical design and the rest of the docs.

## Just want to run it?

You need Docker with Compose v2.

```bash
git clone https://github.com/onja-org/hi-day.git
cd hi-day
cp .env.docker.example .env
# In .env, set POSTGRES_PASSWORD to any strong string
# and JWT_SECRET to the output of: openssl rand -base64 48
docker compose up --build
```

Open http://localhost:3000/signup. The first person to sign up becomes the admin. If email isn't set up, the set-password link is printed in the backend log (`docker compose logs backend`).

Email, HTTPS, backups and upgrades are covered in [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Quick start

To work on the code you need:

- Node 22 (not 24, because the desktop app's native modules break on it)
- pnpm 11 (`npm install -g pnpm@11`)
- PostgreSQL 16 or newer. [backend/README.md](backend/README.md) has install steps for macOS, Linux and Windows.

### 1. Install

```bash
git clone https://github.com/onja-org/hi-day.git
cd hi-day
pnpm install
```

### 2. Backend (http://localhost:3001)

```bash
createdb workforce_monitoring
cp backend/.env.example backend/.env
# Edit DATABASE_URL to match your Postgres user and password
pnpm --filter backend migration:run
pnpm --filter backend start:dev
```

The other defaults in `.env.example` work for local development. Email, screenshot storage and billing are all optional and stay off when left blank.

### 3. Frontend (http://localhost:3000)

```bash
cp frontend/.env.example frontend/.env
pnpm --filter frontend dev
```

The frontend proxies API calls to the backend, so keep the backend running.

### 4. Desktop (optional)

```bash
pnpm --filter desktop dev
```

This needs the backend running and a display. If tests fail with a `NODE_MODULE_VERSION` error, rebuild the native modules with `pnpm --filter desktop rebuild:node`. See [desktop/README.md](desktop/README.md) for more.

### Checks

Run these before opening a pull request. CI runs the same ones.

```bash
pnpm lint
pnpm test
pnpm build
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you start. For anything bigger than a bug fix, please open an issue first so we can agree on the approach.

Found a security problem? Please don't open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## License

[AGPL-3.0](LICENSE). If you run a modified version for other people, including over a network, you have to make your source available to them under the same license.
