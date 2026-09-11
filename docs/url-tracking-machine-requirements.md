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
| **Linux** | `at-spi2-core` present (default on GNOME). The agent activates browsers itself at startup | **No** | Nothing to push — but see the fleet note on `/usr/local/share/applications` |

Windows needs nothing because UI Automation requires no consent. macOS is the most intrusive:
Automation is granted per *pair*, so a person with five browsers sees five separate prompts.

### Linux — the agent activates browsers itself

**There is nothing for the employee to do, and nothing for them to switch off.** This
matters more than convenience: any setting a tracked person can toggle is a setting
tracking cannot depend on.

A Linux browser builds the accessibility tree this agent reads **only if accessibility was
already active when the browser process started**. Nothing done at runtime populates an
already-running browser. So activation happens at *agent startup* (`activateBrowsersOnLinux`
in `main.ts`), not when a timer starts: every browser opened from then on is tracked.

`browser-activation.ts` finds every `.desktop` launcher declaring itself an `http` handler —
the freedesktop-standard way of saying "I am a web browser", which is why an unknown or
newly released browser needs no code change — and writes a shadowing copy with:

```
Exec=env GNOME_ACCESSIBILITY=1 <original> --force-renderer-accessibility=basic %U
```

One universal rewrite, no browser list, no family detection. Verified on this machine:

| Browser | Packaging | Nodes in tree | Address bar |
|---|---|---|---|
| Brave | snap | 2 → **295** | `example.com/search?q=full+path+test&page=2` |
| Chrome, Edge, Opera | deb / snap | stub → full | address bar readable |
| Firefox | snap | absent from bus → full | address bar readable |

Three findings worth recording, because each contradicts something that looked obvious:

- **No browser works without this.** Chrome appeared to self-activate, but that instance had
  inherited a live accessibility session from earlier in the day. A freshly launched Chrome
  with accessibility off is a stub like the rest. There is no exception to special-case.
- **`GNOME_ACCESSIBILITY=1` on everything, `=basic` for the flag.** Firefox tolerates the
  unknown Chromium flag rather than rejecting it, which collapses two family-specific rules
  into one line. `=basic` exposes the browser UI tree without the expensive web-content
  tree — 273 nodes vs 274, same address bar, far less overhead per employee machine.
- **Snap confinement was never the blocker.** Brave is a snap and reaches the accessibility
  bus fine; it was only ever missing the flag.

**`toolkit-accessibility` is not required and is no longer requested.** Every result above
was measured with it `false`. The only machine prerequisite is `at-spi2-core`, which ships
by default on GNOME.

#### What this does not cover

- **Browsers already open when the agent starts** keep their empty tree until next launched,
  since the tree is built at process start. Unavoidable; it resolves itself the next time the
  person opens their browser.
- **The agent writes to `~/.local/share/applications`**, which a determined user could shadow
  back. For a fleet, deploy the same files to `/usr/local/share/applications` at install
  time — it precedes both `/usr/share` and `/var/lib/snapd/desktop` in `XDG_DATA_DIRS`, so it
  covers snaps too.
- **Uninstall** should call `removeBrowserActivation`, which removes only files carrying the
  agent's marker comment — a vendor entry sharing a filename is left alone.

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
- **Linux** — nothing required; the agent activates browsers itself. Optionally copy its
  launcher overrides to `/usr/local/share/applications` at install time so a user cannot
  shadow them from their home directory.
- **macOS** — ship a PPPC profile keyed to the signing identity.
- **Firefox** — pin `accessibility.force_disabled = 0` via enterprise policy if you have any
  chance of it having been set.

One rollout-order point worth planning around: on Linux, browsers already running when the
agent first starts keep their empty accessibility tree until they are next launched, because
that tree is built at process start. It resolves itself the first time the person reopens
their browser, so it costs a day at most — but a rollout that ends with "no data yet" on a
machine someone never closed their browser on is expected, not a fault.

## How each failure looks

Worth knowing, because most of these fail quietly rather than loudly.

| Symptom | Cause |
|---|---|
| No data at all on Linux | `at-spi2-core` missing, so the accessibility bus is not running |
| Some browsers tracked, one is not, coverage says "Active" | That browser was started before accessibility was enabled — restart it |
| A browser is tracked by name/title but never by URL | It was already running when the agent started — it picks up tracking when next launched |
| macOS: one browser tracked, another not | Automation denied for that specific browser |
| Firefox specifically never tracked, others fine | `accessibility.force_disabled = 1` |

**Known gap:** the middle row is the bad one. The coverage screen reports a browser as "Active"
whenever it is installed and the helper is healthy — it has no way to know a browser is missing
from the accessibility bus, because from the helper's side that browser is simply not there. So
the most likely rollout failure is also the one the UI currently reports as fine. Closing it
needs the resolver to report which browsers it can actually see, which the pinned protocol has
no message for yet.
