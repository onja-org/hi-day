---
status: accepted
---

# Desktop app authenticates by pairing with an already-logged-in web session, not its own password form; logging out on the web revokes it

Product direction: login/logout should only ever happen in the web app. The desktop app's own email/password form (`AuthService.login`'s `deviceFingerprint` branch, added when the desktop agent first shipped) is superseded by a pairing flow, and logging out of the web app now also signs the user's devices out.

## Considered options

- **Custom URL protocol deep link** (`workforce-monitor://...`) — the browser redirects straight back into the installed app after login, no polling delay. Rejected: requires registering a protocol handler per platform (`app.setAsDefaultProtocolClient`, plus Windows/Linux `second-instance` vs. macOS `open-url` handling) for a UX improvement (instant vs. a few seconds of polling) that doesn't change what's possible, only how fast. More moving parts for a first version of this flow.
- **Device pairing code + polling** (chosen) — desktop asks the backend for a one-time code, opens `${FRONTEND_URL}/link-device?code=...` in the system browser, and polls a status endpoint until approved. Mirrors patterns like `gh auth login`/smart-TV app pairing. The approval step doubles as the natural place to show the person which device/platform is asking, before anything is issued.
- **Revoke device sessions on every session boundary** (e.g. access-token expiry) vs. **only on explicit sign-out-everywhere actions** (`POST /auth/logout`, and password reset's existing `revokeAll`). Chose the latter — coupling device revocation to ordinary 15-minute access-token expiry would silently kill the desktop app's session throughout a normal day and make it unusable. "Logged out from the website" means the person (or something re-authenticating as them) took an explicit action, not that a token happened to expire.
- **What happens to a running desktop timer when its device gets revoked mid-session.** A revoked `DeviceSession` can no longer call `stop` — left alone, the running `TimeEntry` would stay open forever, blocking any new timer for that Membership (the one-running-timer-per-Membership constraint, ADR-0006). Logout now stops it server-side instead, using the same server-authoritative stop `TimeEntriesService.stop` already provides for idle auto-discard, timestamped to the moment of logout. Hours already worked aren't lost; nothing is silently discarded — this was a deliberate call, not a default, given how easily it could have gone the other way (block logout instead) and change how "just log out and go" behaves.

## Consequences

New `DevicePairingRequest` entity: `codeHash` (never store the raw code, same convention as `Invitation`/`RefreshToken`/`DeviceSession`), the device's own identifying fields (fingerprint/platform/os/hostname/appVersion, captured at request time), and `approvedByUserId`/`approvedOrganisationId`/`approvedAt`/`claimedAt`. Approval only ever *records* who approved it and for which organisation — resolved from the approver's own active Membership server-side, exactly like `AuthService.login`'s existing device-fingerprint branch, never trusted from anything the desktop sent (ADR-0005's re-resolve-don't-trust rule applies just as much to a pairing code as to a JWT claim). The actual `Device`/`DeviceSession` row, and the device token, are only created when the desktop's *next poll* claims an approved request — inside one transaction that also stamps `claimedAt` — so a raw token is never persisted at rest in the pairing table itself, and the code is single-use by construction rather than by convention.

`AuthService.login`'s `deviceFingerprint` branch is deliberately left in place for now rather than removed in the same change — installed desktop builds already in the field (shipped before this ADR) still call it directly, and pulling it out immediately would break them until they update. Remove it in a follow-up once the pairing flow has shipped and those installs have had a chance to update themselves.

`RefreshTokenService.revokeByValue` now returns the `userId` it revoked (or `null`) instead of `void`, since `AuthService.logout` needs it to know whose device sessions to revoke.
