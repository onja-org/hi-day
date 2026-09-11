# URL tracking — macOS permission gates

*For anyone debugging "why does this user have no URL data" or wondering why permissions
that worked yesterday stopped working today. Implementation lives in
`desktop/src/main/resolvers/darwin/permission-state.ts` and `coverage.ts`.*

*macOS only. For the cross-platform picture — what has to be true on a Windows, macOS or
Linux machine before tracking produces data, and what IT can push centrally to a managed
fleet — see [`url-tracking-machine-requirements.md`](./url-tracking-machine-requirements.md).*

## The gates

| Gate | Needed for | Consent required? | How it's checked |
|---|---|---|---|
| **Automation** (per target app) | Apple Events to System Events (focus detection) and to each Chromium browser + Safari (URL resolution) | Yes — one grant per (this app, target app) pair | No dedicated check API exists. Inferred from real Apple Events attempts: a `consent-denied` (-1743) response means denied; any other response (success, or e.g. "no window") means granted, since the event reached the target at all |
| **Accessibility** | The Firefox AX helper (Step 10); possibly full window-title fidelity via System Events GUI scripting (unconfirmed — flagged below) | Yes | `systemPreferences.isTrustedAccessibilityClient(false)` — Electron's own binding for `AXIsProcessTrusted()`, called from the main process (see `readDarwinPermissions()` in `main.ts`). A real no-prompt check, and no side-car needed |
| **Screen Recording** | Window titles, in the *original* plan (which assumed `get-windows`) | N/A in this implementation | Modeled as `not-required` — see below |

**Why Screen Recording is `not-required` here specifically**: the original plan assumed
`get-windows`, which needs Screen Recording for window titles (a Core Graphics API). This
implementation reads titles via System Events / the Accessibility tree instead (see the
Stage B.1 design note on dropping `get-windows` to avoid a second native-module ABI
surface) — a different code path not believed to need Screen Recording at all. **Flagged
for real-hardware confirmation, not asserted with false confidence** — if it turns out
System Events' window introspection does trip a Screen Recording (or additional
Accessibility) requirement in practice, that's a small correction to
`permission-state.ts`'s default, not a redesign.

## Automation is granted per (app, target) pair — seven separate grants

Automation consent is not one on/off switch. Each of these is independent, and a user can
grant some and deny others:

- **System Events** — needed for focus detection itself (`focus-monitor.ts`'s frontmost-app
  script), independent of which browser is focused.
- **Chrome, Edge, Brave, Opera, Vivaldi** — the shared Chromium-family Apple Events script.
- **Safari** — its own dictionary.

Firefox needs none of these — it's Accessibility-gated instead, via the Swift AX helper.

## What breaks without each gate

- **System Events denied** → focus detection produces nothing at all. No `focus` events, no
  resolve requests ever get sent for any browser, regardless of that browser's own
  Automation status. This is the single most impactful gate to get right during onboarding.
- **A specific browser's Automation denied** → that browser resolves nothing (a typed
  `consent-denied` error on every resolve attempt) while every other granted browser keeps
  working normally. Not a global failure — this is per-browser.
- **Accessibility denied** → Firefox degrades to title-only (Prompt B.2's stated fallback);
  every other browser is unaffected.
- **Screen Recording** — not required by this implementation; nothing breaks here (see above).

## Re-signing or moving the .app resets ALL of this

This is a real, well-documented macOS behavior, not a bug in this codebase: TCC grants are
keyed by the app's code signature and (in some cases) its path. **Re-signing the app with a
different signature, or moving/renaming the `.app` bundle, resets every Automation and
Accessibility grant back to asking again.** During development, this means:

- Every fresh local build may re-prompt for every gate, even ones you granted five minutes
  ago on the previous build.
- This is expected and does not indicate a regression in the permission state machine —
  don't spend time debugging `permission-state.ts` when this happens; it's the OS, not us.
- It also means production users who update via a differently-signed build (shouldn't
  happen once real notarized signing with a stable Developer ID is in place — Step 27) would
  see the same reset. Consistent signing identity across releases is what prevents this in
  production; it doesn't need solving for local development.

## Recovery — deep links to the right System Settings pane

A permanent "Don't Allow" is only undoable in System Settings, never re-prompted
automatically. Deep links used for recovery (see the onboarding/permissions UI):

- Automation: `x-apple.systempreferences:com.apple.preference.security?Privacy_Automation`
- Accessibility: `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`
- Screen Recording (unused today, listed for completeness): `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`

## The capability report

`buildCapabilityReport` (in `resolvers/darwin/coverage.ts`) builds a snapshot combining installed-browser detection with current
permission state, into exactly what Step 25 asks for: "for each installed browser, whether
URL tracking is active, degraded, or off, and why, in one sentence." This is what should
eventually be attached to the device's heartbeat/registration payload (see the open
integration gap noted in `docs/url-tracking-gap-analysis.md` — no such transport exists yet)
so support can answer "why do I have no URL data" without a screen-share.
