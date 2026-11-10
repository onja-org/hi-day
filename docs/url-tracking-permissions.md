# URL tracking: macOS permission gates

For debugging "why does this person have no URL data" on a Mac, or why permissions that worked yesterday stopped today. For Windows and Linux, and for what IT can push to a managed fleet, see [`url-tracking-machine-requirements.md`](./url-tracking-machine-requirements.md).

Code: `desktop/src/main/resolvers/darwin/`. `permission-copy.ts` holds the System Settings deep links and guidance text the app shows. `permission-state.ts` and `permission-onboarding.ts` model per-target Automation state, but only tests use them so far; the app does not run them.

## The gates

| Gate | Needed for | How it's checked |
|---|---|---|
| Automation, per target app | Apple Events to System Events (focus detection) and to each Chromium browser and Safari (URL reading) | No check API exists. A real Apple Events call that returns `consent-denied` (-1743) means denied. Any other answer, including "no window", means granted |
| Accessibility | The Firefox AX helper | `systemPreferences.isTrustedAccessibilityClient(false)` in `main.ts`. A real check that never prompts. It is only asked for when Firefox is installed |
| Screen Recording | Not needed for URL tracking | Modeled as `not-required` |

Screen Recording would be needed to read window titles through Core Graphics. This implementation reads titles through System Events and the Accessibility tree instead, which is not believed to need it. That still needs confirming on real hardware. If it turns out to be needed, the fix is the default in `permission-state.ts`, not a redesign. The app does ask for Screen Recording for screenshots, which is a separate feature.

## Automation is granted per app pair

Automation is not one switch. Each target is a separate grant, and a person can allow some and deny others:

- System Events, for focus detection. Needed whichever browser is in front.
- Chrome, Edge, Brave, Opera and Vivaldi, which share one Chromium AppleScript. Arc uses the same script but has no entry in `permission-state.ts`.
- Safari, which has its own dictionary.

Firefox needs no Automation grant. It uses the Accessibility gate through the Swift AX helper.

## What breaks without each gate

- System Events denied: focus detection produces nothing, so no browser is ever resolved, whatever its own Automation state. This is the most important gate to get right at onboarding.
- One browser's Automation denied: that browser returns `consent-denied` on every read, and its time is recorded as "Unknown website (<browser>)". Other browsers keep working.
- Accessibility denied: Firefox URLs are not read and its time is not recorded as website time. There is no title-only fallback. Other browsers are unaffected.

## Re-signing or moving the .app resets all of this

TCC grants are keyed to the app's code signature, and sometimes its path. Re-signing with a different signature, or moving or renaming the `.app`, resets every Automation and Accessibility grant to "ask again".

Builds are currently ad-hoc signed (`identity: "-"` in `electron-builder.yml`), and an ad-hoc signature changes on every build. So every new build re-prompts for every gate, in development and for real users updating. This is the OS, not a bug in the permission code. A stable Developer ID signature across releases is what will stop it.

## Recovery

A permanent "Don't Allow" can only be undone in System Settings. macOS never re-prompts on its own. Deep links (`SETTINGS_DEEP_LINKS` in `permission-copy.ts`):

- Automation: `x-apple.systempreferences:com.apple.preference.security?Privacy_Automation`
- Accessibility: `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`
- Screen Recording: `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`

## Where support sees the state

Each device sends its URL capture health on the heartbeat (`assessUrlCapture` in `desktop/src/main/url-capture-health.ts`), and the Devices page shows it. It reports whether the resolver is running and whether it can read URLs. It does not report per-browser Automation state, so a denied browser shows up only as "Unknown website" time for that browser.
