---
status: accepted
---

# Two-step login with an authenticator app

Today a stolen password is enough to get into an account, and an admin's account can see screenshots and activity for the whole company. Anyone can now turn on two-step login for their own account: after the password, logging in asks for a 6-digit code from an authenticator app (Google Authenticator, 1Password and the like). Requiring it for everyone in an organisation is a separate, later change built on this one.

## Decisions

- **Authenticator-app codes only (TOTP, RFC 6238).** No text messages: they are weak and cost money. Passkeys and security keys are later work. TOTP is hand-rolled in `common/totp.util.ts`, a few lines of `crypto` pinned against the RFC's own test vectors, rather than a dependency.
- **The secret is encrypted, not hashed.** Unlike a password, the server has to read the secret back to check a code. It is encrypted with AES-256-GCM under `TWO_FACTOR_ENCRYPTION_KEY`, a required setting kept outside the database, so a copy of the database alone can't produce codes. Losing or changing that key makes two-step login unusable for everyone who has it on, and an admin then has to reset each of them.
- **Nothing changes until a code is confirmed.** Setup stores a *pending* secret. It only replaces the live one, and two-step login only turns on, once a code from it checks out, so scanning and walking away changes nothing.
- **The password step leaves a challenge, not a session.** A right password for an account with two-step login sets a five-minute, httpOnly `two_factor_challenge` cookie. Only its hash is stored, on the user row, the same way refresh tokens are stored. `POST /auth/login/two-factor` trades that cookie and a code for the normal session cookies. No access or refresh token exists until both steps pass.
- **Wrong codes are limited exactly like wrong passwords.** They count against the same per-email `LoginAttemptTracker`, and for an account with two-step login the count isn't cleared by a right password, only by a right code. After five wrong codes the challenge is thrown away and the person starts again from the password, with the captcha. A right password behind a solved captcha earns one code attempt: a right code clears the count, a wrong one asks for the captcha again, so it stays one guess per captcha, as with passwords. The signed-in actions that take a code (turn off, new recovery codes) answer 429 while that count wants a captcha.
- **A code can't be used twice.** Each accepted code records its 30-second step, and only later steps are accepted after that. The update is conditional, so two requests racing with the same code can't both win. One side effect: right after logging in, the code still on screen is refused for that window.
- **Recovery codes.** Ten one-time codes (`ABCDE-FGHJK`, no 0/O/1/I) are shown once when two-step login is turned on, and again whenever the set is renewed, which replaces every earlier code. Only their hashes are stored (`two_factor_recovery_codes`). Using one marks it used, conditionally, like app codes. Anywhere a code is asked for, a recovery code also works.
- **Weakening it asks for a code first.** Turning it off and creating new recovery codes both take a current code (app or recovery).
- **Turning it on or off signs out every other browser.** It reuses the session-version bump and refresh-token revocation from password reset, and keeps the current browser signed in. Paired desktop devices are left alone, as with ordinary logout (ADR-0017): pairing is approved from a browser that already passed two-step login, so it stays the way the desktop app gets in.
- **The desktop app's old password form is refused for these accounts.** `AuthService.login`'s `deviceFingerprint` branch (kept for pre-pairing builds, ADR-0009) has no code step, so it would be a way around two-step login. It answers 403 and points the person to signing in through the browser.
- **A password reset doesn't sign the person in when two-step login is on.** The reset link proves only access to the inbox, which is exactly what two-step login is there to not be enough. The new password is set, every session ends as before, and the person then logs in with both steps.
- **An admin can reset it for someone who lost both their phone and their recovery codes.** `POST /organisations/:id/memberships/:membershipId/two-factor-reset` is admin-only (not managers), never for yourself (use a recovery code instead), scoped to the admin's own organisation, and recorded in the audit log as `membership.two_factor_reset`. The member then logs in with only their password until they turn it on again.

## Consequences

- **`TWO_FACTOR_ENCRYPTION_KEY` is now required to boot,** including on self-hosted installs: `docker-compose.yml` refuses to start without it. Every environment needs one generated (`openssl rand -base64 32`) and kept.
- **Audit log actions added:** `two_factor_enabled`, `two_factor_disabled`, `two_factor_recovery_codes_renewed`, and `membership.two_factor_reset`. A `login` row now carries `{ twoFactor, usedRecoveryCode }` when the second step was used.
- **`LoginAttemptTracker` is still in memory.** With several backend instances, each counts separately, the same caveat password guessing already has.

## Not handled

- Requiring two-step login for a whole organisation (separate ticket).
- Nudging admins and owners to turn it on, and "remember this browser for 30 days". Both are open product questions, left out here.
