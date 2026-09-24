---
status: accepted
supersedes: 0006-time-entries-single-running-timer-server-authoritative
---

# A timer runs per Device, and a person's hours are the union of their devices' time

ADR-0006 enforced at most one running Time entry per Membership, in the database, via
`CREATE UNIQUE INDEX ... ON "time_entries" ("membershipId") WHERE "endedAt" IS NULL`. One
consequence was not anticipated: because every device resolves "the running timer" by
person, **pausing or stopping on one machine pauses or stops every machine**. A person
running the app on a laptop and a desktop found the two welded together — the second
device's 15s poll reads the same row the first just changed — and starting a timer on a
second device failed outright with a 409.

That is the right behaviour for "I moved machines" and the wrong behaviour for "I work on
two machines at once", which is the case this changes.

## Considered options

- **Keep one timer per Membership, and auto-move it to whichever device acted last.**
  Rejected for the reason ADR-0006 gave and which still holds: silently ending a timer
  running on a machine the person is not looking at mutates hours that feed payroll
  without them choosing it. It also does not give parallel tracking at all.

- **One timer per Device, and sum the entries for reporting.** Rejected. Two devices
  tracking 09:00–10:00 would report two hours worked in one hour of wall clock. Hours
  would stop being bounded by elapsed time, and everything derived from them — the
  dashboard, timesheets, anything billed — would inherit that silently. The doubling is
  worse than the original bug because it is invisible.

- **One timer per Device, and let concurrent timers run on different Projects.**
  Rejected. It relocates the double-count rather than removing it: the person's union is
  correctly one hour, but Project X and Project Y each claim an hour. Project totals are
  what most billing hangs off, so this is the same failure one level down. Concurrent
  entries must share a Project; a second device may join the project already running, and
  a *different* project is refused with a 409 naming the project and the other machine's
  hostname (a UUID told the person a timer was running *somewhere* and left them hunting).

- **Give the web console its own independent timer.** Rejected. The web has no Device and
  is an account-level surface: it reports a timer running on *any* device and its stop
  ends tracking everywhere. Letting it also hold a parallel timer of its own would mean a
  person could double their own hours from one browser tab. Its start is refused while
  anything is already running.

## Consequences

The index becomes `UNIQUE ("membershipId", "deviceId") NULLS NOT DISTINCT WHERE "endedAt"
IS NULL`. **`NULLS NOT DISTINCT` is the load-bearing part** — Postgres treats NULLs as
distinct by default, so without it the web (which writes `deviceId IS NULL`) could open
unlimited parallel entries, defeating the paragraph above. It requires Postgres 15+, and
like its predecessor the migration is hand-written because `migration:generate` does not
reliably round-trip a partial index's `WHERE` clause. `down()` recreates the old index and
will fail if a person legitimately has two open entries — deliberately, rather than having
the migration pick one to close.

**Worked time is now a union, not a sum** (`common/time-entry-union.util.ts`). It operates
on *active intervals* — each entry's span less its pause spans — so a pause on one device
does not subtract time another device was still tracking; the person was working, on the
machine that kept running. Anywhere hours are totalled must union rather than add;
`DashboardService` does, and the frontend's own summing (`groupTimeEntriesByDay`,
`buildProjectDayMatrix`) still needs auditing for the same reason.

`GET .../time-entries/current` gains `workedSeconds`, the union across every open entry.
Clients display that instead of deriving elapsed time from `entry.startedAt`, so a second
device starting at 10:00 shows the hour the first already accrued rather than starting
from zero. A paused device freezes its own display and re-syncs on resume; offline, a
device falls back to its own elapsed time and re-syncs on reconnect.

"Log out everywhere" and password reset now stop *every* running timer, not one — every
Device is revoked, so every Device's timer must be closed or it stays open forever.
Ordinary logout is unchanged and still stops nothing (ADR-0017).

The stale-entry sweeper stays Membership-wide, and the team dashboard still shows a person
once however many devices they are tracking on — a manager wants people, not machines.

## Deferred

`switchTo` is device-scoped but unguarded: switching Device A to Project Y while Device B
runs Project X produces exactly the concurrent-different-projects state this ADR forbids
at `start`. Known and accepted for now; the union cannot attribute that hour, so it needs
the same guard `start` has.
