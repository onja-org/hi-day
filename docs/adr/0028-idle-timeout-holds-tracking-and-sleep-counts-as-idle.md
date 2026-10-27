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

- **The rule is now an input to `shouldRemind`** (`awaitingIdleAnswer`), not
  an early return beside it, and main reads the hold file for it as late as
  it can — once before the decision, and again after the day-totals request,
  which is a network round trip an idle timeout can land inside.
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
- **A backdated start keeps its time on the clock.** The renderer counted
  every newly adopted entry from "now", so right after Keep the kept
  minutes left the display and only came back when the entry ended or the
  window was reopened. The time was on the server throughout — but a
  timesheet that shows the time it just promised to keep as gone is not
  one anybody should be asked to trust. It now counts from the entry's own
  start (today's share of it, less any paused time).

The renderer also refuses to stack *any* two of these dialogs now: each
covers the whole window, so a second one both buries the first question and
takes the clicks meant for it.

## Not verified

- A real suspend and wake, which wasn't triggered on the development machine without the person's say-so.
- The suspend and resume hooks in main are covered by typechecking, plus tests of the pieces they call: the hold store, `whenInputStopped`, the backdated durable stop, and the renderer's handling of a wake.
