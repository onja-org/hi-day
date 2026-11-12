# Docs

Start with the [main README](../README.md) for setup. Domain terms (Organisation, Membership, Device and so on) are defined in [CONTEXT.md](../CONTEXT.md).

## Running hiday

- [SELF_HOSTING.md](SELF_HOSTING.md): install with Docker, email, HTTPS, backups and upgrades.

## Product and design

- [FEATURES.md](FEATURES.md): a one-page list of what hiday does today, and what's planned.
- [PRD.md](PRD.md): what hiday should do. Each requirement says whether it's built or planned.
- [TECH_DESIGN.md](TECH_DESIGN.md): how the backend, web console and desktop agent fit together.
- [CAPABILITIES_FAQ.md](CAPABILITIES_FAQ.md): what the app can and can't do, in plain language.
- [adr/](adr/README.md): architecture decision records, one per decision, with their status.

## Website (URL) tracking

[URL_TRACKING_CONTEXT.md](../URL_TRACKING_CONTEXT.md) at the repo root lists the rules this feature must never break. Read it before changing anything here.

- [url-tracking-plan.md](url-tracking-plan.md): how URL tracking works on each platform, and why.
- [url-tracking-api.md](url-tracking-api.md): the sync endpoint the desktop agent calls.
- [url-tracking-privacy.md](url-tracking-privacy.md): what gets recorded, written for the person being tracked.
- [url-tracking-machine-requirements.md](url-tracking-machine-requirements.md): what has to be set up on an employee's machine, and what IT can push centrally.
- [url-tracking-permissions.md](url-tracking-permissions.md): the macOS permissions and why they sometimes reset.
- [url-tracking-toolchain.md](url-tracking-toolchain.md): what you need to build and test the native resolvers.
- [url-tracking-drills.md](url-tracking-drills.md): manual checks to run before a release that touches URL tracking.
