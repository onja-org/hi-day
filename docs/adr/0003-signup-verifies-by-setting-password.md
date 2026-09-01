---
status: accepted
---

# Signup collects no password; the emailed link is where the User sets one, and that act is the verification

Signup (`POST /auth/signup`) now takes only name + email and creates a `User` with `passwordHash: null`. No session is issued at signup. The emailed link takes the User to `POST /auth/set-password`, which is the only place a password gets hashed, `emailVerifiedAt` gets set, and the access-token cookie gets issued — so a User is never logged in without having proven ownership of their email address, and there is no separate "verify email" step.

## Considered options

- **Password collected at signup, separate verify-email step, session issued immediately.** This was the original implementation. Rejected because it lets anyone create a session (and, at the time, immediately create an Organisation as its `admin`) using an email they don't own — verification was purely informational and enforced nothing.
- **Same-tab polling.** Keep password-at-signup, but have the signup tab poll a status endpoint and auto-advance once a background click on the emailed link flips `emailVerified`. Rejected for now: the emailed link is very often opened on a different device (checked hirety's two sibling repos for precedent — neither implements this pattern anywhere), so the tab that needs to "know" isn't reliably the one where verification happens. The set-password-via-link model sidesteps this entirely: whichever tab/device opens the link is the one that ends up authenticated, no polling required.

## Consequences

`JwtAuthGuard` does not check `emailVerifiedAt` — it doesn't need to. Because the cookie is only ever minted inside `setPassword()`, holding a valid access token already implies a verified email; there's no separate gate to keep in sync. A future reader adding a second way to mint that cookie (e.g. a login endpoint) must preserve this invariant — a login endpoint will need its own `emailVerifiedAt` check, since it authenticates against an already-verified User rather than verifying as a side effect.
