# Turning the machine on starts the timer

## The ask

A working day that begins without having to remember to press play, with a
dialog saying it happened and one click to undo it.

The app already registers itself to start at login on all three platforms
(`auto-launch.ts`, `linux-autostart.ts`, unconditional and before any auth
check, so it happens signed in or not), so only the timer is new.

*Registers*, as it turned out, is not the same as *starts*. Testing this
decision on a real boot is what finally caught it: on a Linux `.deb`
install the entry was written correctly and validated clean, but its
`Exec` omitted the `--no-sandbox` that both of electron-builder's own
entries pass, so the binary aborted before its first window every time the
machine came on — silently, with nothing in the session log. Clicking the
icon went through a different entry and worked, which is why it went
unnoticed. Fixed in `buildAutostartDesktopEntry`; the lesson for this ADR
is in **Not verified** below, and it is that nothing here was ever observed
on a machine being turned on.

**Hubstaff does not do this**, and an earlier draft of this ADR said it
did. Hubstaff has two separate things that are easy to merge into one:
[*"Automatically start Hubstaff"*](https://support.hubstaff.com/hubstaff-preferences-settings/),
a device preference that launches the **app** when the device powers on;
and [automatic tracking policies](https://support.hubstaff.com/what-is-automatic-start/),
where an **admin** sets a shift schedule, the agent prompts the person at
the scheduled time, and nothing starts if the app is closed. Neither one
starts a timer at power-on. This decision is ours, taken because it is what
was asked for here, and the Hubstaff-shaped alternative — a backend
schedule the admin owns — is recorded below as the road not taken.

## What this ADR decided

- **On by default, and a property of the machine.** The flag lives in
  `setup-state.json` beside "Always on top", and is toggled from the tray's
  **Preferences** submenu. "This is the laptop I work on" is true of a
  laptop, not of a person, and it needs no backend. On rather than opt-in:
  a preference somebody has to go and find before the feature does anything
  is a feature nobody has, and the dialog it raises offers to stop the
  timer it just started, so the first power-on is its own invitation to
  turn it off. An install that predates the preference reads the same
  default, so upgrading turns it on. The item is hidden while signed out,
  where it would promise something it cannot do.
- **Once per power-on, never per launch.** The agent relaunches itself after
  a crash and after an update, and neither is a working day beginning. The
  power-on is identified by Linux's `boot_id`, which a suspend does not
  change — so a laptop that sleeps overnight is not mistaken for one that
  rebooted, and equally does not get a timer on waking — and elsewhere by
  the boot time worked out from the clock and the uptime, compared with a
  two-minute tolerance to absorb its wobble.
- **The power-on is spent on the decision, not on the start.** Whatever is
  decided is stamped on disk as it is decided, so a crash mid-start cannot
  produce a second one — and, just as much, so that a start something else
  displaced cannot be collected later. The decision therefore has three
  answers, not two (`decideAutoStart`): *start*, *spend* (something came
  first; the power-on is used up anyway), and *wait* (spend nothing).
  Without the middle one, a boot whose start was displaced by an idle
  question stayed unspent, and the next thing to rerun setup — a sign-in,
  a Projects setting changing, the offline retry — started a timer hours
  later announcing that the machine had just come on.
- **Signed out is the one thing that waits.** A machine that comes on at
  its login screen has not had its chance yet, so nothing is spent and the
  start happens at the sign-in instead. That is the whole of "it should
  work whether logged in or not": the app launches either way, and the
  timer follows as soon as there is an account to track against. It
  follows only once — a sign-out and sign-in later the same day finds the
  power-on already spent.
- **The renderer starts it, through the play button's own path.** Main
  decides and spends; the renderer asks once setup has settled and then
  calls the same `startTracking` play calls. There must never be a second
  way to start a timer — the tray item follows the same rule for the same
  reason. It asks main *before* its own checks, never after, so declining
  to act on a decision still spends it.
- **It tracks what play would.** The remembered Project, else the first in
  the list, else no Project at all where the organisation has Projects
  turned off (the backend refuses a Project-less start anywhere else).
- **A question on screen comes first.** An idle stretch waiting to be kept
  or discarded, or a timer left running by a crash, displaces the automatic
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
  place could only disagree with the first. This is also why the trigger is
  the power-on rather than a time of day — a clock on the device would be
  exactly that second set of rules.
- **It works with no connection.** The decision reads nothing but local
  state, and the start is queued and replayed with its real time like any
  other (`docs/adr/0025-...`), so the dialog telling you the timer is
  running is telling the truth. A start that never reached the server is
  therefore not a refusal and says nothing: only an answer carrying a
  status goes to the shelf.

## The road not taken

Hubstaff's own shape: the admin defines a shift in the backend, and the
agent offers to start the timer during it. It puts the rule where every
other tracking rule in this product already lives, and it knows about
working hours, which a power-on does not — a machine rebooted for updates
at 2am gets a timer under this decision, and the person's only remedy is
the dialog's *Stop timer* the next morning, by which time the hours are
recorded. We did not build it because it needs a backend policy, an admin
UI and a per-occurrence prompt, and the ask here was for the device to
behave a certain way. If the 2am case turns out to bite, that is the
direction to go, not a schedule bolted onto the device.

## Verified

- **The whole thing on a real boot, on Linux.** A packaged `.deb` of this
  work, installed over the running one on Ubuntu 24.04 GNOME/Wayland: the
  machine was turned on, the app launched itself, and the timer started
  with its dialog. This is the test that found the `--no-sandbox` bug
  above, and it is the only one that could have — the automated tests
  drive the renderer against a fake main process, so they prove the
  decision and the dialog but never that a machine coming on produces
  them.

## Not verified

- The clock-and-uptime fallback on macOS and Windows, and the login-item
  registration either of them does. Linux is covered by `boot_id`, which is
  exact; the other two need a real machine to confirm that `os.uptime()`
  does not drift across a sleep far enough to read as a fresh boot. Given
  that the Linux login item was registering correctly and silently failing
  to launch anything, treat "the code looks right" on those two as meaning
  nothing until somebody turns a machine on.
