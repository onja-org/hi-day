# Blind browsers are detected at runtime, their time is kept as "URL unknown", and a self-relaunch no longer switches URL capture off

Some Ubuntu users had URL tracking that worked on some days and not others, while app tracking worked throughout. Colleagues on what looked like the same setup never saw it. The ticket blamed a browser extension, but there isn't one, by design (`URL_TRACKING_CONTEXT.md`, constraint 1). On Linux, URLs are read from the browser's address bar over AT-SPI.

## Root cause

A Linux browser builds its accessibility tree only if it starts with `--force-renderer-accessibility` (Chromium) or `GNOME_ACCESSIBILITY=1` (Gecko). `browser-activation.ts` adds both by shadowing every `.desktop` entry that declares itself an `http` handler.

**Chrome's installed web apps don't declare that.** Each one (YouTube, Meet, Calendar and so on) gets its own `chrome-*-Default.desktop` in `~/.local/share/applications`, running `/opt/google/chrome/google-chrome --app-id=…` with no `MimeType=x-scheme-handler/http`. Those launchers are never shadowed. When a web app is the first Chrome thing opened, Chrome's main process starts without the flag. Every normal window opened afterwards, even from the shadowed launcher, joins that existing process, and Chromium ignores the new invocation's flags. URL tracking is then dead for every Chrome window until Chrome fully quits. Autostart entries and terminal launches do the same.

Whether it happens depends on what someone opens first each day, which is why it is intermittent and why identical machines differ. App tracking is unaffected because it reads windows through X11 and `window:activate`, not the address bar.

Reproduced with the real resolver code against throwaway Chrome profiles (`--user-data-dir`), so nobody's own browser was touched:

| Launch order | Main process has the flag | Address bar of the normal window |
| --- | --- | --- |
| `--app=…` (web-app style), then a normal window with the flag | no | not found |
| normal window with the flag first | yes | found (`example.org`) |

`BrowserRestartService.findBlind()` already detected blind browsers from `/proc`, but only for the one-time setup screen, so a browser that went blind later went unnoticed. A failed read was dropped without a trace: no session, no health signal. `ResolverHealthTracker` collected health but never sent it anywhere.

## A second cause: URL capture switched off after the app relaunches itself

Found afterwards on a machine whose Chrome had the flag but whose installed agent recorded no URLs all morning, while app tracking worked.

Electron writes `Unity` over `XDG_CURRENT_DESKTOP` in its own process and keeps the real value in `ORIGINAL_XDG_CURRENT_DESKTOP`, and `support-gate.ts` reads that. It survives only one generation. When the app relaunches itself (here, an auto-update's `quitAndInstall` with run-after; also crash recovery's `app.relaunch()`), the new process inherits `Unity` and Electron copies it over `ORIGINAL_…` as well:

| Launch | `XDG_CURRENT_DESKTOP` | `ORIGINAL_XDG_CURRENT_DESKTOP` |
| --- | --- | --- |
| from the session | `Unity` | `ubuntu:GNOME` |
| relaunched from inside Electron | `Unity` | `Unity` |

The side-car then reads "Wayland, not GNOME", reports no `url` capability, and never connects to the accessibility bus. That was confirmed live: it had no connection there at all, and the registry listed only the main process as a listener. It stays like that until the next normal launch, so URL tracking breaks after every auto-update or crash and comes back at the next login. App tracking doesn't go through the gate and carries on.

**Fix:** `readSessionEnvironment` ignores Electron's `Unity` placeholder. When both variables hold it, it rebuilds the desktop from markers Electron leaves alone: `GNOME_SHELL_SESSION_MODE` or `XDG_MENU_PREFIX=gnome-`, with `XDG_SESSION_DESKTOP` (`ubuntu` gives `ubuntu:GNOME`). Otherwise it uses `XDG_SESSION_DESKTOP` / `DESKTOP_SESSION` as given. The support gate, the Devices page's display session, and the browser relaunch environment all read through it. With the live side-car's environment, the gate now answers supported. The per-device health in this ADR would have shown this case as `unavailable`, with the gate's reason.

## What this ADR decided

- **Detect, don't prevent.** Chrome's web-app launchers are not rewritten. They sit in the highest-precedence directory, so they would have to be edited in place: Chrome rewrites them on app updates, and uninstall deletes any file carrying our marker, which would delete the person's web apps. Runtime detection covers every way a browser goes blind, not just this one.
- **Blindness is judged from the process, not from failed reads.** `findBlind()` reads the activation flag from `/proc` on each 60-second heartbeat. A web-app window legitimately has no address bar either, so `no-address-bar` alone would call every PWA user degraded.
- **URL capture health per device, on the same heartbeat as app capture** (`docs/adr/0026-...`): `urlCaptureStatus` / `urlCaptureDetail`.
  - `unavailable`: the resolver has no `url` capability (unsupported session, no accessibility bus), with the side-car's own reason, or the resolver has been given up on after repeated crashes.
  - `degraded`: a blind browser is running. The reason names the browser and what fixes it.
  - Shown on the Devices page only. The in-agent restart offer stays once per install, as documented.
- **Browser time that can't be read is kept as "URL unknown".** A resolve that fails because the address cannot be read (`no-address-bar` on Linux; `consent-denied` and `unsupported-browser` on macOS) for a window the browser registry identifies as a browser becomes a `urlUnreadable` engine event. The engine opens a session with an empty `url` and `host`, `private: null`, and `confidence: 'unknown'`.
  - It only opens one when nothing is open for that window: a URL already read stays, because one failed read mid-session says nothing about the page.
  - A later successful read closes it and opens the real URL.
  - Unknown time merges back only into the same browser's unknown time.
  - Browser identification is strict (`identifyBrowser`), unlike `lookupBrowser`, which falls back to generic Chromium for anything and would call a terminal a browser.
- **Reports show it, once per browser, as "Unknown website (Chrome)".** Private sessions also carry an empty url, so the report queries now exclude only private rows (`url = ''` without `confidence = 'unknown'`). Unknown rows have no link and no delete button, and `deleteByUrl` already refuses an empty url.
- **Native-messaging hosts are no longer taken for browsers.** Claude Desktop's `chrome-native-host`, started by Chrome for an extension, matched the `chrome` token and had no flag, so it counted as a blind Chrome on any machine running it. That would have made such machines permanently `degraded`. Processes carrying a `chrome-extension://` argument, or with `native` in the binary name, are now dropped as helpers.

- **A desktop release need not wait for the backend.** The sync endpoint validates every session, so a backend older than `'unknown'` rejects a whole batch containing one. The queue resends the same batch, so a single unknown session would have stopped every real URL from that device uploading. On a 400, the agent resends without the unknown sessions and acks them (`older-backend-fallback.ts`). An older backend could never store them, and left pending they would fill whole batches ahead of real sessions.

## Known effects

- **Unaffected machines get unknown rows too.** `no-address-bar` also comes from browser windows that have no address bar even with the flag: PWA windows, DevTools. So anyone who uses Chrome web apps will see an "Unknown website (Chrome)" row. That is real browser time correctly labelled, not the bug persisting.
- **The last URL status stays when capture stops.** With URL tracking switched off, the heartbeat sends no URL status, and the Devices page keeps the last one. App capture behaves the same way (`docs/adr/0026-...`).

## Verification

- With the real side-car, orchestrator and session engine on GNOME Wayland: a web-app-first Chrome produced `urlUnreadable` events and closed sessions `{ url: '', confidence: 'unknown', source: 'atspi', browser: 'chrome' }`. `findBlind` named Chrome, and health came back `degraded` with the reason. The person's own Chrome (launched with the flag) was not flagged once the native-messaging fix was in.
- The focus events in that run came from GNOME itself. A second run got no focus at all, which is GNOME focus-stealing prevention for windows launched from a background process, not this code.
- The Devices page and the dashboard's Apps & URLs list were checked in a browser.
- **Not verified:** an affected user's machine. Asking them for `ps -o args= -C chrome | grep -v -- --type= | head -1` while capture is failing, and whether they have `chrome-*.desktop` web apps or autostart entries, would confirm it. If the main Chrome process carries `--force-renderer-accessibility` while capture fails, their cause is something else.
- **Not verified on macOS or Windows:** the unknown-URL path is wired there too (macOS `consent-denied` / `unsupported-browser`), but only Linux was run.

## Separately noticed, not fixed here

This machine's local store held 325 sessions that were opened and never closed (`ended_at` null), so never synced: about 6 active minutes across two weeks. It looks like sessions left open across a quit or crash. It's small, unrelated to this bug, and worth its own ticket.
