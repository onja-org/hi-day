# Turning the machine on can start the timer

## The ask

Hubstaff can start its timer when the device powers on, and people asked for
the same here: a work day that begins without having to remember to press
play, with a dialog saying it happened and one click to undo it.

The app already starts itself at login on all three platforms
(`auto-launch.ts`, `linux-autostart.ts`), so only the timer is new.

## What this ADR decided

- **Opt-in, and a property of the machine.** The flag lives in
  `setup-state.json` beside "Always on top", and is toggled from the tray's
  **Preferences** submenu. "This is the laptop I work on" is true of a
  laptop, not of a person, and it needs no backend. Off until asked for: a
  timer nobody started is a surprise worth opting into. The item is hidden
  while signed out, where it would promise something it cannot do.
- **Once per power-on, never per launch.** The agent relaunches itself after
  a crash and after an update, and neither is a working day beginning. The
  power-on is identified by Linux's `boot_id`, which a suspend does not
  change — so a laptop that sleeps overnight is not mistaken for one that
  rebooted — and elsewhere by the boot time worked out from the clock and
  the uptime, compared with a two-minute tolerance to absorb its wobble. The
  identity is stamped on disk as the decision is taken, whatever becomes of
  the start, so a crash mid-start cannot produce a second one.
- **The renderer starts it, through the play button's own path.** Main
  decides and stamps; the renderer asks once setup has settled and then
  calls the same `startTracking` play calls. There must never be a second
  way to start a timer — the tray item follows the same rule for the same
  reason.
- **It tracks what play would.** The remembered Project, else the first in
  the list, else no Project at all where the organisation has Projects
  turned off (the backend refuses a Project-less start anywhere else).
- **A question on screen comes first.** An idle stretch waiting to be kept
  or discarded, or a timer left running by a crash, suspends the automatic
  start: those ask about time already worked, and this would answer them by
  accident. The renderer checks the same thing again before it starts, since
  a dialog can go up between the decision and the act.
- **Success is a dialog; a refusal is a notification.** The dialog says what
  it started and offers *Stop timer* / *OK* — a one-click undo of something
  that happened without being asked. A refusal (a day the admin has tracking
  off, a spent work limit, an account with no Projects) goes to the
  notification shelf instead: nobody clicked anything, so nothing needs
  dismissing, and a modal at login because today is Saturday is nagging
  about a rule you cannot act on. Where another question owns the screen,
  the success notice becomes a notification too, so the start is never
  silent either way.
- **The admin's rules stay the admin's.** No local schedule: the backend
  already refuses on `trackingDisabledDays` and past a work time limit, and
  the notification repeats what it said. A second set of rules in a second
  place could only disagree with the first.
- **It works with no connection.** The decision reads nothing but local
  state, and the start is queued and replayed with its real time like any
  other (`docs/adr/0025-...`), so the dialog telling you the timer is
  running is telling the truth.

## Not verified

- The clock-and-uptime fallback on macOS and Windows. Linux is covered by
  `boot_id`, which is exact; the other two need a real machine to confirm
  that `os.uptime()` does not drift across a sleep far enough to read as a
  fresh boot.
