# Self-hosting hiday

Self-hosted hiday is free for any team size. There is no trial, paywall, seat limit or payment account. It is licensed under AGPL-3.0.

## Requirements

- Docker with Compose v2. You can also run it directly with Node 22, pnpm 11 and PostgreSQL 16+ (see [Running without Docker](#running-without-docker)).
- About 2 GB of RAM and 1 GB of disk to start. Screenshots, if you turn them on, go to object storage, not this disk.

## Quick start

```bash
git clone https://github.com/onja-org/hi-day.git
cd hi-day
cp .env.docker.example .env
# In .env, set:
#   POSTGRES_PASSWORD   any strong string
#   JWT_SECRET          openssl rand -base64 48
docker compose up --build
```

Then open http://localhost:3000.

## Creating the first account

The first person to sign up creates the organisation and becomes its admin. There's no separate setup step.

1. Go to http://localhost:3000/signup and fill in your details and your company's.
2. hiday emails you a link to set your password. Without email set up, the link is printed in the backend log:
   ```bash
   docker compose logs backend | grep -A3 "was not sent"
   ```
   Open the `http://localhost:3000/set-password?token=…` link.
3. Set your password. This creates the organisation and your admin account, and signs you in.

Anyone who can reach your server can sign up and create an organisation. That's fine on a private network. Before you put hiday on the public internet, keep it behind a VPN, an SSO proxy or a firewall rule.

## Configuration

Every variable is explained in `.env.docker.example` (Docker), or in `backend/.env.example` and `frontend/.env.example` (without Docker).

Required:

| Variable | What it does |
|---|---|
| `POSTGRES_PASSWORD` | Database password. Only used inside the Compose network. |
| `JWT_SECRET` | Signs session tokens. Changing it signs everyone out. |
| `APP_URL` | The address people use to reach hiday. Invitation and password links are built from it, so change it from `localhost` before anyone else uses the app. |

Optional. Everything works without these:

| Variable | What happens without it |
|---|---|
| `SMTP_*` or `RESEND_API_KEY` | No email is sent. Links go to the backend log instead. See [Email](#email). |
| `WASABI_*` | No screenshots. Time tracking, projects, activity, reports and the desktop agent still work. |

## Email

hiday runs fine without email. Login is email and password and never sends anything.

Without email, invitation, set-password, password-reset and deletion-confirmation links are written to the backend log, marked `was not sent`. When an admin invites someone, the app also shows the join link with a copy button.

The real cost is password reset. A member who uses "Forgot password" can't read your server log, so an admin has to find the link and send it to them:

```bash
docker compose logs backend | grep -A5 "was not sent"
```

For two or three people that's fine. For a bigger team, set up email.

### SMTP (recommended)

SMTP works with any mail system: Google Workspace, Microsoft 365, your own server, Mailgun, SES, Postmark and so on.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourcompany.com
SMTP_PASSWORD=<an app password, not your account password>
EMAIL_SENDER="hiday <you@yourcompany.com>"
```

Restart. The log should say `Email goes out over SMTP (smtp.gmail.com)`. Use "Forgot password" on your own account to check a real email arrives.

| Variable | Notes |
|---|---|
| `SMTP_HOST` | Setting this turns SMTP on. |
| `SMTP_PORT` | `587` (STARTTLS, the usual) or `465` (TLS). |
| `SMTP_USER` / `SMTP_PASSWORD` | Leave blank for a relay that allows your IP. Gmail and Microsoft 365 need an app password. |
| `SMTP_SECURE` | Usually blank, since it's worked out from the port. Only set it for a non-standard port. |
| `SMTP_ALLOW_SELF_SIGNED` | `true` only for an internal server with a self-signed certificate. |

If sending fails, the error names the setting that's wrong: `SMTP_USER` for a rejected login, `SMTP_HOST` for an unreachable server, `SMTP_SECURE` for a failed handshake.

### Resend

Sign up at [Resend](https://resend.com), verify a sending domain, then set `RESEND_API_KEY` and `EMAIL_SENDER`. You need a domain you can add DNS records to, and your staff's email addresses will pass through a third party.

If both SMTP and Resend are set, SMTP is used.

## Migrations

The backend container runs any pending migrations before it starts. Restarts and upgrades are safe. If a migration fails, the container stops instead of running against the wrong schema.

Without Docker, run them yourself:

```bash
pnpm --filter backend migration:run        # from source
pnpm --filter backend migration:run:prod   # from a build
```

## HTTPS and your own domain

You need HTTPS for anything other than `localhost`. Session cookies use the `Secure` flag, so over plain HTTP people can sign in but won't stay signed in.

hiday doesn't handle TLS itself, so put a reverse proxy in front of it.

Caddy is the easiest, since it gets and renews certificates for you. This is a complete Caddyfile:

```
hiday.example.com {
    reverse_proxy localhost:3000
}
```

nginx, if you already use it:

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

### The desktop agent needs the backend too

The web console talks to the backend through its own `/api/backend/*` path, so the backend can stay private. If you only use the web console, you can remove the backend's `ports:` block from `docker-compose.yml`.

The desktop agent talks to the backend directly, so the backend needs its own public address:

```
hiday.example.com     { reverse_proxy localhost:3000 }   # web console
api.hiday.example.com { reverse_proxy localhost:3001 }   # desktop agent
```

The agent points at Hi Day Cloud by default. On each install, someone has to click **Self-hosted? Change server** on the login screen and enter `https://api.hiday.example.com`. The setting survives logouts and updates.

Use the official build from [onja-org/hi-day-releases](https://github.com/onja-org/hi-day-releases) so updates keep arriving. Only fork the agent if you want to change how it works, and read [desktop/README.md](../desktop/README.md#self-hosting-the-agent) first. A fork that doesn't change its `publish` settings will be replaced by the official build on the next update.

### Using subdomains

A common setup:

| Hostname | Serves |
|---|---|
| `hiday.example.com` | your company site, if you have one |
| `app.hiday.example.com` | the web console |
| `api.hiday.example.com` | the backend, for the desktop agent |

Set `APP_URL` to the console's address (`https://app.hiday.example.com`). Session cookies belong to that host only and aren't sent to the others.

### Rate limiting behind a proxy

hiday limits repeated failed logins and invitation sends per IP address. Behind a proxy every request seems to come from the proxy, and hiday doesn't read the forwarded headers yet. Until it does, these limits apply to everyone together, not per person.

## Running the frontend and backend separately

In `docker-compose.yml` the frontend reaches the backend at `http://backend:3001`. Next.js fixes that address when the image is built, so you can't change it when the container starts. If the backend lives somewhere else, build the frontend with its real address:

```bash
docker build -f frontend/Dockerfile \
  --build-arg BACKEND_ORIGIN=https://api.example.com -t hiday-frontend .
```

## Upgrading

Take a backup, and read the release notes before a major version. Then:

```bash
git pull
docker compose up --build -d
```

Migrations run on start.

## Backups

Everything is in PostgreSQL, in the `postgres-data` volume. Screenshots live in your object storage and aren't part of a database backup.

```bash
# Back up
docker compose exec -T postgres pg_dump -U hiday hiday | gzip > hiday-$(date +%F).sql.gz

# Restore into an empty database
gunzip -c hiday-2026-01-01.sql.gz | docker compose exec -T postgres psql -U hiday hiday
```

Keep `JWT_SECRET` with your backup. If you restore without it, everyone is signed out.

## Running without Docker

```bash
pnpm install
cp backend/.env.example backend/.env     # set DATABASE_URL, JWT_SECRET, FRONTEND_URL and CORS_ORIGIN
cp frontend/.env.example frontend/.env   # set BACKEND_ORIGIN if the backend isn't on localhost:3001
pnpm build
pnpm --filter backend migration:run:prod
pnpm --filter backend start:prod         # http://localhost:3001
pnpm --filter frontend start             # http://localhost:3000
```
