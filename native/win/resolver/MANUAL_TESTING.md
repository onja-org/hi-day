# Manual verification — win-resolver's UIA address-bar reading

UIA cannot be meaningfully mocked (there is no fake COM server worth building for this), so
the actual address-bar read (Stage C.2) needs verification on a real Windows machine, against
real browser windows, before it's trusted. Everything that doesn't require a live browser
(registry lookup, generic-fallback selection, host normalization, Firefox title-marker
matching, the timeout/dedup race) has real xUnit coverage in `WinResolver.Tests` instead —
this document is only for the parts that genuinely can't be.

## Prerequisites

- A Windows machine (not a CI runner — some of this needs an interactive desktop session).
- [Accessibility Insights for Windows](https://accessibilityinsights.io/) (free, from Microsoft) —
  invaluable for inspecting a window's real UIA tree, confirming AutomationIds, and figuring
  out why a read failed.
- The browsers you're testing installed normally.

## Running the side-car directly

Build and run without needing Electron:

```powershell
dotnet build native/win/resolver/WinResolver/WinResolver.csproj -c Release
dotnet run --project native/win/resolver/WinResolver -c Release
```

It starts, emits a `ready` event, and then waits for newline-delimited JSON on stdin. Get a
window's pid/hwnd (Accessibility Insights shows both), then type a request line and press
Enter:

```json
{"id":1,"op":"resolve","pid":12345,"hwnd":67890}
```

## Per-browser checklist

For each of Chrome, Edge, Brave, Vivaldi, Opera, Firefox:

1. Open the browser to a real page (not a blank new-tab page — some browsers show a
   different/absent Edit control there).
2. Focus the window, note its pid/hwnd, send a `resolve` request.
3. Confirm: `ok: true`, a real `url`, `source: "uia"`, `confidence: "displayed"`.
4. Click into the address bar and start typing (don't press Enter). Send `resolve` again —
   confirm it fails with `address-bar-focused`, not a stale/garbage URL.
5. Open a private/incognito window, repeat step 2-3. Confirm `private: true` for Chromium
   browsers and Firefox. **This is the highest-risk check** — `AddressBarReader`'s Chromium
   incognito detection uses a guessed AutomationId
   (`IncognitoIndicatorAutomationId` in `AddressBarReader.cs`) that has never been confirmed
   against a real incognito window. If it reports `private: false` or `null` for a real
   incognito window, use Accessibility Insights to find the toolbar's actual
   avatar/incognito-indicator element and its real AutomationId, then fix the constant.
6. Close all browser windows, then send a `resolve` for the pid you just used — confirm a
   clean typed error (not a crash, not a hang).

## Elevated-process check

Run a browser "as Administrator" (right-click → Run as administrator) while win-resolver
itself runs normally (non-elevated). Confirm `resolve` against that window's pid returns
`elevated-target`, not a hang or a crash.

## Timeout check

There's no reliable way to force a real UIA hang on demand. If you suspect the 250ms deadline
or the timeout/dedup logic (`AnsweredRequestTracker`, the `Task.WhenAny` race in
`Program.cs`) isn't working, the cheapest real check is temporarily inserting a
`Thread.Sleep(2000)` at the top of `AddressBarReader.Read` and confirming: the `resolve` call
returns `uia-timeout` at ~250ms (not ~2000ms), and the process doesn't crash or corrupt the
protocol once the artificially-slowed read eventually finishes in the background. Revert the
sleep afterward — it must never ship.

## `--capture-fixtures`

```powershell
dotnet run --project native/win/resolver/WinResolver -c Release -- --capture-fixtures
```

Navigate around normally in each browser (send `resolve` requests as above, or eventually via
the full Electron app once wired in) — every read's raw toolbar candidates get appended to
`address-bar-fixtures.jsonl` in the working directory. This is the real data Stage E's
normalization fixtures should be built from, not invented strings.
