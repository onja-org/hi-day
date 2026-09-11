# URL tracking — what must be true on an employee's machine

*For whoever rolls this out. Answers one question: what has to be set up on a device
before website tracking actually produces data, and how much of it can IT push centrally
rather than asking each person to click something.*

## First, a correction: tracking is NOT built browser-by-browser

It's reasonable to assume from the changelog ("added Firefox support") that each browser
needs its own integration. It doesn't. **The code that finds and reads an address bar never
consults the browser list at all.**

On Linux, `resolvers/linux/atspi.ts` walks the focused window's accessibility tree and takes
the first address-bar-shaped node inside a toolbar. It does not know or care which browser it
is looking at. Windows works the same way — its documented fallback is "first Edit descendant
that does not have keyboard focus and whose value normalizes to a valid host."

The browser list (`browser-registry.json`) is consulted for exactly two things, and **neither
gates URL capture**:

1. **Naming** — so activity reads "chrome" rather than "some browser". An unrecognised browser
   falls back to a generic label and is still tracked.
2. **Private-mode detection** — which marker means "incognito" differs per browser.

So a browser nobody has ever tested — a new Chromium fork, a rebranded build — is tracked on
day one, as long as it exposes an address bar through the platform's accessibility layer.

### What the Firefox fix actually was

Not "adding Firefox". The generic rule was too narrow: it matched only accessibility role
`entry`, which is what Chromium uses. Firefox's address bar is a `combo box`. Both roles are
now accepted, which widens the rule for *every* browser using either — not just Firefox.

That is the honest shape of the remaining per-browser risk: **a browser whose address bar uses
some third role would still be missed.** The mitigation is widening the role set when one turns
up, not writing per-browser code.

## What must be enabled, per platform

This is the part that isn't in the app's control.

| Platform | Required on the machine | User consent prompt? | Can IT push it centrally? |
|---|---|---|---|
| **Windows** | Nothing | **No** | N/A — works out of the box |
| **macOS** | Automation permission per browser; Accessibility permission (Firefox only) | **Yes** — one prompt per (app, browser) pair | Yes, via MDM PPPC profile |
| **Linux** | `at-spi2-core` running; `toolkit-accessibility` = true; **browser restarted after enabling it** | No | Yes, via dconf system database |

Windows needs nothing because UI Automation requires no consent. macOS is the most intrusive:
Automation is granted per *pair*, so a person with five browsers sees five separate prompts.

### Linux — the setting, and the restart that catches people out

```bash
gsettings set org.gnome.desktop.interface toolkit-accessibility true
```

**It is off by default, and browsers only read it at launch.** A browser already open when the
setting is flipped never joins the accessibility bus, and is invisible to tracking until it
restarts — with no error anywhere, because from the app's side that browser simply does not
exist.

This was confirmed directly rather than assumed: on a GNOME 46 session with a Firefox that had
been running for four days, Firefox was absent from the accessibility bus entirely. A freshly
launched Firefox appeared immediately and read back its URL correctly.

For a fleet, set it in the dconf **system** database so it applies to every user and survives
re-imaging, rather than relying on a per-user `gsettings` call:

```
# /etc/dconf/db/local.d/00-accessibility
[org/gnome/desktop/interface]
toolkit-accessibility=true
```
then `sudo dconf update`. Deploy it before or with the agent, so the first browser launch after
rollout already has it.

### macOS — pre-granting so nobody sees a prompt

Automation and Accessibility are TCC permissions. An MDM can pre-approve them with a
**PPPC (Privacy Preferences Policy Control)** profile, which is the supported path for managed
devices and avoids the per-browser prompt storm.

Two things to get right, both of which silently break it:

- The profile must target the app's **code-signing identity**. TCC grants are keyed to the
  signature, so a differently-signed build is a different app as far as macOS is concerned.
- **Re-signing or moving the `.app` resets every existing grant** — see
  `docs/url-tracking-permissions.md`.

*Not verified against a real MDM here.* The mechanism is standard and documented by Apple, but
the exact payload should be validated on one managed device before a fleet rollout.

### Firefox, any platform

Firefox has a pref that disables its accessibility engine outright:

```
accessibility.force_disabled = 1   →  no tracking, on any OS
```

It ships as `0`/unset, so this only matters if someone set it — it circulates in "speed up
Firefox" advice. For managed fleets it can be pinned via Firefox's enterprise `policies.json`.

## Since the devices are company-controlled

That removes the hard part. Everything above is centrally deployable:

- **Windows** — nothing to do.
- **Linux** — ship the dconf system-database key with the image.
- **macOS** — ship a PPPC profile keyed to the signing identity.
- **Firefox** — pin `accessibility.force_disabled = 0` via enterprise policy if you have any
  chance of it having been set.

One rollout-order point worth planning around: on Linux, deploy the dconf key **before or with**
the agent. If it lands afterwards, every browser already running stays invisible until its next
restart — which for a long-lived browser can be days.

## How each failure looks

Worth knowing, because most of these fail quietly rather than loudly.

| Symptom | Cause |
|---|---|
| No data at all, coverage screen says the helper is off | `toolkit-accessibility` off, or the accessibility bus is not running |
| Some browsers tracked, one is not, coverage says "Active" | That browser was started before accessibility was enabled — restart it |
| macOS: one browser tracked, another not | Automation denied for that specific browser |
| Firefox specifically never tracked, others fine | `accessibility.force_disabled = 1` |

**Known gap:** the middle row is the bad one. The coverage screen reports a browser as "Active"
whenever it is installed and the helper is healthy — it has no way to know a browser is missing
from the accessibility bus, because from the helper's side that browser is simply not there. So
the most likely rollout failure is also the one the UI currently reports as fine. Closing it
needs the resolver to report which browsers it can actually see, which the pinned protocol has
no message for yet.
