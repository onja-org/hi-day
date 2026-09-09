# URL tracking — manual verification drills

Everything that can be scripted lives in `desktop/src/main/url-capture/tests/` (see
`failure-drills.spec.ts` and `acceptance-criteria.spec.ts`, run via `pnpm --filter desktop
drills`). This document is only for what genuinely needs a real machine, a real browser, or a
real person — the automated suite cannot meaningfully fake any of these.

Run through this list before shipping a release that touches Stage B/C/D (any platform
resolver) or Stage E (normalization). Record the result of each row — pass, fail, or "not
applicable to this platform" — don't leave any blank.

## Per-browser matrix

For each browser your organization supports, on each platform that browser runs on: start a
timer, browse for a few minutes across several real sites, stop the timer, and confirm the
recorded sessions look right (real URLs, reasonable durations, no garbage rows).

| Browser | macOS | Windows | Linux |
|---|---|---|---|
| Chrome | | | |
| Edge | | | |
| Brave | | | |
| Vivaldi | | | |
| Opera | | | |
| Firefox | | | |
| Safari | N/A (macOS only) | N/A | N/A |

## Incognito and private windows

For each browser above that supports a private/incognito mode: open one, browse for a few
minutes, stop the timer, and confirm **the stored session has no URL, host, or path** — only
title, browser, duration, and `private: true`. This is the single most safety-critical check
in this whole document; see `docs/url-tracking-privacy.md`.

- [ ] Chrome incognito
- [ ] Edge InPrivate
- [ ] Brave private
- [ ] Vivaldi private
- [ ] Firefox private browsing
- [ ] Safari private (confirm it's *not* detected as private — expected, since Safari gives no
      signal — and that the disclosed "capture with flag" policy from
      `URL_TRACKING_CONTEXT.md` is what actually happens)

## Multi-monitor and window spanning displays

- [ ] Move the focused browser window across two monitors mid-session — confirm tracking
      doesn't drop or duplicate.
- [ ] A window that spans two displays (partially on each) — confirm focus detection still
      identifies it correctly.

## Non-English UI locale

This is where name-matching bugs surface — every element-matching strategy in this project is
supposed to key off control type/position/AutomationId, never a localized label, but this is
the only way to actually prove that.

- [ ] Set the OS (or just the browser's language, where that's independent) to a non-English
      locale per platform — French and Japanese are good choices (very different address-bar
      layouts/rendering). Confirm URL reading and private-mode detection both still work.

## Windows-specific

- [ ] An elevated (Run as Administrator) browser, non-elevated agent: confirm `resolve()`
      returns the `elevated-target` typed error, not a hang or a crash, and the coverage
      screen shows a clear reason.

## macOS-specific

- [ ] Firefox with `accessibility.force_disabled` set (a real setting some users apply from
      "speed up Firefox" advice): confirm the agent detects Accessibility is unavailable and
      degrades to title-only rather than silently doing nothing.

## Browser updated and restarted mid-session

- [ ] Start a timer, start browsing, then let the browser auto-update and restart itself (or
      simulate by quitting and relaunching) while the timer keeps running. Confirm the
      session closes cleanly on the quit and a fresh one opens correctly once the browser (and
      focus) come back — no hang, no stuck state, no orphaned COM/AX state on the resolver
      side (see native/win/README.md's watchdog contract section for what "no orphaned state"
      is actually claiming and why).

## Recording results

Copy this file's checklist into your release notes (or a tracking issue) with each box
checked/failed, plus the platform/browser/OS-version combination actually tested — "tested"
without specifics is not verifiable later.
