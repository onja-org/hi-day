---
status: accepted
---

# The desktop agent works offline from a remembered cache, and the server verifies what it hands back

ADR-0006 made the running timer server-authoritative and, in the same breath, rejected letting the
client supply its own timestamps — explicitly "for this pass", noting that "the desktop agent has no
offline queue yet" and that "a future offline-capable agent revisits this and will need clock-skew
clamping when it does." This is that revisit.

## The state this replaces

The agent held its entire picture of the organisation in renderer memory and asked for it again on
every launch. With no connection it reached the logged-in screen (the session is on disk), failed its
first request, and stopped setting itself up: no projects, no clock, and a **play button that
silently did nothing** — `startTracking` guarded on a `projectsLoaded` flag that was never set, and
re-ran a setup that failed again. `PendingTimerOps` already knew how to queue a backdated start or
stop and replay it, but the only door to it was that play button, so none of it was reachable.

Three further gaps sat behind it, each invisible until looked for:

- **The running entry lived in memory.** A restart offline met somebody looking at a ticking clock
  and told them "No timer is currently running."
- **The abandoned-timer sweeper was the real offline limit.** A device that stops heartbeating for
  `ABANDONED_TIMER_GRACE_MS` (30 minutes) has its entry closed at its last heartbeat. Everything past
  the first half hour of any outage was deleted server-side, and the real stop arrived to find no
  entry at all. "Offline tracking" was capped at thirty minutes, and nothing said so.
- **Replay was at-least-once.** A reconnect that died after the server committed but before the
  response arrived would send the same start again.

## Considered options

- **Make the agent authoritative for its own timer, online and offline.** Rejected. It is a rewrite
  of the timer model, and it discards the conflict detection ADR-0006 built for a shared machine.
  The agent instead only ever *remembers* what the server last said, and records the person's clicks
  to replay. Nothing in the cache is a decision the agent made.

- **Keep a second local ledger of entries, reconciled on reconnect.** Rejected. It duplicates
  `PendingTimerOps` with a store that can disagree with it, and someone then has to write the merge.
  The queue already is the record of what happened while offline.

- **Cap how long the agent may track offline.** Rejected, having first chosen it. Hubstaff — which
  this product already follows on "tracking follows being clocked in" — states plainly that it
  *"does not impose a time limit on offline tracking"*, and the reasoning holds: somebody on a remote
  site, a ship, or a long trip is exactly who offline tracking is for, and refusing their hours on
  day eight punishes the person for their internet. **Capture is capped and tracking is not**, and
  the two are deliberately different promises — see Consequences.

- **Raise the sweeper's 30-minute grace to cover long outages.** Rejected. A machine that genuinely
  dies would then leave a timer running for weeks, which is precisely what the sweeper exists to
  prevent. Instead the sweeper now *marks* what it closed (`closedAsAbandoned`), and a Device that
  reconnects with a real stop extends that entry to it. The sweeper's end is a guess made in the
  absence of information; when the information arrives, the guess yields. A stop somebody actually
  made is never touched.

- **Resume a recovered timer silently after a crash.** Rejected, having first chosen it. The app
  cannot know whether the machine was off for a minute or two days, and silently resuming credits
  hours nobody worked. Hubstaff asks, within a one-hour window, and discards past it; this does the
  same, reusing the Keep/Discard shape the idle prompt already has. Past the hour the entry is ended
  where it was last seen alive, so nothing is claimed for the silence.

- **Clamp an over-old start to the floor instead of rejecting it.** Rejected, and it is the local
  convention (`resolveStartedAt` moves a future start to "now" rather than refusing it). Clamping a
  month-old start would invent a month-long entry rather than correct a small error. It is rejected,
  and the agent **tells the person** rather than dropping it in silence, which is what it used to do.

- **Show today's totals as a dash while offline.** Rejected in favour of showing the figures as last
  known, stamped with the day they belong to. A dash is honest but useless; yesterday's hours shown
  on a new morning would be worse than either, so `todayTotals` withholds a stamp that is not
  today's and the day starts clean.

## Consequences

**One JSON file, `offline-cache.json`, holds the last answer to everything the agent needs** —
projects and whether the org uses them, the last-tracked Project's tasks, capture settings, the idle
policy, the running entry, the day's totals, and when the server was last heard from. Deliberately
not a table in `offline-queue.db`: that queue is a list of things waiting to be *sent*, drained and
deleted as they land; this is the opposite, the last thing *received*, overwritten in place. It is
keyed to a `deviceId`, so re-pairing as somebody else reads as an empty cache rather than as the
previous person's projects.

**Every cached read writes through on the way past** (`cachedDeviceRead` in `main.ts`) and is served
back only on a *transport* failure — `isTransportFailure`, meaning no HTTP status at all. A 403 or a
sign-out is the server's answer and is passed through untouched. `TrackingResult` gained `fromCache`
so the renderer can say "Can't reach Hi Day — retrying" rather than claiming to be synced.

**The idle policy is cached, which is a correctness fix and not a convenience.** `checkIdle` returns
early with no policy, so an offline machine left running overnight recorded the whole night.

**Both gates can be primed** from the cache before their first poll. Holding the last value through
an unreachable server (which `CaptureSettingsGate` already did, and `TimerStatusGate` gained
separately) is no help on a cold start, where there is no last value to hold: an agent relaunched
mid-outage began at "off" and stayed there. Priming sets the *remembered* value as well as applying
it, or a later poll agreeing with the cache would read as "no change" and never be applied.

**Capture stops after seven days out of touch; tracking never stops.** These are different promises.
Hours are the person's own, and an outage is no reason not to pay them. The capture settings say
whether this person's screen may be photographed, and an admin who switches that off is owed an upper
bound on how long a machine that never heard them keeps going. It is **said, not silent** — a notice
reaches the renderer — because capture disappearing without explanation is the same opacity this
product exists to avoid.

**Offline is no longer shown as an error.** `handleTrackingFailure` swallows transport failures: the
red line above the timer named a server address nobody can act on, for a state in which nothing has
gone wrong. Logging in is the exception, since pairing genuinely cannot work offline, and says so in
plain words.

**The server now verifies what a device hands back.** `resolveStartedAt` already clamped a future
start to "now" and pushed it past the device's last ended entry; what was missing was a floor, so a
machine with a wrong clock could write hours into any month it liked. `MAX_DEVICE_BACKDATE_MS` is 30
days — generous, and deliberately *not* the agent's own 7-day capture cutoff. Device routes only:
hand-typed timesheet corrections are a person deliberately entering a date, with a name attached, and
are supposed to reach back.

**Replay is idempotent for time entries only.** Each queued operation carries an `opId` generated once
and reused on every replay; `startOperationId`/`stopOperationId` on `time_entries` are unique
(partial, so the web and every pre-existing row may stay null). The service checks for an existing row
first, and treats a unique violation as the replay it is — two replays racing each other both pass the
check, and only the database can settle which wrote. Screenshots and app events keep their existing
at-least-once delivery: a duplicate image is a shrug, duplicate hours are a payslip.

**Refused hours are reported, not dropped.** `PendingTimerOps.flush` returns what the server refused
alongside whether it settled, and the renderer shows it in the dialog a refused start already uses.

`WM_SIMULATE_OFFLINE=1` makes `ApiClient` behave as though nothing can be reached, in front of every
request — the only place that reproduces the real shape of being offline everywhere at once. The
cases worth testing (a week-stale capture setting, hours replayed and refused, a crash mid-outage)
are otherwise close to unreachable by hand.

## Not done here

Offline pairing, which is impossible. Idempotency for screenshots and app events. Offline idle
*reassignment* and the midnight rollover, both of which need the server's clock and its view of other
devices (ADR-0022's union). Marking a backdated entry in the UI so an admin can see it was replayed
from an offline device — a real feature with its own surface, deliberately not smuggled in here.
