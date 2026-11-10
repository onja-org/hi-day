# URL tracking: what must be true on an employee's machine

For whoever rolls hiday out. What has to be set up on a device before website tracking produces data, and how much IT can push centrally instead of asking each person to click something.

Website tracking also has to be switched on: the "Track apps & URLs" setting must be "apps and URLs" for the organisation or the member. The default records apps only.

## Tracking is not built browser by browser

The code that finds and reads an address bar never consults the browser list.

On Linux, `resolvers/linux/atspi.ts` walks the focused window's accessibility tree for an address-bar-shaped node inside a toolbar, preferring the first one with readable text. It doesn't know which browser it is looking at. Windows works the same way: its fallback is the first Edit element without keyboard focus whose value normalizes to a valid host.

The browser list (`browser-registry.json`) is used for two things, and neither gates URL capture:

1. Naming, so activity reads "chrome" rather than "some browser". An unknown browser gets a generic label and is still tracked.
2. Private-mode detection, since the incognito marker differs per browser.

So a browser nobody has tested, such as a new Chromium fork, is tracked from day one as long as its address bar is exposed through the platform's accessibility layer.

Adding Firefox support on Linux was not per-browser code. The address-bar rule only accepted the accessibility role `entry`, which Chromium uses. Firefox's address bar is a `combo box`. Both roles are now accepted, for every browser. The remaining per-browser risk is a browser whose address bar uses some third role. The fix for that is widening the role set, not writing per-browser code.

## What must be enabled, per platform

| Platform | Required on the machine | Consent prompt? | Can IT push it centrally? |
|---|---|---|---|
| Windows | Nothing | No | Nothing to push |
| macOS | Automation for System Events and for each browser. Accessibility for Firefox | Yes, one per app pair | Yes, with an MDM PPPC profile, once the app has a stable signature |
| Linux | `at-spi2-core` (a `.deb` dependency, and default on GNOME). The agent activates browsers itself | No | Nothing required. See the fleet note on `/usr/local/share/applications` |

Windows needs nothing because UI Automation asks for no consent. macOS is the most intrusive: Automation is granted per pair, so someone with five browsers sees six prompts, counting System Events.

### Linux: the agent activates browsers itself

There is nothing for the employee to do and nothing for them to switch off. Any setting the tracked person can toggle is a setting tracking can't depend on.

A Linux browser builds the accessibility tree the agent reads only if accessibility was active when the browser process started. Nothing done later fills in an already-running browser. So activation happens at agent startup (`activateBrowsersOnLinux` in `main.ts`), not when a timer starts, and every browser opened from then on is tracked.

`browser-activation.ts` finds every `.desktop` launcher that declares itself an `http` handler, which is the freedesktop way of saying "I am a web browser". That is why a new browser needs no code change. It writes a shadowing copy with:

```
Exec=env GNOME_ACCESSIBILITY=1 <original> --force-renderer-accessibility=basic %U
```

One rewrite for every browser, with no browser list. Verified on a real machine:

| Browser | Packaging | Nodes in tree | Address bar |
|---|---|---|---|
| Brave | snap | 2 → 295 | `example.com/search?q=full+path+test&page=2` |
| Chrome, Edge, Opera | deb / snap | stub → full | readable |
| Firefox | snap | absent from bus → full | readable |

What the measurements showed:

- No browser works without this. Chrome looked like it activated itself, but that instance had inherited a live accessibility session. A fresh Chrome with accessibility off is a stub like the rest.
- `GNOME_ACCESSIBILITY=1` covers Gecko, and Firefox ignores the Chromium flag, so one line covers both families. `=basic` exposes the browser UI without the page-content tree: same address bar, much less overhead.
- `toolkit-accessibility` is not needed and is not requested. Every result above was measured with it `false`.
- Snap confinement doesn't stop the tree being read. It did stop snap browsers' `window:activate` events from reaching the agent while the `.deb` installed electron-builder's AppArmor profile, so snap Firefox and Opera went untracked. The `.deb`'s `build/afterInstall.sh` now leaves that profile out.

#### What this does not cover

- A browser already open when the agent starts keeps its empty tree until it is fully closed and reopened. The same happens later if a browser's first process starts without the override, for example from a Chrome web-app shortcut, an autostart entry or a terminal. The agent spots these "blind" browsers on every heartbeat (`blind-browsers.ts`), marks the device's URL capture as degraded on the Devices page, and records their time as "Unknown website". Browsers that were open when the agent wrote its overrides are also offered a restart on a setup screen.
- The agent writes its overrides to `~/.local/share/applications`, which a determined user could shadow back. For a fleet, deploy the same files to `/usr/local/share/applications` at install time. It comes before both `/usr/share` and `/var/lib/snapd/desktop` in `XDG_DATA_DIRS`, so it covers snaps too.
- On `.deb` uninstall, `build/afterRemove.sh` removes every override carrying the agent's marker comment, in every user's home. A vendor entry with the same filename is left alone. Upgrades leave the overrides in place. The AppImage has no uninstall hook, so `removeBrowserActivation` is not called for it.

### macOS: pre-granting so nobody sees a prompt

Automation and Accessibility are TCC permissions. An MDM can pre-approve them with a PPPC (Privacy Preferences Policy Control) profile. That is the supported path for managed devices and avoids one prompt per browser.

Two things silently break it:

- The profile must target the app's code-signing identity, because TCC grants are keyed to the signature. Builds are ad-hoc signed for now, and an ad-hoc signature changes on every build. A PPPC profile can't target a stable identity until the app is signed with a Developer ID.
- Re-signing or moving the `.app` resets every existing grant. See [`url-tracking-permissions.md`](./url-tracking-permissions.md).

This has not been tested against a real MDM. The mechanism is standard and documented by Apple, but validate the payload on one managed device before a fleet rollout.

### Firefox, any platform

Firefox has a pref that turns off its accessibility engine:

```
accessibility.force_disabled = 1   →  no tracking, on any OS
```

It ships unset, so this only matters if someone set it. It circulates in "speed up Firefox" advice. Managed fleets can pin it to `0` through Firefox's enterprise `policies.json`.

## Checklist for company-managed devices

- Windows: nothing to do.
- Linux: nothing required. Optionally copy the launcher overrides to `/usr/local/share/applications` at install time so a user can't shadow them from their home directory.
- macOS: ship a PPPC profile keyed to the signing identity, once there is a stable one.
- Firefox: pin `accessibility.force_disabled = 0` through enterprise policy if it may have been set.

Plan the Linux rollout around one point. Browsers already running when the agent first starts stay untracked until they are restarted. The setup screen offers to do that. If the person declines, it fixes itself the next time they reopen the browser. A machine showing "no URL data yet" because its browser was never closed is expected, not a fault.

## How each failure looks

Most of these fail quietly.

| Symptom | Cause |
|---|---|
| No URL data at all on Linux, Devices page says the accessibility service is not running | `at-spi2-core` missing, so there is no accessibility bus. Likely with an AppImage, or a `.deb` installed without its dependencies |
| Linux: Devices page shows URL capture degraded, naming a browser. Its time shows as "Unknown website" | That browser is blind: it was started before activation or outside the override. Restart it fully |
| macOS: one browser's time shows as "Unknown website", others are fine | Automation denied for that browser |
| macOS: nothing tracked in any browser | Automation denied for System Events |
| Firefox never tracked, other browsers fine | `accessibility.force_disabled = 1`, or on macOS, Accessibility not granted |
