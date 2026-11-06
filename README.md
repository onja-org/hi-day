# Hi Day

A transparent, consent-first time-tracking and productivity-monitoring platform for distributed teams — company registration, team and project management, time tracking via a web console and desktop agent, reporting, payroll and invoicing, backed by a single multi-tenant API.

pnpm workspace monorepo with three packages: `frontend` (Next.js web console), `backend` (NestJS API) and `desktop` (Electron agent).

Free to self-host, forever, for any team size. Licensed under AGPL-3.0.

## Quick Start

Running Hi Day rather than developing it? See [Self-hosting](#self-hosting) — two commands with Docker.

To work on the code, start with:

```bash
pnpm install        # every package
```

Then set up whichever parts you need. The backend is needed by both the others.

### Backend — http://localhost:3001

```bash
cp backend/.env.example backend/.env
# set DATABASE_URL to your own Postgres, and JWT_SECRET to anything long
pnpm --filter backend migration:run
pnpm --filter backend start:dev
```

Needs a local PostgreSQL — see [backend/README.md](backend/README.md) for OS-specific steps.

### Frontend — http://localhost:3000

```bash
cp frontend/.env.example frontend/.env
pnpm --filter frontend dev
```

Needs the backend running — it proxies `/api/backend/*` to it.

### Desktop

```bash
nvm use 22
pnpm --filter desktop dev
```

Node 22 only. Electron's native modules are compiled against it, and 24 breaks both the install and the tests. If the tests report `NODE_MODULE_VERSION`, rebuild them:

```bash
pnpm --filter desktop rebuild:node        # for tests
pnpm --filter desktop rebuild:electron    # for the app
```

Needs the backend running, and a display — Electron will not start headless.

### Everything

```bash
pnpm lint && pnpm test && pnpm build      # all packages, via turbo
```

More detail in each package's own README: [backend](backend/README.md) · [frontend](frontend/README.md) · [desktop](desktop/README.md). If you want to send a change, read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Self-hosting

Self-hosted Hi Day is free, forever, for any team size. No trial, no countdown, no paywall, no seat limit, and no payment account. Licensed under AGPL-3.0.

### Requirements

- Docker with Compose v2 (`docker compose version`), or Node 22 + pnpm 11 + PostgreSQL 14+ if you would rather run it directly.
- About 2 GB of RAM and 1 GB of disk to start with. Screenshots, if you turn them on, are stored elsewhere (see below) and not on this disk.

### Quick start

```bash
git clone https://github.com/onja-org/hi-day.git
cd hi-day
cp .env.docker.example .env
# Fill in the two required values in .env:
#   POSTGRES_PASSWORD   any strong string
#   JWT_SECRET          openssl rand -base64 48
docker compose up --build
```

Then open http://localhost:3000.

### Creating the first account

There is no separate admin bootstrap step, and nothing to run in a shell. The first person to sign up creates the organisation and becomes its admin.

1. Go to http://localhost:3000/signup and fill in your details and your company's.
2. Hi Day emails you a link to set your password. If you have not configured email, that link is printed to the backend log instead:
   ```bash
   docker compose logs backend | grep -A3 "was not sent"
   ```
   Copy the `http://localhost:3000/set-password?token=…` URL and open it.
3. Setting your password creates the organisation and your admin membership in one step. You are signed in.

Signup is open to anyone who can reach your server. That is fine on a private network, and something to think about before putting Hi Day on the public internet — put it behind a VPN, an SSO proxy or a firewall rule until you want strangers creating organisations on it.

### Configuration

Every variable is commented in `.env.docker.example` (Docker) and in `backend/.env.example` and `frontend/.env.example` (running directly).

**Required**

| Variable | What it is |
|---|---|
| `POSTGRES_PASSWORD` | Database password. Used only inside the Compose network |
| `JWT_SECRET` | Signs session tokens. `openssl rand -base64 48`. Changing it signs everybody out |
| `APP_URL` | Where people reach Hi Day. Change this from `localhost` before anybody else uses it — invitation and password links are built from it |

**Optional — everything works without them**

| Variable | Without it |
|---|---|
| `SMTP_*` or `RESEND_API_KEY` | No email is sent. Invitation and password links are written to the backend log and shown in the app to the admin who created them. Self-service password reset stops working — see below |
| `WASABI_*` | Screenshots cannot be captured or viewed. Time tracking, projects, activity, reports and the desktop agent all work |

### Email is optional

Hi Day starts and runs without an email provider, and signing in never needed one — login is email and password, with no message sent. Without a provider configured:

- Invitation, set-password, password-reset and deletion-confirmation links are written to the backend log, marked `was not sent`, with the link on its own line.
- When an admin invites somebody, the join link is also shown in the app, with a copy button, on the invite results — so it can be passed on directly without reading the log.

The one thing this genuinely costs you is self-service password reset. "Forgot password" writes its link to the log, and an ordinary member cannot read your server's log — so resetting a password becomes something an admin does for them, by finding the link with `docker compose logs backend | grep -A5 "was not sent"` and sending it on. The admin-triggered reset (Members → send password reset) has the same shape: it works, but the link lands in the log rather than in their inbox.

For a team of two or three that is a minor annoyance. Past that, configure email — it is a few minutes of work and it removes the only part of Hi Day that needs an administrator to act as a relay.

### Turning email on

Two ways, and SMTP is the one to use when self-hosting — it needs no account anywhere new, because SMTP is the standard every mail system already speaks.

```bash
# Example: Google Workspace. Also works with Microsoft 365, your own mail
# server, Mailgun, SES, Postmark — anything that speaks SMTP.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourcompany.com
SMTP_PASSWORD=<an app password, not your account password>
EMAIL_SENDER="Hi Day <you@yourcompany.com>"
```

Restart, and the log should say `Email goes out over SMTP (smtp.gmail.com)`. Then use "Forgot password" on your own account to prove a real message arrives.

| Variable | |
|---|---|
| `SMTP_HOST` | Setting this is what switches SMTP on |
| `SMTP_PORT` | `587` (STARTTLS, the usual) or `465` (implicit TLS) |
| `SMTP_USER` / `SMTP_PASSWORD` | Leave blank for a relay that authorises by IP. Gmail and Microsoft 365 need an app password |
| `SMTP_SECURE` | Normally leave blank — inferred from the port. Set it only for a non-standard port |
| `SMTP_ALLOW_SELF_SIGNED` | `true` only for an internal server with a self-signed certificate |

If a message does not go, the error names the setting at fault rather than dumping a TLS trace — a rejected login points at `SMTP_USER`, an unreachable server at `SMTP_HOST`, a failed handshake at `SMTP_SECURE`.

Or [Resend](https://resend.com): sign up, verify a sending domain, then set `RESEND_API_KEY` and `EMAIL_SENDER`. Worth knowing before you choose it: sending to anyone other than yourself needs a domain you control and can add DNS records to, and it means your staff's email addresses pass through a third party — which may be the thing you self-hosted to avoid.

If both are configured, SMTP wins. Somebody who filled in their own mail server means to use it, and a leftover key should not quietly override that.

### Migrations

They run automatically. The backend container runs every pending migration before it starts serving; TypeORM records what it has applied, so restarts and upgrades are safe and re-running costs one query. A failed migration stops the container rather than serving against a schema it does not match.

Running without Docker, do it once by hand:

```bash
pnpm --filter backend migration:run        # from source
pnpm --filter backend migration:run:prod   # from a build
```

### Putting it on a real domain (HTTPS)

HTTPS is required for anything but `localhost`. Session cookies are issued with the `Secure` flag, which browsers only return over HTTPS — with one exception they make for localhost. So the quick start works on your machine, and a plain `http://hiday.internal:3000` would let people sign in and then silently fail to keep them signed in.

Hi Day does not terminate TLS itself. Put a reverse proxy in front.

**Caddy** is the least work — it obtains and renews certificates on its own. A whole Caddyfile:

```
hiday.example.com {
    reverse_proxy localhost:3000
}
```

**nginx**, if you already run it:

```nginx
server {
    listen 443 ssl;
    server_name hiday.example.com;

    ssl_certificate     /etc/letsencrypt/live/hiday.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hiday.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then set the address in `.env` and restart:

```bash
APP_URL=https://hiday.example.com
```

That value is what invitation and password links are built from, so it has to be the address people actually type.

#### Do you also need the backend on its own address?

Depends entirely on whether anybody uses the desktop agent.

| Reaches the backend via | Backend needs a public address? |
|---|---|
| Web console | the frontend's own `/api/backend/*` path | No |
| Desktop agent | directly | Yes |

For the web console alone, one proxied hostname is enough and the backend can stay on the internal network — drop the backend service's `ports:` block from `docker-compose.yml` entirely.

For the desktop agent, give the backend its own hostname and proxy that too:

```
hiday.example.com     { reverse_proxy localhost:3000 }   # web console
api.hiday.example.com { reverse_proxy localhost:3001 }   # desktop agent
```

People then enter `https://api.hiday.example.com` in the **Server** field on the desktop login screen. Its default does not point at your install, so somebody has to change it there.

#### Two things to know

- **Rate limiting counts by IP, and a proxy hides it.** Hi Day throttles repeated failed logins and invitation sends per client, using the address the request appears to come from. Behind a proxy every request appears to come from the proxy, so those limits apply to everyone at once instead of per person. Forwarding the headers as shown above is the right start; Hi Day does not yet read them, so until it does, treat the login throttle as a global limit rather than a per-attacker one.
- **Signup is open to anyone who can reach the server.** Once it is on a public domain, strangers can create organisations on your install. Put it behind a VPN, an SSO proxy or a firewall rule until you want that.

### Deploying the two services separately

`docker-compose.yml` puts the frontend and backend on one network, where the backend is reachable as `http://backend:3001`. That address is baked into the frontend image at build time — Next.js freezes its proxy destination during `next build`, so setting it at container start is too late.

Running them somewhere else, build the frontend with its real address:

```bash
docker build -f frontend/Dockerfile \
  --build-arg BACKEND_ORIGIN=https://api.example.com -t hiday-frontend .
```

### Upgrading

```bash
git pull
docker compose up --build -d
```

Migrations run on start. Read the release notes before a major version, and take a backup first.

### Backups

Everything durable is in PostgreSQL, in the `postgres-data` volume. Screenshots, if enabled, live in your object storage and are not covered by a database backup.

```bash
# Back up
docker compose exec -T postgres pg_dump -U hiday hiday | gzip > hiday-$(date +%F).sql.gz

# Restore into an empty database
gunzip -c hiday-2026-01-01.sql.gz | docker compose exec -T postgres psql -U hiday hiday
```

Keep `JWT_SECRET` with the backup. Restoring the data without it signs everybody out.

### Running without Docker

```bash
pnpm install
cp backend/.env.example backend/.env     # set DATABASE_URL and JWT_SECRET
cp frontend/.env.example frontend/.env
pnpm --filter backend migration:run
pnpm --filter backend start:dev          # http://localhost:3001
pnpm --filter frontend dev               # http://localhost:3000
```