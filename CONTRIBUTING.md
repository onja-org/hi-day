# Contributing

Thanks for helping. Keep it small and we'll get it merged.

## Before you start

- **Open an issue first** for anything beyond a bug fix or a typo, so we can
  agree on the approach before you write it.
- Hi Day is **AGPL-3.0**. Contributions are licensed the same way.
- Security issue? Don't open an issue — see [SECURITY.md](SECURITY.md).

## Setup

See [Quick Start](README.md#quick-start). In short:

```bash
pnpm install
pnpm --filter backend start:dev     # needs Postgres + backend/.env
pnpm --filter frontend dev
```

Requires **Node 22** and **pnpm 11**. Desktop work needs Node 22
specifically — 24 breaks Electron's native modules.

## Making a change

1. Branch off `main`: `yourname/feat/short-description` or
   `yourname/fix/short-description`
2. Make the change
3. `pnpm lint && pnpm test && pnpm build`
4. Open a PR against `main`

## What we look for

- **Tests for behaviour that matters.** One case per rule, not one per
  field. Don't test a constructor's shape.
- **Few comments.** Only for what the code can't show — a trap, a
  non-obvious *why*. Never restate the line below.
- **Match the surrounding code.** Naming, structure, file layout.
- **One concern per PR.** Two unrelated fixes are two PRs.
- **Say what you couldn't verify.** "Didn't test on Windows" is useful;
  silence isn't.

## Things to know

- **Billing is off by default** (`BILLING_ENABLED`). Self-hosted Hi Day is
  free forever, so no change may introduce a trial, a paywall or a seat
  limit to it. Both modes need to keep working — and both need tests.
- **Email and object storage are optional.** The app must start and work
  without either.
- `CONTEXT.md` defines the domain terms. Use them.
- Per-package conventions live in `backend/CLAUDE.md` and
  `frontend/CLAUDE.md`.

## Tests failing before you changed anything?

If desktop tests mention `NODE_MODULE_VERSION`, the native module is built
for a different Node:

```bash
pnpm --filter desktop rebuild:node
```
