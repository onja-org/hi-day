# At the idle timeout tracking stops and waits for an answer, and sleep counts as idle time

Amends `docs/adr/0007-...`, which had the timer keep running while the idle prompt was open.

## The bug

Tracking stopped before the organisation's idle timeout was reached. The renderer's own idle check was right: it does nothing until idle time reaches the threshold. Sleep was the problem. The suspend handler paused the running timer, and on the backend a pause now ends the entry. Nothing started it again on wake. GNOME suspends a laptop on battery after 15 idle minutes by default, so with a 20-minute timeout, someone who stepped away for 17 minutes came back to a stopped timer. The 15 minutes of sleep were lost as well, although they were well inside the timeout. Confirmed as the trigger by the person who saw it.

## What this ADR decided

- **Before the timeout, nothing happens.** The timer runs on, and coming back carries on as if nobody had left.
- **At the timeout, tracking stops where input stopped and waits.** It used to keep running until answered, which let a question nobody answers (a laptop closed overnight) run up hours. The entry is ended, backdated to the start of the idle stretch, and the Keep/Discard prompt goes up. A prompt waiting for an answer is an *idle hold*.
  - **Keep** starts again from where input stopped, so the idle stretch counts once, with no gap and no overlap.
  - **Discard** starts again from when the person came back, not from when they answered. Only the idle stretch is dropped, and work done between coming back and clicking is kept. The return is noticed from the idle reading falling.
  - **Assign to another project** starts the other Project from where input stopped, as before.
  - Each restart is a new entry, so the stretch before and the stretch after become two back-to-back entries, as pause and resume already produce. `resolveStartedAt` clamps a backdated start to the previous entry's end, so they cannot overlap.
- **Sleep is idle time.**
  - **At suspend:** the entry ends where input stopped, worked out from the last idle reading the renderer asked main for, if under a minute old. A hold is written to disk before the stop is sent.
  - **On wake:** the renderer reads the status (main stopped the timer while it slept) and judges the whole stretch, from the last input before sleep to the wake:
    - **inside the timeout:** tracking picks up from where input stopped, with no prompt
    - **past it:** the same prompt as above, saying the computer was asleep
  - The stop goes through the durable write-ahead path (`pauseDurably`, now taking an end time), so it survives the machine never waking.
- **The hold is kept on disk by main** (`idle-hold.json`). The question outlives a renderer reload, a relaunch after an auto-update, and a crash. On start-up, a hold with no recorded return gets one, because whoever is at the machine is back. A timer already running by then (started on the web, say) means the hold is dropped. Logging out clears it.
- **The other modes:**
  - `auto_subtract` still stops at idle start with nothing to ask, and stays stopped past the timeout. A sleep inside the timeout resumes like everywhere else.
  - `off` has no timeout to measure against, so sleep still just pauses, as before.
- **When input stopped before a sleep comes from main's own reading.** While a timer runs, main samples idle every 10 seconds itself (`whenInputStopped`, falling back to "now" without a reading under a minute old). The renderer's poll is throttled while its window sits hidden in the tray, so a stale reading would date the stretch from the sleep instead. That would resume silently, after someone was away past the timeout, in exactly the reported case.
- **A refused restart keeps the question open.** If Keep, Discard or a resume is refused (a work limit, say), the hold and the prompt stay, with the error shown. Dropping them would lose the idle time with no way left to keep or discard it.
- **No not-tracking reminder while a hold waits.** The prompt already asks.
- **The audit trail states facts, not conclusions.** A backdated stop used to be logged as `{ reason: 'idle', discardedSeconds }`. Every hold now backdates a stop, including Keep and a short-sleep resume, and offline replays always did, so "discarded" was often false. Backdated stops and starts now record `backdatedSeconds`. A Keep shows as a start backdated by the idle stretch; a Discard shows as one that isn't.
- The decisions live in a pure module (`src/renderer/idle-hold.ts`), tested by table across thresholds, return times and modes. The renderer's behaviour is tested end to end by running the real renderer in jsdom (`renderer-tracking-recovery.spec.ts`).

## Holes found after it shipped

Reported from a packaged build: the not-tracking reminder was sitting on top
of an open idle question, and the idle time was gone afterwards. "No
not-tracking reminder while a hold waits" was decided above and implemented,
but only as a single check against the hold file, at the top of a tick that
then awaits two more things. Four holes, all now closed:

- **The reminder is now only ever about a stop the person made.** The
  original rule — quiet while a hold waits — described the symptom. The rule
  it should have been: this nudge exists for someone who forgot to start
  their timer, so a timer the *agent* stopped is never its business. An idle
  timeout, an auto-subtract, a sleep, a day boundary and a limit the
  organisation set all already explain themselves where they happen, and
  being told "you are not tracking time" because of something the app did
  reads as an accusation. Main marks the stretch (`timerStoppedByAgent`,
  set wherever a timer ends and cleared wherever one runs again) and
  `shouldRemind` refuses on it.
- **The hold file is still read, as a second guard** (`awaitingIdleAnswer`),
  because it survives what the flag cannot: a hold read back off disk after
  a relaunch belongs to a stop that process never saw. It is now an input to
  the rule rather than an early return beside it, and main reads it as late
  as it can — once before the decision, and again after the day-totals
  request, which is a network round trip an idle timeout can land inside.
- **The question re-saves its hold whenever it goes back up.** A prompt on
  screen with no hold on disk is what let a reminder through on top of it,
  and a reload would have lost such a question outright. The two now go up
  and come down together, so "the question is open" has one answer.
- **A timer started some other way says what it cost.** The tray, the web
  or another device starting one while the question waits settles it the
  only way it can — tracking from the moment they pressed, with the idle
  stretch uncounted. That was done silently, which is exactly how "I
  answered and my time vanished" happens; it now says so in the notice line.
  A Keep or Discard still in flight is not that case and says nothing.
- **The answer shows on the clock the moment it is given.** Two things now
  put it there: the entry's own start is what the live clock is seeded from
  (below), and a restart that actually reached the server is followed by the
  same resync a relaunch does, so the figure on screen is the server's own
  within the same click. The resync is skipped for a start that was queued
  rather than sent — offline, `status` answers with the cache's projection
  of a figure belonging to the entry that just ended, and letting that
  overwrite an exact local one would reinstate the bug on the offline path.
- **A backdated start keeps its time on the clock.** The renderer counted
  every newly adopted entry from "now", so right after Keep the kept
  minutes left the display and only came back when the entry ended or the
  window was reopened. The time was on the server throughout — but a
  timesheet that shows the time it just promised to keep as gone is not
  one anybody should be asked to trust. It now counts from the entry's own
  start (today's share of it, less any paused time).

- **A refused answer is said inside the question.** `0028` decided the
  question stays open when Keep or Discard is refused, and it did — but the
  refusal went to one of two wrong places. A 403 (a work time limit) opened
  the "Timer could not be started" dialog *over* the question; anything else
  went to the red line above the timer, which sits *behind* the question's
  own full-window layer and so was never seen at all. Either way the button
  looked dead, which is the same experience as the bug this ADR is about.
  The question now carries its own line (`#idle-error`). Offline needs no
  special case: that start is queued rather than refused.

- **The question survives the wake going wrong.** Reported from a packaged
  build: a lid closed, a walk to another building, and the timer stopped on
  arrival with nothing asking about the time in between. Three ways the
  question could be lost, all closed. It was chained behind the status read
  (`refreshStatus().then(settleIdleHold)`), so a read that threw — waking on
  a strange network, or none — took the question with it, and only a
  relaunch brought it back; it now runs whether that read succeeds or not,
  at launch as well as on waking. A wake the OS never reports left nothing
  to put it back on screen, so reopening the window settles a stored hold
  too. And "a timer is already running, so drop the hold" was decided from
  the renderer's own copy of the running entry — stale after a sleep by
  definition, since main ended that entry while the machine was off — which
  a failed read left looking alive; it now asks main what is really running
  (answered from the cache offline), and asks the person when nothing can
  answer at all. A hold dropped because tracking resumed elsewhere says how
  many idle minutes went uncounted rather than going quietly.

- **Tracking again takes the nudge down, however it was started.** The
  reminder used to come down only for its own two buttons, so starting the
  timer from the tray menu — its Start timer item or a Project under Recent
  projects — left it sitting over the window with nothing to dismiss it,
  and over the idle question when that arrived underneath it later. Any
  running timer now clears it, whoever started it: the tray, the web,
  another device. The question clears it too, which closes the race where a
  nudge is delivered in the instant before the question goes up and so
  passes the one-at-a-time check on its way in.

The renderer also refuses to stack *any* two of these dialogs now: each
covers the whole window, so a second one both buries the first question and
takes the clicks meant for it.

**Offline changes none of this.** The idle stop and the Keep/Discard start
are queued rather than failed (`docs/adr/0025-...`), so the question goes up
and comes down exactly as it does online, with the backdated times replayed
on reconnect. `timerStoppedByAgent` is set before the request rather than
after it, so a timer that stops with no connection is still known to have
been stopped by the agent.

**Known consequence.** After a stop the agent made, nudges stay off until a
timer runs again — so someone whose timer auto-subtracted at lunch, or who
left the idle question unanswered, and then works untracked all afternoon is
not nudged about it. That is the rule working as decided: the alternative is
nagging people about stops they did not make. If the quiet turns out to cost
more than the nagging did, the smaller change is to clear the flag once the
person is back at the keyboard (idle under the presence limit) with the idle
question already settled.

## Not verified

- Which stop set `timerStoppedByAgent`. The rule that reads it is tested by table; the flag itself is set across main's IPC handlers, the sleep handler and the stopped-for-you alert, where there is no harness — typechecking and the fact that every stop in the agent goes through exactly one of those paths is what stands behind it.
- A real suspend and wake, which wasn't triggered on the development machine without the person's say-so.
- The suspend and resume hooks in main are covered by typechecking, plus tests of the pieces they call: the hold store, `whenInputStopped`, the backdated durable stop, and the renderer's handling of a wake.
