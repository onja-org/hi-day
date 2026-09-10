# Stage D.1 spike results — Linux feasibility

Real output from running `probe.sh` (see that file and `probe.py`) — nothing here is guessed.
Every row states which real machine it came from; anything not yet run says so plainly rather
than being filled in with a plausible-looking guess.

## Ubuntu 24.04.4 LTS, GNOME Shell 46.0, Wayland session

Run on 2026-09-10, `ubuntu:GNOME` desktop, `XDG_SESSION_TYPE=wayland`.

| Item | Result |
|---|---|
| 1. Session/compositor | Wayland + GNOME — in scope per Step 20's rule. |
| 2. `org.gnome.Shell.Introspect.GetWindows` | **`AccessDenied: GetWindows is not allowed`** — called with plain `gdbus`, no special privileges. This is a real block, not a missing-permission prompt to grant. |
| 3. AT-SPI2 bus | Running (`org.a11y.Bus.GetAddress` resolved; `at-spi-bus-launcher`/`at-spi2-registryd` both present). `toolkit-accessibility` is `false` (the GNOME default) — left unchanged by this run; a real resolver install would need to turn this on and expect already-running GTK apps to need a restart before it takes effect. |
| 4. AT-SPI tree walk (Chrome/Firefox) | **Not yet measured on this machine** — `python3-pyatspi` isn't installed by default on Ubuntu 24.04 and installing it requires an interactive `sudo` password this session couldn't supply non-interactively. A real Firefox process (snap-packaged) was running at the time. |

### What this actually shows so far

Item 2 is the headline finding: **`GetWindows` is blocked outright on a stock GNOME 46
session**, called with no more privilege than any other user process has. The plan doc
already flagged this as "a semi-private API [whose] availability varies by GNOME version" —
this is that variance showing up on a current, fully-current Ubuntu LTS, not an edge case.
This alone means Step 18's GNOME/Wayland focus-detection path **as literally specified
(a bare D-Bus call) does not work here** and needs either:
- a different, allowed D-Bus/portal path for focus detection under GNOME/Wayland (not yet
  researched — flagging as open, not guessing at a fix), or
- falling back to AT-SPI2 itself for focus detection too (its bus is confirmed reachable —
  see item 3), rather than relying on `Introspect.GetWindows` at all.

Item 4 — the other load-bearing question (can an address bar actually be read via AT-SPI2 at
all) — is still open on this machine. To complete it:

```bash
sudo apt install -y python3-pyatspi
gsettings set org.gnome.desktop.interface toolkit-accessibility true
# restart Firefox/Chrome after the line above — toolkit-accessibility is read at launch
./probe.sh
```

## Ubuntu, Xorg session

**Not yet run.** Needs a real Xorg session (log out, "Ubuntu on Xorg" at the login screen)
— this environment doesn't have one available.

## Fedora Workstation

**Not yet run.** No Fedora machine available in this environment.

## Bottom line so far

Not a go/no-go yet — Step 20 needs item 4 answered, and needs the Xorg and Fedora rows
filled in with real runs before generalizing. What's already confirmed is that **item 2's
`GetWindows` call cannot be relied on as specified** on at least one fully-current, common
target (Ubuntu 24.04 GNOME 46/Wayland), which changes what Prompt D.2's focus-detection
design needs to account for regardless of how item 4 turns out.
