# 7.3 Website (URL) tracking

How the hiday desktop agent records which websites someone views while their timer runs,
on Windows, macOS and Linux, with no browser extension. Invariants are in
[`URL_TRACKING_CONTEXT.md`](../URL_TRACKING_CONTEXT.md). Code cites this file by section and
step number, so keep the numbers. Where the code differs from the original plan, the step
says so.

## 7.3.1 Architecture

```
Electron main process
  timer state · session engine · SQLite · sync · permission state · coverage
        │  spawn once, JSON lines over stdin/stdout, watchdog restarts on failure
        ├── win-resolver.exe   C# / .NET 8 (FlaUI)   SetWinEventHook + UI Automation
        ├── darwin resolver    TypeScript            osascript + Swift Firefox AX helper
        └── linux resolver     TypeScript            AT-SPI2 over D-Bus (dbus-next)
```

The main process never calls a platform API. It talks to a child process over the resolver
protocol. The darwin and linux resolvers are compiled TypeScript run on Electron's own binary
with `ELECTRON_RUN_AS_NODE=1`. The plan had a Python Linux resolver; it was written in
TypeScript so no Python ships. Three rules:

1. Side-car process, never a native Node addon. UIA hangs often, and a wedged addon takes
   the agent down. A child process can be timed out, killed and respawned.
2. One protocol, interchangeable resolvers. The session engine never knows the platform.
3. The session engine is pure: no I/O, no platform code, fully unit-tested.

Single-page apps are caught by re-reading the address bar every 5 s, since `pushState`
updates it. The cost is resolution: visits shorter than the heartbeat can merge or be
missed, and session edges are heartbeat-quantized. Background tabs are never seen.

Code: `desktop/src/main/url-capture/`, `desktop/src/main/resolvers/`, `native/win/resolver/`,
and `backend/src/url-sessions/` ([ADR 0010](adr/0010-url-session-ingest-and-display.md)).

## Stage A: Foundations

### Step 1: Resolver protocol

Pinned in `url-capture/protocol.ts` and `URL_TRACKING_CONTEXT.md`. One JSON object per line,
logs on stderr only. Requests are `resolve` (with `pid`, `hwnd`) and `ping`. A resolve
response carries `url`, `title`, `browser`, `private` (`true | false | null`), `source`
(`apple-events | ax | uia | atspi | title`), `confidence` (`exact | displayed | guess`) and
`ms`. The side-car also pushes `focus`, `ready` (with `caps`) and `error` events.

Every reading carries `source` and `confidence` from the first line of code, so no stored
row ever needs migrating for them. A mock resolver replaying a JSON script can drive the
whole agent.

### Step 2: Browser registry as data

`url-capture/browser-registry.json` lists, per browser, the process match per OS, engine
family, read strategy per OS and private-mode detector. It covers Chrome, Edge, Brave, Opera,
Vivaldi, Arc, Firefox, Safari and a `chromium-generic` fallback, and the Windows build copies
it next to the exe. Adding a browser is a JSON edit. Not built: remote updates. The registry
ships inside the app.

### Step 3: Session engine

`url-capture/session-engine.ts`, pure, with time injected on every event.

- Opens when focus lands on a browser window or the normalized URL changes.
- Closes on focus loss, URL change, idle, lock, sleep, timer stop, quit or the day boundary.
- `activeMs` grows only while the timer runs, the window is focused, the user is not idle
  and the machine is awake. It is never derived from timestamps.
- The same URL within 30 s reopens the previous session. Sessions under 2 s are dropped.
- Monotonic time for durations, wall clock plus timezone offset for timestamps. `activeMs`
  larger than the wall-clock span is flagged.
- Added since the plan: a checkpoint every 5 min of active time, and "unknown" sessions for
  browser windows whose address can't be read
  ([ADR 0027](adr/0027-blind-browsers-at-runtime-and-unknown-url-time.md)).

Table-driven tests cover every transition, including sleep mid-session and clock jumps.

### Step 4: Idle, lock and sleep via Electron

`url-capture/power-adapter.ts` uses `powerMonitor`: idle time polled every 5 s against a
120 s default threshold, plus `suspend`, `resume`, `lock-screen`, `unlock-screen` and
`shutdown`. See also [ADR 0028](adr/0028-idle-timeout-holds-tracking-and-sleep-counts-as-idle.md).

### Step 5: Local store and sync contract

SQLite (`better-sqlite3`) as a durable queue. Batches of 50 upload every 30 s, idempotent on
the client session id. Contract: [`url-tracking-api.md`](url-tracking-api.md). Not built:
server-side clamping to the tracked-time window (deferred in ADR 0010), and local retention
purge (`store.purgeOlderThan()` exists but nothing calls it).

### Step 6: Instrumentation harness

`url-capture/debug-harness.ts` optionally appends each reading to a JSONL file: raw and
normalized value, source, confidence, latency and the engine's decision. The Windows
resolver has a `--capture-fixtures` mode for collecting real address-bar strings.

## Stage B: macOS resolver

### Step 7: Focus detection

Polls System Events through `osascript` every 1.5 s (`resolvers/darwin/focus-monitor.ts`).
The plan suggested `get-windows`. A push-based Swift `NSWorkspace` helper can replace the
poll behind the same `FocusSource` interface.

### Step 8: Apple Events for Safari and the Chromium family

One parameterized AppleScript per family (`resolvers/darwin/scripts.ts`). Chromium browsers
return `URL of active tab`, the title and `mode of window`; Safari returns `URL of current
tab` and its name. The URL is complete, so `confidence: "exact"`. `mode` returns
`"incognito"` for private windows. Safari has no equivalent. Every call runs only against an
already-running frontmost app, otherwise AppleScript would launch the browser.

### Step 9: Heartbeat re-read

Re-resolve every 5 s while a browser is focused, and stop when focus leaves
(`heartbeat-scheduler.ts`). This catches SPA navigation (§7.3.1). Only one `osascript` runs
at a time. A long-lived Swift helper is the fallback if the spawns ever show up in profiling.

### Step 10: Swift AX helper for Firefox

Firefox has no AppleScript URL support (Mozilla bugs 369901, 516502). The `firefox-ax-helper`
Swift binary reads the toolbar field's `AXValue` and the window title. Readings are
`source: "ax", confidence: "displayed"` and go through Step 21. Private windows are matched
from the title against `firefox-private-markers.json` (only English is verified). Needs the
Accessibility permission. Without it the helper returns `permission-denied` and the reading
is dropped, so no website time is recorded for Firefox. The plan expected title-only.

### Step 11: Permissions, entitlements and Info.plist

A plain-language `NSAppleEventsUsageDescription`, and the
`com.apple.security.automation.apple-events` entitlement under hardened runtime. The Mac
App Store rejects that entitlement, so hiday is distributed directly. Consent is per
browser, so onboarding asks for each installed one up front. "Don't Allow" can only be
undone in System Settings, which the agent deep-links to. Re-signing or moving the `.app`
resets every grant.

## Stage C: Windows resolver in C#

See [`native/win/README.md`](../native/win/README.md). Focus detection and address-bar
reading are separate jobs.

### Step 12: Side-car skeleton

Console app: lines in on stdin, protocol JSON out on stdout, logs on stderr. `ping` is
answered on a thread UIA work can't block.

### Step 13: Focus detection via Win32, not UIA

`SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` out of context, with its own message pump
(`FocusWatcher.cs`). No polling, and no UIA focus events, which are slow and leak.

### Step 14: Read the address bar with UIA

FlaUI over UIA3 (`AddressBarReader.cs`). Match on `ControlType.Edit` and toolbar position,
never localized names. Scope to the toolbar with one cache request, on one dedicated MTA
thread. Reject the reading while the omnibox has keyboard focus; this one check eliminates
most half-typed search queries. Race each read against a
hard 250 ms deadline, since UIA has none. Never cache elements across calls. Querying
Chromium turns its full accessibility tree on, at some memory and CPU cost. Firefox must not
have `accessibility.force_disabled` set. No user consent is needed, but an elevated browser
can't be read, and that is reported.

### Step 15: Per-browser element strategies

Driven by the Step 2 registry. Generic fallback: the first `Edit` without keyboard focus
whose value normalizes to a valid host.

### Step 16: Watchdog

`url-capture/resolver-manager.ts` pings every 5 s and respawns after two misses, backing off
from 1 s to 30 s. After 5 failed restarts it gives up and URL capture reports `unavailable`.
The kill switch is half built: `win-resolver.exe --disable-uia` reports titles only, but
Electron never passes it and there is no remote config yet.

### Step 17: Packaging

NativeAOT was the plan. A CI spike (`native/win/spike/RESULTS.md`) showed UIA reads fail
under NativeAOT and under trimming, with FlaUI and CsWin32 alike. The resolver ships as a
self-contained, single-file, untrimmed .NET 8 exe. It must be signed too (`sign.ps1`): an
unsigned child exe beside a signed app is what EDR flags.

## Stage D: Linux resolver

TypeScript in `resolvers/linux/`. Build and verification notes:
[`url-tracking-toolchain.md`](url-tracking-toolchain.md).

### Step 18: Focus detection

The plan named `org.gnome.Shell.Introspect.GetWindows`, but stock GNOME 46 returns
`AccessDenied` to ordinary processes. Focus comes from AT-SPI `window:activate` events
instead, the same channel that reads the URL.

### Step 19: URL via AT-SPI2

AT-SPI2 rides D-Bus, so it works under Wayland. The resolver reads the address bar by role
and toolbar position, never by label, using `dbus-next` instead of `pyatspi`. Browsers build
their tree only when started with an accessibility flag, so `browser-activation.ts` shadows
each browser's `.desktop` entry to add it. A browser started another way stays blind;
`blind-browsers.ts` detects that on each heartbeat (ADR 0027).

### Step 20: Gate the support matrix explicitly

`support-gate.ts`: GNOME on Wayland or any window manager on Xorg is supported. Elsewhere
the resolver still answers pings but reports no `url` capability, and the Devices page shows
why. The gate ignores Electron's `Unity` value for `XDG_CURRENT_DESKTOP` (ADR 0027).

## Stage E: Normalization and trust

### Step 21: URL normalization pipeline

`normalization/normalize.ts` turns rendered address-bar strings into URLs, dropping a reading
at the first failed rule:

1. Reject if the address bar has keyboard focus. Done in the resolvers.
2. Reject strings containing spaces, unless valid IDN.
3. Validate the host: public suffix (`tldts`), IP, `localhost`, or an internal scheme
   (`chrome://`, `edge://`, `about:`, `file://`). This removes most search-query noise.
4. Reject placeholders like "Search Google or type a URL" (`placeholder-strings.json`).
5. Assume `https://`. This is why the result is `displayed`, never `exact`.
6. Canonicalize: lowercase host, drop default ports and a bare trailing slash. Unlike the
   plan, the fragment is kept under the `keep` policy, since in an SPA it is the location.
7. Apply the query-string policy (D1). Default `keep`.
8. Truncate path, query and fragment together at 512 chars.
9. Apply the sensitive-path denylist (`sensitive-path-patterns.json`) to path, query and
   fragment. Runs before rule 7, so a token rejects the reading instead of being cut off.
10. Same URL as the last reading for the window extends the session, otherwise a new one
    opens. Done in the session engine.

Tests use fixtures of real captured strings.

### Step 22: Confidence model

| `confidence` | Meaning | Produced by |
|---|---|---|
| `exact` | Real URL from the browser | Apple Events |
| `displayed` | Normalized from the address bar, scheme assumed | UIA, macOS AX, AT-SPI2 |
| `guess` | Host inferred from a window title | title fallback |
| `unknown` | Browser window whose address couldn't be read; url empty | orchestrator (ADR 0027) |

Reports show unknown time as "Unknown website (Chrome)". An "approximate" marker for
low-confidence rows is not built (D6).

### Step 23: Private-mode detection and policy

Unlike an extension, a native resolver sees private windows, so this needs a policy.

| Browser | Signal | State |
|---|---|---|
| Chromium, macOS | `mode of window` is `"incognito"` | Reliable |
| Firefox, macOS and Windows | Localized "Private Browsing" title marker | English verified only |
| Chromium, Windows | UIA incognito indicator element | Unverified, see below |
| Linux, all | Not read, always `null` | By decision |
| Safari | None | Always `null` |

When `private === true`, the session keeps its time, browser and window title, but `url`,
`host` and `path` are emptied before it leaves the engine, and `store.ts` refuses a private row with a URL. When it is
`null`, capture proceeds and the gap is disclosed in
[`url-tracking-privacy.md`](url-tracking-privacy.md). The engine also has a non-default
`suppress` policy for `null`.

Open: `URL_TRACKING_CONTEXT.md` says Windows should not rely on the Chromium indicator, but
`AddressBarReader.cs` still looks for an unconfirmed `IncognitoAvatarButton` and treats its
absence as `false`. Confirm it on real hardware or remove it before release.

## Stage F: Permissions and coverage UX

### Step 24: Permission state machine

Each gate is `unknown | granted | denied | not-required`, probed at launch and on resume
(`resolvers/darwin/permission-state.ts`). macOS needs Automation per browser and
Accessibility for Firefox; Windows needs no consent; Linux needs the accessibility bus.
Details: [`url-tracking-permissions.md`](url-tracking-permissions.md).

### Step 25: Coverage indicator

The heartbeat carries `urlCaptureStatus` (`ok`, `degraded`, `unavailable`) and a one-line
reason, shown on the Devices page (ADR 0027). Support can see why a device has no URL data
without a screen share.

## Stage G: Packaging and distribution

### Step 26: Bundle the side-cars

`win-resolver.exe` and `firefox-ax-helper` ship through electron-builder `extraResources`
and are found via `process.resourcesPath` (`resolvers/resolver-paths.ts`). The darwin and
linux resolvers are part of the compiled app. `pnpm dist:mac` builds the Swift helper first.

### Step 27: Sign and notarize everything

macOS: Developer ID, hardened runtime, notarization, and the Swift helper signed too.
Windows: an OV or EV certificate on the installer and `win-resolver.exe`. Open: there is no
Developer ID certificate yet, so macOS builds are ad-hoc signed (`identity: "-"`).

### Step 28: Pre-empt antivirus and EDR

An agent that reads other apps' UI, spawns helpers and phones home looks like what endpoint
protection hunts for. Open: vendor allowlisting and a support playbook for quarantines.

## Stage H: Verify and harden

Manual drills and their status: [`url-tracking-drills.md`](url-tracking-drills.md).

### Step 29: Test matrix

Real hardware. Windows 10 and 11, Apple Silicon and Intel Macs, Ubuntu on GNOME Wayland and
on Xorg. Chrome, Edge, Firefox, Safari, Brave, Opera and Vivaldi side by side, plus one
unsupported browser to confirm it degrades. At least one non-English UI locale per OS.

### Step 30: Failure drills

Each must degrade visibly and recover without a restart: 50 window switches in 30 s; 10
Jira tickets in a minute, checked against the heartbeat; private windows; multi-monitor;
sleep, lock and user switching; clock changes; browser force-quit or update; permission
revoked or side-car killed mid-session; an elevated browser; Firefox accessibility disabled;
an hour offline with no duplicates or loss. Scripted versions are in
`url-capture/tests/failure-drills.spec.ts`.

### Step 31: Acceptance criteria

`url-capture/tests/acceptance-criteria.spec.ts` computes each from a deterministic drill, or
reports it as not measured:

- macOS Safari and Chromium: at least 99% of focused browser-seconds get an exact URL.
- Windows Chromium: at least 95% captured, under 0.5% garbage rows after normalization.
- An SPA route change appears within 2× the heartbeat.
- Resolver latency median under 60 ms, p99 under 250 ms, no hangs across the drills.
- Total `activeMs` within ±2% of tracked timer time.
- Zero stored URLs where `private == true`.

## 7.3.2 Coverage matrix

| Browser | macOS | Windows | Linux (GNOME Wayland, Xorg) |
|---|---|---|---|
| Chrome, Edge, Brave, Vivaldi, Opera | Exact (Apple Events) | Displayed (UIA) | Displayed (AT-SPI2) |
| Safari | Exact, no private signal | n/a | n/a |
| Firefox | Displayed (AX, needs Accessibility) | Displayed (UIA) | Displayed (AT-SPI2) |
| Arc, other Chromium forks | Arc via Apple Events, others fallback | Generic fallback | Generic fallback |
| Unknown browser | Title only | Title only | Title only |
| Browser that can't be read | URL unknown | URL unknown | URL unknown |
| Non-GNOME Wayland | n/a | n/a | Off, shown on Devices page |

## 7.3.3 Limitations

For admin-facing docs:

1. URLs are sampled every 5 s, so shorter visits may merge or be missed.
2. On Windows and Linux the URL comes from the address bar and the scheme is assumed.
3. Firefox on macOS needs the Accessibility permission, or no website time is recorded for it.
4. Private windows are detected for Chromium on macOS and Firefox on macOS and Windows.
   Safari can't tell, Chromium on Windows is unreliable, Linux doesn't try.
5. Only the focused tab of the focused window counts.
6. On Windows, reading Chromium turns on its full accessibility tree, at a small cost.
7. An elevated browser can't be read by a non-elevated agent.
8. Linux works only on GNOME under Wayland or any window manager under Xorg.
9. On Linux, a browser started without the accessibility flag (web-app shortcut, autostart,
   terminal) stays unreadable until fully closed.
10. macOS permissions reset when an update changes the app's signature or location.

## 7.3.5 Decisions

Code cites these by label.

- D1, how much URL to store: the full URL, query and fragment included. The plan said strip
  queries by default; commit `751f6e9` changed that, relying on Step 21 rule 9. `strip`
  still exists in the pipeline, but no org setting passes it yet.
- D2, heartbeat: 5 s while a browser is focused, paused otherwise.
- D3, private windows: empty the URL when `private === true`; capture and disclose when it
  is `null` (Step 23).
- D4, ship the Windows UIA path despite its browser cost: yes, with the Step 16 kill switch
  (not wired yet).
- D5, Linux in v1: yes, GNOME on Wayland and any window manager on Xorg.
- D6, show confidence to end users: open. Only "Unknown website" labels exist today.
