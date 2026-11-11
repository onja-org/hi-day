# URL tracking: manual verification drills

The scripted drills live in `desktop/src/main/url-capture/tests/` (`failure-drills.spec.ts` and `acceptance-criteria.spec.ts`). Run them with `pnpm --filter desktop drills`. This checklist covers what needs a real machine, a real browser or a real person.

Run it before shipping a release that touches a platform resolver or the normalization pipeline. Record every row as pass, fail or not applicable. Don't leave any blank.

## Per-browser matrix

For each supported browser on each platform it runs on: start a timer, browse several real sites for a few minutes, stop the timer. Check that the recorded sessions have real URLs, sensible durations and no garbage rows.

| Browser | macOS | Windows | Linux |
|---|---|---|---|
| Chrome | | | |
| Edge | | | |
| Brave | | | |
| Vivaldi | | | |
| Opera | | | |
| Firefox | | | |
| Safari | | N/A | N/A |

## Private and incognito windows

This is the most safety-critical check here. See `docs/url-tracking-privacy.md` and the private-mode section of `URL_TRACKING_CONTEXT.md`.

Open a private window, browse for a few minutes, stop the timer. Where the platform detects private mode, the stored session must have no URL, host or path. It keeps only title, browser, duration and `private: true`.

What to expect, by platform:

- macOS: Chrome, Edge, Brave, Vivaldi, Opera and Firefox are detected. Safari is not (it gives no signal), so confirm its private windows are captured with `private: null`, per the capture-with-flag policy.
- Windows: Firefox is detected. Chromium detection relies on an unverified UIA AutomationId (`IncognitoIndicatorAutomationId` in `AddressBarReader.cs`). This drill is what confirms or rules it out. Record what actually happens, and check that normal windows are not marked private.
- Linux: nothing is detected. Confirm private windows are captured with `private: null`.

Checklist:

- [ ] Chrome incognito
- [ ] Edge InPrivate
- [ ] Brave private
- [ ] Vivaldi private
- [ ] Opera private
- [ ] Firefox private browsing
- [ ] Safari private

## Multi-monitor

- [ ] Move the focused browser window to another monitor mid-session. Tracking should not drop or duplicate.
- [ ] Place a window across two displays. Focus detection should still identify it.

## Non-English UI locale

Element matching is supposed to use control type, position or AutomationId, never a localized label. This is the only way to prove it.

- [ ] On each platform, set the OS (or just the browser, where that's independent) to a non-English locale. French and Japanese are good choices. Confirm URL reading and private-mode detection still work.

## Windows

- [ ] Run the browser elevated (Run as Administrator) and the agent not elevated. The resolver should return the `elevated-target` error, not hang or crash.

## macOS

- [ ] Set `accessibility.force_disabled` in Firefox (it circulates in "speed up Firefox" advice). The Firefox helper should fail cleanly, with no hang and no crash. No Firefox URLs are recorded in this state.

## Browser restarted mid-session

- [ ] Start a timer and browse. Let the browser auto-update and restart, or quit and relaunch it, while the timer runs. The session should close cleanly on quit, and a new one should open once the browser has focus again. No hang, no stuck state, no orphaned COM or AX state in the resolver. `native/win/README.md`'s watchdog contract section explains what "no orphaned state" means.

## Recording results

Copy this checklist into the release notes or a tracking issue. Mark each box pass or fail and note the exact platform, browser and OS version tested. "Tested" with no specifics can't be checked later.
