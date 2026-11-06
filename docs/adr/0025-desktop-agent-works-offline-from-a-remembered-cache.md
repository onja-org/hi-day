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

**The `opId` is generated before the first attempt, not when the operation is queued.** It was the
latter, which left the first attempt anonymous — and the lost response that attempt can suffer is the
single case the id exists for. A request the server had already applied, abandoned at the
five-second `REQUEST_TIMEOUT_MS`, queued a *differently named* copy of itself; the replay then met a
409 for a start or a 404 for a stop, and the person was told their hours could not be saved after
they had been. `pause` was worse: it carried no id at all, on either attempt, because the endpoint
had no field for one — and `pauseDurably`, which writes its record ahead of the network precisely
because the machine is already shutting down, is the likeliest place of all for a reply not to
arrive. `POST /device/time-entries/pause` now takes an optional `opId` (older agents simply keep the
old at-least-once behaviour) and `TimeEntriesService.pause` passes it to `stop`.

**The sweeper's guess yields to a real stop even when the Device has started something since.**
`abandonedEntryToExtend` took the Device's newest entry and gave up if that one was not
`closedAsAbandoned` — but the crash prompt's "I was still working" answer deliberately starts a
fresh entry, so a queued stop arriving after it found the new entry, refused, and 404'd. Those hours
were real and had already been truncated to the last heartbeat (`HEARTBEAT_INTERVAL_MS`, 60s), so up
to a minute of genuinely worked time was reported to the person as lost. It now looks for the latest
entry the sweeper closed regardless of what followed, and extends it only when doing so stays within
the next entry's start — touching endpoints are fine, a real overlap still refuses and still says so.

**A session ending deletes the captures and keeps the hours.** One Device serves everybody who signs
in on a machine, so every queued item carries the owner who made it (`session-owner.ts`:
`user:<userId>|org:<organisationId>`, falling back to email and Organisation name for a session
stored before pairing returned ids). Logging in deletes whatever belongs to somebody else, which is
what makes keeping anything safe. Screenshots, app events and URL sessions are deleted the moment a
session ends anyway — they belong to the session that took them, and leaving them on a shared machine
is a disclosure. Queued *timer* actions are not: they are hours somebody worked, the owner stamp
means they can only ever reach their own timesheet, and the person replays them at their next login.
Deleting them was how a remote sign-out in the middle of an offline stretch silently erased a day's
tracking. The logout path still tries to send them first — the last moment the token works — so
keeping them is the fallback, not the plan.

**A switch carries two ids, because it writes two rows.** It ends the running entry and starts the
next in one request, and offline the same action is recorded as a stop and a start — so one id cannot
name it. `POST /device/time-entries/switch` takes `stopOpId` and `startOpId`, writes them to the two
rows, and the queued pair replays under those very ids. Without them a switch the server applied but
could not answer replayed as two anonymous operations: the stop met the entry the switch had just
started and was refused for ending before its own start, and the start met a timer already running.
Both were reported to the person as time that could not be saved, for work that had landed.

**Replay is idempotent for time entries only.** Each queued operation carries an `opId` generated once
and reused on every replay; `startOperationId`/`stopOperationId` on `time_entries` are unique
(partial, so the web and every pre-existing row may stay null). The service checks for an existing row
first, and treats a unique violation as the replay it is — two replays racing each other both pass the
check, and only the database can settle which wrote. Screenshots and app events keep their existing
at-least-once delivery: a duplicate image is a shrug, duplicate hours are a payslip.

**A queue that has stopped draining is said out loud**, which qualifies the point above rather
than contradicting it. An unreachable server is not an error; tracked data that has not reached
anybody for five minutes is worth knowing about, and the quiet "Can't reach Hi Day — retrying" line
reads as transient because usually it is. The queue is what makes a dropped connection cost nothing,
and therefore also what lets it fail in silence: data piles up on disk, the timer looks entirely
normal, and nothing says none of it has landed. The warning needs *both* halves — unsent data **and**
a server that has not answered — since warning about an outage with nothing queued would be a lie,
and a queue draining normally is not a backlog. The wording carries as much weight as the rule: it
says the data is not lost before it says anything else, because "your data may not be synced" alone
reads as "your hours are gone", and somebody who believes that starts keeping their time elsewhere.

**Answering "I was still working" has to reclaim the entry, not just assume it.** The sweeper ends a
timer whose device has gone quiet for half an hour, and a crash stops the heartbeat — so by the time
somebody is asked about a forty-minute gap, the entry they are being asked about has already been
closed underneath them. Keeping it is then a stop dated *now*, which extends that closed entry to
this moment (the server only ever extends one it closed itself), plus a fresh start carrying the
same Project and Task forward. **Two touching entries, not one**: that is the shape `switch` already
produces and the overlap rules explicitly allow, and reopening a closed entry would need an endpoint
that does not exist. With the server unreachable it does nothing instead — the local entry stays
open, and whenever the person does stop, that stop extends the closed one to the real time anyway.

**Refused hours are reported, not dropped.** `PendingTimerOps.flush` returns what the server refused
alongside whether it settled, and the renderer shows it in the dialog a refused start already uses.

**"Refused" means the server decided, not merely that it answered.** The first cut of this read any
HTTP status as the server's answer and took the operation out of the queue on it — which is right for
a 403 from a work time limit and wrong for every 500, 502, 503, 429 and 408 there is. Reconnecting
into a deploy or a busy minute therefore deleted hours somebody had really worked, and a start lost
that way took its paired stop with it, leaving the entry open server-side as well. `serverVerdict`
now splits four cases — *accepted*, *rejected*, *undecided*, *signedOut* — and only a rejection takes
an operation out of the queue. The rejection statuses are an **allowlist** (400, 403, 404, 409, 410,
422) rather than "any 4xx": this product is self-hosted more often than not, and a reverse proxy, WAF
or captive portal between the agent and the backend can answer anything at all. Mistaking one of
those for a verdict costs somebody their afternoon; retrying one that really was final costs a queue
that drains late and says so out loud. An *undecided* answer also backs the replay off (the existing
`computeRetryDelayMs`, in memory so a relaunch always retries at once), because every device that
failed against a deploy is about to retry in the same second — a transport failure does **not**, since
the fifteen-second tick is the only thing that notices a reconnection.

**A revoked session keeps its queue, and says so.** A 401 is not a verdict on the work: it is the
absence of anyone to decide. The hours stay, the agent signs out locally — the replay loop is the one
caller that does not go through `callDeviceApi`, so it had been retrying a dead token every fifteen
seconds in silence — and a login brings both back. Keeping them is only safe because the queue now
carries an **owner**: a hash of the email that filled it, checked on every read. The email alone and
not the Membership, because `organisationName` is stamped at pairing and never refreshed — folding it
in would have an Organisation renamed between a sign-out and the next pairing silently discard a
queue, which is the failure this exists to prevent. Somebody re-pairing the same machine into a
second Organisation of their own replays against it instead, where every Project id belongs to the
other one and comes back a 404 they are shown.

**That owner is deliberately not the `deviceId`,** and the claim above that keying `offline-cache.json`
to one means "re-pairing as somebody else reads as an empty cache" is **wrong**. Pairing goes through
`DeviceSessionService.upsertOnLogin`, which upserts the Device row by machine fingerprint and keeps
its id when the machine changes hands — reassigning `userId` and revoking the old sessions, but never
issuing a new id. A device id says which laptop, never which person. The offline cache still has this
gap (it leaks the previous person's projects, settings and totals to the next one on a shared
machine); it is left for its own ticket rather than smuggled in here, and is only a disclosure, where
the same mistake in the queue would write one person's hours to another's timesheet.

`WM_SIMULATE_OFFLINE=1` makes `ApiClient` behave as though nothing can be reached, in front of every
request — the only place that reproduces the real shape of being offline everywhere at once. The
cases worth testing (a week-stale capture setting, hours replayed and refused, a crash mid-outage)
are otherwise close to unreachable by hand.

## Not done here

Offline pairing, which is impossible. Idempotency for screenshots and app events. Offline idle
*reassignment* and the midnight rollover, both of which need the server's clock and its view of other
devices (ADR-0022's union). Marking a backdated entry in the UI so an admin can see it was replayed
from an offline device — a real feature with its own surface, deliberately not smuggled in here.
