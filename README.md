# Hi Day

A transparent, consent-first time-tracking and productivity-monitoring platform for distributed teams — company registration, team and project management, time tracking via a web console and desktop agent, reporting, payroll and invoicing, backed by a single multi-tenant API.

pnpm workspace monorepo with three packages: **`frontend`** (Next.js web
console), **`backend`** (NestJS API) and **`desktop`** (Electron agent).

**Free to self-host, forever, for any team size** — see
[Self-hosting](#self-hosting). Licensed under [AGPL-3.0](LICENSE).

---

## Quick Start

Running Hi Day rather than developing it? Use
[Self-hosting](#self-hosting) — two commands with Docker. To work on the
code:

```bash
pnpm install                          # installs deps for every package

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# install Postgres locally and update backend/.env's DATABASE_URL to match —
# see backend/README.md's Quick Start for OS-specific install steps
pnpm --filter backend migration:run   # creates the database tables

pnpm --filter frontend dev            # http://localhost:3000
pnpm --filter backend start:dev       # http://localhost:3001
```

See each package's own README for details: [frontend/README.md](frontend/README.md), [backend/README.md](backend/README.md).

## Self-hosting

**Self-hosted Hi Day is free, forever, for any team size.** No trial, no
countdown, no paywall, no seat limit, and no payment account. Licensed
under [AGPL-3.0](LICENSE).

### Requirements

- Docker with Compose v2 (`docker compose version`), or Node 22 + pnpm 11 +
  PostgreSQL 14+ if you would rather run it directly.
- About 2 GB of RAM and 1 GB of disk to start with. Screenshots, if you
  turn them on, are stored elsewhere (see below) and not on this disk.

### Quick start

```bash
git clone https://github.com/onja-org/hiday.git
cd hiday
cp .env.docker.example .env
# Fill in the two required values in .env:
#   POSTGRES_PASSWORD   any strong string
#   JWT_SECRET          openssl rand -base64 48
docker compose up --build
```

Then open <http://localhost:3000>.

### Creating the first account

There is no separate admin bootstrap step, and nothing to run in a shell.
The first person to sign up creates the organisation and becomes its admin.

1. Go to <http://localhost:3000/signup> and fill in your details and your
   company's.
2. Hi Day emails you a link to set your password. **If you have not
   configured email, that link is printed to the backend log instead:**

   ```bash
   docker compose logs backend | grep -A3 "was not sent"
   ```

   Copy the `http://localhost:3000/set-password?token=…` URL and open it.
3. Setting your password creates the organisation and your admin
   membership in one step. You are signed in.

> **Signup is open to anyone who can reach your server.** That is fine on a
> private network, and something to think about before putting Hi Day on
> the public internet — put it behind a VPN, an SSO proxy or a firewall
> rule until you want strangers creating organisations on it.

### Configuration

Every variable is commented in `.env.docker.example` (Docker) and in
`backend/.env.example` and `frontend/.env.example` (running directly).

**Required**

| Variable | What it is |
| --- | --- |
| `POSTGRES_PASSWORD` | Database password. Used only inside the Compose network |
| `JWT_SECRET` | Signs session tokens. `openssl rand -base64 48`. Changing it signs everybody out |
| `APP_URL` | Where people reach Hi Day. **Change this from `localhost` before anybody else uses it** — invitation and password links are built from it |

**Optional — everything works without them**

| Variable | Without it |
| --- | --- |
| `SMTP_*` or `RESEND_API_KEY` | No email is sent. Invitation and password links are written to the backend log and shown in the app to the admin who created them. **Self-service password reset stops working** — see below |
| `WASABI_*` | Screenshots cannot be captured or viewed. Time tracking, projects, activity, reports and the desktop agent all work |

**Cloud-only.** `BILLING_ENABLED` and every `STRIPE_*` variable exist for
hiday.io. `docker-compose.yml` pins `BILLING_ENABLED=false`; leave it alone
and there is no billing code running at all — the routes are not even
registered.

### Email is optional

Hi Day starts and runs without an email provider, and signing in never
needed one — login is email and password, with no message sent. Without a
provider configured:

- Invitation, set-password, password-reset and deletion-confirmation links
  are written to the backend log, marked `was not sent`, with the link on
  its own line.
- When an admin invites somebody, the join link is also shown **in the
  app**, with a copy button, on the invite results — so it can be passed on
  directly without reading the log.

**The one thing this genuinely costs you is self-service password reset.**
"Forgot password" writes its link to the log, and an ordinary member cannot
read your server's log — so resetting a password becomes something an admin
does for them, by finding the link with
`docker compose logs backend | grep -A5 "was not sent"` and sending it on.
The admin-triggered reset (Members → send password reset) has the same
shape: it works, but the link lands in the log rather than in their inbox.

For a team of two or three that is a minor annoyance. Past that, configure
email — it is a few minutes of work and it removes the only part of Hi Day
that needs an administrator to act as a relay.

#### Turning email on

Two ways, and **SMTP is the one to use when self-hosting** — it needs no
account anywhere new, because SMTP is the standard every mail system
already speaks.

```bash
# Example: Google Workspace. Also works with Microsoft 365, your own mail
# server, Mailgun, SES, Postmark — anything that speaks SMTP.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourcompany.com
SMTP_PASSWORD=<an app password, not your account password>
EMAIL_SENDER="Hi Day <you@yourcompany.com>"
```

Restart, and the log should say `Email goes out over SMTP (smtp.gmail.com).`
Then use "Forgot password" on your own account to prove a real message
arrives.

| Variable | |
| --- | --- |
| `SMTP_HOST` | Setting this is what switches SMTP on |
| `SMTP_PORT` | `587` (STARTTLS, the usual) or `465` (implicit TLS) |
| `SMTP_USER` / `SMTP_PASSWORD` | Leave blank for a relay that authorises by IP. Gmail and Microsoft 365 need an **app password** |
| `SMTP_SECURE` | Normally leave blank — inferred from the port. Set it only for a non-standard port |
| `SMTP_ALLOW_SELF_SIGNED` | `true` only for an internal server with a self-signed certificate |

If a message does not go, the error names the setting at fault rather than
dumping a TLS trace — a rejected login points at `SMTP_USER`, an
unreachable server at `SMTP_HOST`, a failed handshake at `SMTP_SECURE`.

**Or Resend**, which is what Hi Day Cloud uses: sign up at
[resend.com](https://resend.com), verify a sending domain, then set
`RESEND_API_KEY` and `EMAIL_SENDER`. Worth knowing before you choose it:
sending to anyone other than yourself needs a domain you control and can
add DNS records to, and it means your staff's email addresses pass through
a third party — which may be the thing you self-hosted to avoid.

If both are configured, SMTP wins. Somebody who filled in their own mail
server means to use it, and a leftover key should not quietly override
that.

### Migrations

They run automatically. The backend container runs every pending migration
before it starts serving; TypeORM records what it has applied, so restarts
and upgrades are safe and re-running costs one query. A failed migration
stops the container rather than serving against a schema it does not match.

Running without Docker, do it once by hand:

```bash
pnpm --filter backend migration:run        # from source
pnpm --filter backend migration:run:prod   # from a build
```

### Deploying the two services separately

`docker-compose.yml` puts the frontend and backend on one network, where the
backend is reachable as `http://backend:3001`. That address is **baked into
the frontend image at build time** — Next.js freezes its proxy destination
during `next build`, so setting it at container start is too late.

Running them somewhere else, build the frontend with its real address:

```bash
docker build -f frontend/Dockerfile \
  --build-arg BACKEND_ORIGIN=https://api.example.com -t hiday-frontend .
```

Nothing *billing*-related is baked in — the browser asks the backend for
that at runtime (`GET /config`), so one image serves a self-hosted install
and Hi Day Cloud alike.

### Upgrading

```bash
git pull
docker compose up --build -d
```

Migrations run on start. Read the release notes before a major version,
and take a backup first.

### Backups

Everything durable is in PostgreSQL, in the `postgres-data` volume.
Screenshots, if enabled, live in your object storage and are not covered by
a database backup.

```bash
# Back up
docker compose exec -T postgres pg_dump -U hiday hiday | gzip > hiday-$(date +%F).sql.gz

# Restore into an empty database
gunzip -c hiday-2026-01-01.sql.gz | docker compose exec -T postgres psql -U hiday hiday
```

Keep `JWT_SECRET` with the backup. Restoring the data without it signs
everybody out.

### Running without Docker

```bash
pnpm install
cp backend/.env.example backend/.env     # set DATABASE_URL and JWT_SECRET
cp frontend/.env.example frontend/.env
pnpm --filter backend migration:run
pnpm --filter backend start:dev          # http://localhost:3001
pnpm --filter frontend dev               # http://localhost:3000
```

### Billing, and how it stays out of your way

One backend variable separates a self-hosted install from Hi Day Cloud, and
it is **off** unless you turn it on:

```
BILLING_ENABLED=false
```

There is no matching frontend variable. The browser asks the backend at
runtime (`GET /config`), so the same built image serves both and there is
nothing to keep in sync.

With it off there is no trial and no subscription record, no trial banner,
no Billing section in Settings (those API routes are not registered and
those pages 404 — they are not merely hidden), no seat-consent notice in the
invite forms, no seat synchronisation, no reminder emails, and no payment
keys required to start.

Internally the split is one interface, `Entitlements`, with two
implementations. Code that creates an organisation or accepts an invitation
talks to that, never to a payment provider, so neither shape is a special
case of the other and both are covered by the same test suite.

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
desktop/   — Electron desktop agent (time tracking, activity capture)
docs/      — Product & technical design docs
```
