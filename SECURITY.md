# Security policy

Hi Day records how people work — time, active applications, websites and
screenshots. A flaw here exposes employees, not just an employer, so we would
rather hear about one early and awkwardly than late and publicly.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting:

1. Go to the [Security tab](../../security/advisories/new) of this repository
2. Click **Report a vulnerability**

That opens a private thread with the maintainers. Nothing is visible to
anyone else until we publish an advisory.

Useful in a report, as far as you have it:

- What an attacker can do, and what they need to start (an account? a
  particular role? network access?)
- Steps to reproduce, or a proof of concept
- The version or commit you tested
- Whether you ran self-hosted or on Hi Day Cloud

## What to expect

- **Acknowledgement within 3 working days.** If you hear nothing, assume the
  message did not arrive and try again.
- An assessment and a rough timeline once we have reproduced it.
- Credit in the advisory, unless you would rather not be named.

We do not run a paid bounty programme.

## Supported versions

Fixes go to the latest release. There are no long-term support branches, so
self-hosted installs should be reasonably current — see [Upgrading](docs/SELF_HOSTING.md#upgrading)
in the self-hosting guide.

## Things that are deliberate, not bugs

Worth checking against this list first:

- **Signup is open to anyone who can reach the server.** A self-hosted
  install lets any visitor create an organisation. This is documented, and
  the recommendation is to keep the install behind a VPN, an SSO proxy or a
  firewall until you want public signup. We would still like to hear ideas
  for making it optional.
- **Screenshot links are time-limited, not authenticated.** Viewing a
  screenshot uses a signed URL valid for a few minutes
  (`SCREENSHOT_URL_TTL_SECONDS`). Anyone holding a live link can open that
  one image. Shorten the window if that worries you.
- **The desktop agent allows plain HTTP to localhost and private networks.**
  A device token travels on every request, so public addresses must be
  HTTPS — but a self-hosted server on an office LAN often has no
  certificate, and that traffic does not leave the network.
- **Rate limits count by IP, and a reverse proxy hides it.** Behind a proxy,
  throttles currently apply across all clients rather than per client. Known
  and noted in the README; a report that sharpens it is welcome.

## Scope

This repository: the backend API, the web console and the desktop agent.

Hi Day Cloud (hiday.io) runs this same code, so a flaw here usually affects
both. Say in your report if you found it against Cloud.

Out of scope: findings against a third-party service we depend on — report
those to the service — and reports produced only by an automated scanner
with no demonstrated impact.
