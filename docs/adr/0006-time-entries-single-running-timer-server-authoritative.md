---
status: superseded
superseded-by: 0021-one-running-timer-per-device-hours-are-a-union
---

# A start/stop timer is server-authoritative and single-running-per-Membership; a collision rejects instead of auto-stopping

Added the first Time entry sub-feature of the Time Tracking epic: starting and stopping a timer from either the web console or the desktop agent, kept in sync through one backend (`TimeEntriesService`) that both surfaces call into — the web console through `organisations/:id/(projects/:projectId/)time-entries/*`, the agent through the mirrored `device/(projects/:projectId/)time-entries/*` routes, authenticated by the device's bearer token instead of a JWT.

## Considered options

- **Auto-stop the previously running timer when a new one starts.** Rejected. The PRD frames this product as a transparent, trust-first alternative to covert monitoring tools, and the epic's own "Risks" section calls out that the idle-policy default matters for trust — the same reasoning extends to timers. Silently ending a timer running on someone's *other* device (because they forgot it was running, or started one somewhere else) mutates hours that feed payroll without the person choosing that. `start` instead returns `409 Conflict` carrying the entry that's already running; a separate `switch` action does the stop-then-start atomically, in one transaction, only when explicitly requested.
- **Let the client supply `startedAt`/`endedAt`.** Rejected for this pass. The epic requires entries to "store an unambiguous instant," and the desktop agent has no offline queue yet (that's deferred — see `docs/TECH_DESIGN.md`'s offline queue, not built here). Timestamps are assigned by the server on receipt; a future offline-capable agent revisits this and will need clock-skew clamping when it does.
- **Trust `Device.userId`/`Device.organisationId` for agent-authenticated requests.** Rejected. Both fields reflect whoever most recently logged into that physical machine (see `Device`'s own field comment and CONTEXT.md's Device entry) — a shared machine re-logged-into by a different person reassigns the row. `DeviceSession` already carried `userId` for exactly this reason; this change adds `organisationId` to it too (backfilled from `Device.organisationId` in a migration, set at issuance going forward) and has `DeviceSessionGuard` expose both on the request, so every agent-authenticated route resolves identity from the *session the bearer token was issued for*, not the device's current state.
- **Push updates (WebSocket/SSE) so both surfaces update instantly.** Rejected for this pass — no such infrastructure exists yet (see `docs/TECH_DESIGN.md`'s job-queue/ingest design, which is batching/polling-shaped throughout, not push-shaped). Both the web console and the agent instead poll `GET .../time-entries/current` every 15s, which also returns the server's own clock (`now`) so both surfaces tick elapsed time from the same origin rather than trusting their own — a real-time push layer is a reasonable later upgrade, not a redesign, since `current` stays the read both would still need.

## Consequences

"At most one running Time entry per Membership" is enforced by a **partial unique index** (`UNIQUE (membershipId) WHERE "endedAt" IS NULL`), not just application logic — a race between two clients (say, the web console and the agent, started within the same second) can't ever produce two open entries; the loser gets a real constraint violation, not silent data corruption. `TypeORM migration:generate` doesn't reliably round-trip a partial index's `WHERE` clause, so this migration (and the one adding `DeviceSession.organisationId`) was hand-written and run against a real database to confirm the SQL, not just eyeballed.

Starting a timer against a Project requires the same access `ProjectMemberGuard` already grants elsewhere — an org admin/manager, or a Membership's own `ProjectMembership` on that specific Project — kept deliberately identical between the web and device paths (`ProjectMemberGuard` vs. the new `DeviceProjectMemberGuard`) so the two surfaces can never disagree about who's allowed to track time where. Archiving a Project now also checks for a running Time entry first and rejects if one exists, rather than leaving a timer orphaned against a Project that "accepts no changes at all."

Not built in this pass, and worth tracking as the epic continues: manual time entry/editing and its audit trail (the next epic sub-task), idle detection, and the desktop agent's offline queue.
