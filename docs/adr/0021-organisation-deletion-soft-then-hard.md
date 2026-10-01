---
status: accepted
---

# Organisation deletion is suspend-then-purge, owner-only, confirmed by email

An owner can close their Organisation "now" or on a scheduled date. Both end in the same two-step lifecycle: **suspend** (immediate, reversible) then **purge** (after a grace window, irreversible). See CONTEXT.md's Account deletion and Owner entries for the vocabulary.

## Decisions

- **Owner is a column, not a role.** `Organisation.ownerUserId`, backfilled to the earliest admin Membership. Nothing distinguished one admin from another before, and "only the owner" is a requirement. Routes are gated `@RequireRole(ADMIN)` and the service compares `ownerUserId`, so a demoted owner loses access too. Ownership transfer isn't built — an owner who leaves can't be replaced without a DB change.
- **Two-step request → email → confirm.** `POST deletion/request` validates the typed Organisation name and emails a single-use token (hash stored, newest request wins, 24h TTL). Only `POST deletion/confirm` — called from a button on the settings page, never on page load, so a mail scanner prefetching the link can't delete anything — changes the Organisation.
- **Suspension is enforced where access already is.** `RoleGuard` refuses suspended orgs (routes tagged `@AllowSuspendedOrganisation()` are the exception); `DeviceSessionGuard` refuses their sessions; `InvitationsService.accept` refuses their invitations. Suspension also revokes all DeviceSessions and closes running Time entries and open Pauses at the same instant, so no hours accrue past it.
- **Purge order.** Wasabi objects first, then one DB transaction. After `purgeAt` there's nothing to restore, and object deletion is idempotent, so a crash between the steps just retries next hour instead of losing the keys that only DB rows held. The transaction deletes children before parents (most FKs are `RESTRICT`), then verifies inside itself that no org-scoped row remains and rolls back if one does. `deleteByPrefix` lists `screenshots/<orgId>/` rather than trusting DB rows, so orphaned uploads go too, and the prefix is re-checked after commit for uploads that raced the purge.
- **A spec fails CI if a new org-owned entity isn't purged.** `PURGED_TABLES_BY_ORGANISATION_ID` is checked against every entity with an `organisationId` column. `audit_logs` is the only exemption.
- **Shared Devices and Users survive.** A Device row records whoever logged in last, so another Organisation's captures can still reference one that points at the purged org. Such devices are re-homed to the org and user behind a surviving capture rather than deleted. Users with another Membership keep their account; users with none are erased. (Found by running the purge against a real Postgres, not by mocks.)
- **Audit keeps proof, not content.** All audit rows for the org are deleted except `organisation.deletion_requested|scheduled|cancelled`, `organisation.suspended` and `organisation.purged`, which hold only ids, mode and dates. Their org link becomes `NULL` (FK is `SET NULL`), and `organisation.purged` records the public id and name.

## Not built — and what the spec's edge cases resolve to

- **Billing.** No subscription or billing code exists, so "cancel subscription" and the unpaid-balance / mid-cycle case are **unimplemented**, not merely stubbed. When billing lands, cancellation belongs in `suspend()` (stop charging when access stops) and the balance policy needs deciding then.
- **Data export.** No full-organisation export exists. The UI says so and points to the per-report CSV/PDF exports; the acceptance criterion "owner is offered a full export" is only partly met.
- **Backups.** Deleted data must not resurrect from a backup. Two rules, both operational (nothing in code can enforce them): backups must age out within a documented retention limit (recommend ≤ 35 days), and **any restore from backup must be followed by re-running the purges recorded in `audit_logs`** (`action = 'organisation.purged'`, with the public id) before the restored database is put back in service. Wasabi objects aren't part of DB backups, so they're unaffected. Record the retention limit wherever backups are configured.
- **Legal hold.** Out of scope. If added, it should block `confirm`, `suspend` and the purge cron with a single check on the Organisation.
- **Multi-instance cron.** The hourly job has no leader election, like the other `@Cron` jobs here. A double run is safe — suspension is idempotent and a second purge finds nothing — but it could send duplicate notification emails.

## Considered options

- **Hard delete immediately** — rejected; the spec requires a recovery window and one mistyped confirmation would be catastrophic.
- **`ON DELETE CASCADE` on every org FK and delete only the org row** — rejected. The FKs are deliberately `RESTRICT` (accidental deletes should fail loudly), and cascades wouldn't cover Wasabi, Users, or shared Devices anyway.
- **Generic purge by walking TypeORM metadata at runtime** — rejected in favour of an explicit ordered list plus the coverage spec; FK ordering with `RESTRICT` is easier to read and review than a topological sort.
