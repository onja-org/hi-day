# CLAUDE.md — URL & website tracking (spec §7.3)

> Merge this into your existing `CLAUDE.md` rather than replacing it. Everything here is
> context Claude Code needs in *every* session that touches URL tracking.

## What we are building

Website (URL) tracking for the Onja desktop time-tracking agent: while the timer runs, record
which websites the user is actively viewing and for how long. Reported per URL, per session.

The full design lives in `docs/url-tracking-plan.md`. **Read it before proposing any
implementation.** This file holds only the invariants that must never be violated.

## Hard constraints — do not violate these

1. **NO BROWSER EXTENSION. EVER.**
   This is a deliberate product decision, not an oversight. Do not build, scaffold, suggest,
   or leave TODOs for a browser add-on, WebExtension, Manifest V3 service worker, or native
   messaging host. All URL capture is native, from the desktop agent. If you believe a task
   is impossible without an extension, say so explicitly and stop — do not silently add one.

2. **NO CHROME DEVTOOLS PROTOCOL / `--remote-debugging-port`.**
   Relaunching the user's browser with a debug port open is a local privilege-escalation
   surface. Never propose it.

3. **NO TLS INTERCEPTION, PROXY, OR ROOT CA INSTALL.** Never propose it.

4. **NO READING BROWSER HISTORY DATABASES** (`History` SQLite files). Locked while the browser
   runs, and out of scope for consent reasons.

5. **NO PACKET OR DNS SNIFFING.**

6. **The session engine stays pure.** No I/O, no platform calls, no `Date.now()` reached for
   directly — time is injected. It must be unit-testable with zero mocks of the OS.

7. **Electron's main process never calls a platform API directly.** All platform work happens
   in side-car child processes behind the resolver protocol.

8. **Every URL reading carries `source` and `confidence`.** No exceptions, from the first
   line of code. These are not optional fields to add later.

## Architecture

```
Electron main process
  timer state · session engine · SQLite · sync · permission state · coverage UI
        │  spawn once; JSON-lines over stdin/stdout; watchdog restarts on failure
        ├── win-resolver.exe     C# / .NET    SetWinEventHook + UI Automation
        ├── mac-resolver         osascript + small Swift helper
        └── linux-resolver       Python       GNOME Shell Introspect + AT-SPI2
```

## The resolver protocol — pinned, do not redesign

One JSON object per line. Requests and responses on stdin/stdout; logs on **stderr only**
(anything written to stdout that is not protocol JSON is a bug).

```jsonc
// → request
{ "id": 41, "op": "resolve", "pid": 8123, "hwnd": 197426 }
{ "id": 42, "op": "ping" }

// ← response
{ "id": 41, "ok": true,
  "url": "github.com/onja/agent/issues/42",
  "title": "Issue #42",
  "browser": "chrome",
  "private": false,           // true | false | null (null = cannot determine)
  "source": "uia",            // apple-events | ax | uia | atspi | title
  "confidence": "displayed",  // exact | displayed | guess
  "ms": 34 }

// ← unsolicited focus event
{ "ev": "focus", "pid": 8123, "hwnd": 197426,
  "app": "chrome.exe", "title": "Issue #42 · onja/agent", "ts": 1757308800123 }

// ← health
{ "ev": "ready", "platform": "win32", "caps": ["focus", "url", "private"] }
{ "ev": "error", "code": "uia_timeout", "detail": "..." }
```

### Confidence levels

| Value | Meaning | Produced by |
|---|---|---|
| `exact` | Real URL straight from the browser | Apple Events |
| `displayed` | Normalized from the rendered address bar; scheme assumed | UIA, macOS AX, AT-SPI2 |
| `guess` | Host inferred from a window title | title fallback |

## Core data model

```ts
type UrlSession = {
  id: string            // client-generated, idempotency key for sync
  url: string
  host: string
  path: string | null
  title: string | null
  browser: string
  private: boolean | null
  deviceId: string
  startedAt: number     // wall clock, ms
  endedAt: number | null
  activeMs: number      // accumulated, NOT endedAt - startedAt
  tzOffsetMin: number
  source: 'apple-events' | 'ax' | 'uia' | 'atspi' | 'title'
  confidence: 'exact' | 'displayed' | 'guess'
}
```

`activeMs` accumulates **only** while: timer running AND window focused AND user not idle
AND machine awake. All four conditions, every tick. It is never derived from timestamps.

## Key mechanism: heartbeat re-read

Single-page apps (Gmail, Jira, Notion, Linear) update the browser address bar on
`history.pushState`. We therefore catch SPA navigation by **re-reading on a heartbeat**, not
by subscribing to navigation events (which only an extension could do).

- Heartbeat: **5 s while a browser is the focused app; paused otherwise.**
- This sets our SPA resolution and is the main lever on both data quality and CPU.

## Per-platform notes

**macOS** — Apple Events (`osascript`) gives exact URLs for Safari and all Chromium browsers.
All Chromium browsers share one AppleScript dictionary, so one parameterized script covers
Chrome, Edge, Brave, Vivaldi and Opera. Firefox has no AppleScript URL support (Mozilla bugs
369901 / 516502) and needs the AX API + Accessibility permission. Never launch a browser —
guard every call so it runs only against an already-running frontmost app.

**Windows** — `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` for focus (push, cheap). UIA for the
address bar. Requires **no user consent**. Traps: match on `ControlType.Edit` + toolbar
position, never on English element names; use a cache request; run on a dedicated MTA thread;
hard ~250 ms deadline (UIA has none of its own); never cache elements across calls; reject any
reading where the omnibox has keyboard focus.

**Linux** — GNOME Shell Introspect over D-Bus for focus, AT-SPI2 for the URL. Supported only
on GNOME-under-Wayland or any-WM-under-Xorg; detect and disable elsewhere.

## Testing expectations

- The session engine is table-driven tested for every transition, including sleep mid-session,
  clock jumped backwards, and idle crossing during a URL change.
- The normalization pipeline is tested against a fixture file of **real captured strings** from
  every browser (collected via the debug harness — do not invent fixtures).
- A mock resolver replaying a scripted JSON file must be able to drive the whole agent end to
  end, with no real browser running.

## Conventions

- TypeScript strict mode in the Electron app; no `any` in the session engine or protocol types.
- Side-car binaries live in `native/<platform>/` and are bundled via electron-builder
  `extraResources`; resolve paths through `process.resourcesPath` and make sure dev and
  packaged both work.
- Never log a full URL at `info` level or above. URLs appear in debug logs only, and the debug
  log is opt-in.

## Anti-goals for this feature

- Do not track background or non-focused tabs.
- Do not capture screenshots as part of §7.3 (separate spec section).
- Do not add telemetry beyond the documented sync contract.
- Do not store private-window URLs where `private === true`.

## Decided: `private === null` (unknown) policy

Step 23 of the plan requires picking this deliberately rather than letting it be an accident.
Decision: where a browser's private-mode state can't be detected at all (`private` resolves to
`null` — Safari today, since it has no incognito signal), capture proceeds as normal and the gap
is disclosed in user-facing privacy documentation instead of suppressing capture for that
browser. This keeps full coverage everywhere else at the cost of Safari private windows not
being distinguishable from normal ones — a deliberate tradeoff, not a bug.
### Amendment: `private === null` is now the norm, not the Safari exception

The decision above was written when Safari was expected to be the only browser without an
incognito signal. In practice the platforms diverged, and the same `null` value now covers two
materially different situations:

| Situation | Meaning | Where |
|---|---|---|
| **No signal exists** | The browser genuinely exposes no incognito marker | Safari (Apple Events) |
| **Signal not read** | A marker exists but this resolver does not attempt it | Linux (AT-SPI), Windows (UIA) |

Resulting behaviour per platform, as shipped:

- **Linux** — declares no `private` capability at all (`resolvers/linux/index.ts`) and always
  reports `null`. Its own comment concedes this is "the failure direction that leaks a private
  URL". Private-window URLs **are** captured.
- **Windows** — the same, by decision: reading Chromium's incognito indicator depends on an
  AutomationId that could not be confirmed without real hardware, so Windows is not to rely on it.
  Private-window URLs **are** captured. Note the code has not caught up yet — `AddressBarReader.cs`
  still contains the unverified `IncognitoIndicatorAutomationId` attempt. It must be removed or
  confirmed on real hardware before release: left as-is, a false positive would redact a *normal*
  window's URL, which is the opposite failure and loses legitimate data.
- **macOS** — the only platform that does detect it: Chromium browsers report real `true`/`false`
  via Apple Events; Safari reports `null` per the original decision above.

So `private === true` — the only value that triggers redaction in `session-engine.ts` and the
storage invariant in `store.ts` — is currently reachable **only on macOS**. The anti-goal "do not
store private-window URLs where `private === true`" still holds exactly as written; it is simply
inert on two of the three platforms.

This is deliberate and interim, not a bug to be fixed opportunistically. Anyone adding private
detection to Linux or Windows is changing product behaviour, not filling in a gap — the user-facing
privacy documentation describes what is captured today, and has to change with it.
