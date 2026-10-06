---
status: accepted
---

# The owner can opt into an immediate purge

ADR-0021 rejected hard-deleting an Organisation immediately, because one mistyped confirmation would be catastrophic. Some owners still need to say "erase our data now" without waiting out the 30-day recovery window, so we add a third deletion mode, `permanent`, without changing the default. The 30-day window still covers everyone who doesn't opt out of it.

## Decisions

- **Opt-in, never the default.** "Delete now" still suspends and waits for `purgeAt`. `permanent` is a separate choice with its own "cannot be undone" warning. That warning also tells an owner who belongs to no other Organisation that their own login goes too.
- **Same confirmation as every other mode.** The typed name plus the emailed single-use link, for both entry points: the delete dialog, and "Permanently delete now" on an already-suspended Organisation. Someone who suspended weeks ago isn't treated as having already confirmed the purge.
- **Available from any state except purging.** Active, scheduled (confirming replaces the schedule) or suspended (ending the recovery window early). The `request`/`confirm` routes are tagged `@AllowSuspendedOrganisation()` for that reason, and the service lets a suspended Organisation through only for `permanent`.
- **Confirm starts the purge and returns.** Confirming suspends (if needed) with `purgeAt = now`, then starts `OrganisationPurgeService.purge()` without awaiting it. Wasabi deletion can be slow and can fail. If it fails, the hourly job retries it because `purgeAt` has already passed, the same crash-safety ADR-0021 relies on. Access ends at confirmation, and the data is gone within minutes (at most an hour).
- **Purging is a point of no return.** Once `purgeAt <= now` the Organisation is *purging*. `cancelDeletion` refuses, and new deletion requests are refused. This also closes an existing race on the normal path, where a restore landing between `purgeAt` and the hourly job could "restore" an Organisation with half its objects already deleted.
- **Owner's session ends at confirmation.** If the owner has no other Membership, the confirm response clears their refresh cookie, since their User is about to be erased. Otherwise they keep their session and move to another Organisation.
- **One notice per person.** No "suspended, restorable" email is sent for `permanent`. The completion emails `purge()` already sends are the only notice.
- **Audit.** `deletion_requested` records `mode: permanent`. Expediting the purge of an already-suspended Organisation records `organisation.purge_expedited` (ids only), which is kept through the purge alongside the other lifecycle rows, so `purged` arriving earlier than the earlier `suspended` row's `purgeAt` has an explanation.
