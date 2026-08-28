---
status: accepted
---

# Signup also collects the Organisation's founding details; the Organisation is created atomically alongside the first password, not in a separate step

Following on from ADR-0003 (verification *is* setting a password): signup (`POST /auth/signup`) now also collects company name, address, and an optional website, and stashes them on the `User` row (`pendingOrganisationName`/`pendingOrganisationAddress`/`pendingOrganisationWebsite`) rather than creating the Organisation immediately. `POST /auth/set-password` creates the Organisation and the caller's `admin` Membership inside the same database transaction as hashing the password and marking the email verified. This removes the separate "create your organisation" onboarding step entirely — a User goes straight from clicking the emailed link to a working, tenant-scoped session.

## Considered options

- **Keep organisation creation as a separate authenticated step after set-password** (what the previous session built: a `/onboarding` form calling `OrganisationsService` directly). Rejected because it added a step the product no longer wants — company details are known at signup time, so asking again after verification was pure friction.
- **Create the Organisation immediately at signup, before verification.** Rejected: it would mean Organisation/Membership rows exist for an email nobody has proven they own yet, reopening exactly the "anyone can spin up tenant state with an email they don't control" gap ADR-0003 closed. Stashing the fields on the (still-unprivileged) User row and only materializing the Organisation once the password step succeeds keeps that invariant intact.

## Consequences

`OrganisationsService.createForUser(manager, userId, input)` takes an existing `EntityManager` and is only ever called from inside `AuthService.setPassword()`'s transaction, so org creation can never partially fail independently of verification (both commit together or neither does). A User who signs up and never clicks the link leaves inert `pending*` values on their row; harmless, but a future cleanup job for abandoned unverified signups should know to disregard them rather than treat them as a real Organisation waiting to be created.

Update (see ADR-0005): `OrganisationsService` later gained real HTTP-facing endpoints after all (`GET /organisations/current`, `PATCH /organisations/:id`) for editing an already-created Organisation's settings — the "no HTTP-facing endpoint" framing above described `createForUser` specifically (creation stays internal-only, transaction-bound), not the service as a whole.
