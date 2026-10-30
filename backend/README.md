# Hi Day — Backend API

The multi-tenant API behind Hi Day: auth, event ingestion, and business logic for time tracking, reporting, payroll, and invoicing.

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

### 3. Billing, if you are touching it

Stripe cannot reach `localhost`, so a local CLI forwards its webhooks to you.
Without it you can take a payment and never hear that it succeeded — the
organisation stays on a trial, and the banner keeps asking somebody who has
already paid.

```bash
stripe login                       # once, against the team's sandbox
stripe listen --all-snapshot --forward-to localhost:3001/billing/webhook
```

Recent CLI versions refuse to start without being told which events to
forward. `--all-snapshot` sends everything in the classic shape the handler
reads; anything it does not act on is answered 200 and ignored. To keep the
terminal quiet, name the eight it does act on instead:

```bash
stripe listen --forward-to localhost:3001/billing/webhook --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_succeeded,invoice.payment_failed,invoice.upcoming
```

**Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` and restart the
backend.** It is minted fresh for each `stripe listen` session, and a stale
one means every event is rejected with a 400 and nothing reaches your code —
the most common way this looks broken.

Then set in `.env`:

| Variable | |
| --- | --- |
| `STRIPE_SECRET_KEY` | From the sandbox. Unset means billing is simply off |
| `STRIPE_WEBHOOK_SECRET` | The `whsec_…` above |
| `STRIPE_PRODUCT_ID` | Optional — found or created by name if blank |

and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `frontend/.env.local`, which is
public by design and the only Stripe key allowed that prefix.

Pay with `4242 4242 4242 4242`, any future expiry, any CVC.

A few things that are easy to misread:

- **`stripe trigger invoice.paid` fabricates a customer and invoice** with no
  link to your organisation, so the handler cannot place it and answers 503.
  That is correct behaviour, not a failure. To exercise a real one, use
  `stripe events resend <id>`.
- **Do not cancel a subscription in the Stripe dashboard** while testing.
  Stripe's cancel is terminal and cannot be undone — the subscription is dead
  and you need a new one. Use *Turn off auto-renew* on the Billing page,
  which is `cancel_at_period_end` and reversible.
- **If a webhook is missed anyway**, opening the Billing page repairs it: a
  row that says trialing while carrying a Stripe subscription id is checked
  against Stripe directly.

### Going to production

Stripe needs a public HTTPS endpoint, so the backend has to be deployed
first. Once it is, register the endpoint from here rather than clicking
through the dashboard:

```bash
pnpm --filter backend stripe:register-webhook -- --url https://api.yourdomain.com/billing/webhook
```

It is idempotent, so re-running is safe — it matches on the URL, and repairs
the event list if it has drifted from the handler. Add `--dry-run` to see
what it would do.

Two things it does that a dashboard click does not: it subscribes to exactly
the events `HANDLED_STRIPE_EVENTS` lists, read from the handler itself so the
subscription cannot fall behind the code; and it pins `api_version` to the
version this app's SDK speaks, where a dashboard-created endpoint inherits
whatever the account default is that day — and a newer default can reshape
payloads the handler reads.

**The signing secret is printed once.** Stripe returns it only at creation
and never again, so copy it straight into the environment as
`STRIPE_WEBHOOK_SECRET` and restart. If it is ever lost, roll it in the
dashboard — never create a second endpoint for the same URL, or every event
is delivered twice.

Run it once per environment, by hand. It is deliberately not done at boot:
the app would then need an API key that can rewrite its own webhook
configuration, every deploy could mutate production Stripe state, and
instances starting together would race to create the same endpoint.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm start:dev` | Start in watch mode |
| `pnpm start` | Start without watch |
| `pnpm start:prod` | Run the compiled build |
| `pnpm build` | Compile to `dist/` |
| `pnpm lint` | Lint |
| `pnpm test` | Unit tests |
| `pnpm test:cov` | Test coverage |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:revert` | Revert the last-applied migration |
| `pnpm typeorm migration:generate src/database/migrations/<Name>` | Generate a migration from entity changes (DB must be running) |

## Project Structure

```
src/                    — App module, controllers, services, main.ts entry point
src/database/           — TypeORM DataSource, entities, and migrations
```
