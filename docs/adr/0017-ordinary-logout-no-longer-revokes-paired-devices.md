---
status: accepted
---

# Ordinary web logout no longer revokes paired devices; a new explicit `logoutEverywhere` action does

ADR-0009 made logging out of the web app a sign-out-*everywhere* action: `AuthService.logout` unconditionally revoked every `DeviceSession` the user had (desktop app pairings on any machine) and stopped whatever timer each revoked device had running. In practice this meant a `DeviceSession` — which otherwise never expires on its own (no TTL, no periodic cleanup) — got destroyed by something as routine as logging out of the web dashboard on a different computer or browser profile than the one the desktop app was paired through. The desktop app has no way to distinguish "the account owner explicitly wants me signed out" from "someone logged out of a completely unrelated browser tab," so every such logout forced the desktop app back through its full pairing flow (open browser, approve, re-pair) — in effect requiring people to "log in" to the desktop app far more often than the pairing model was supposed to require, and undermining the "pair once" promise pairing was meant to give.

## Considered options

- **Keep logout as sign-out-everywhere** (status quo) — rejected as reported: users end up re-pairing the desktop app after routine logouts that had nothing to do with that device, which reads as "I have to log in twice" even though the `/link-device` approval step itself doesn't ask for a password when the browser already has a valid web session.
- **Expire `DeviceSession` on a TTL instead**, independent of logout — would still force periodic re-pairing (just on a timer instead of triggered by logout) and doesn't address the actual complaint; not pursued.
- **Split logout into two actions** (chosen): ordinary `POST /auth/logout` now only revokes the current refresh token and clears this browser's cookies — it never touches `DeviceSession` rows. A new `POST /auth/logout-everywhere` (`AuthService.logoutEverywhere`) keeps the old full behavior (revoke this session + every device + stop each device's running timer) for when someone actually wants that — account compromise, a lost/stolen machine, or just wanting a clean slate. Password reset's existing `revokeAll` cascade is untouched (a password reset is already a strong signal that every existing session should die).

## Consequences

- `AuthService.signOutAllDevices` (private) is now called from exactly two places: `resetPassword` and the new `logoutEverywhere` — never from ordinary `logout`.
- The existing per-device `POST /me/devices/:deviceId/sign-out` and admin `POST organisations/:id/devices/:deviceId/sign-out` endpoints (already built, previously the only way to explicitly unpair a single device without nuking everything) are unaffected.
- Before this change, there was no web UI for a full "sign out everywhere" action at all — it only ever happened as a side effect of ordinary logout or a password reset. A "Sign out everywhere" button was added to the account page (`/account/edit`), calling the new endpoint, so that capability isn't silently lost now that routine logout no longer implies it.
- A `DeviceSession` genuinely has no expiry now unless explicitly revoked (via per-device sign-out, `logoutEverywhere`, or password reset) — this was already true before this change (ADR-0009 never added a TTL), just less visible because ordinary logout was quietly doing the revoking for you.
