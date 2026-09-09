# Website tracking — what it does, in plain language

This document explains what the desktop app records about the websites you visit while a
timer is running, written for the person being tracked, not for an engineer. If something
here is unclear, ask — it's meant to be a straight answer, not fine print.

## When this happens at all

This only runs while you have an active work timer. If no timer is running, nothing about
your browser activity is looked at, recorded, or sent anywhere.

While a timer is running, the app only pays attention to whichever browser window is
currently in the foreground — the one you're actually looking at and using. Background tabs,
tabs in windows you've switched away from, and anything happening in a browser that isn't
the focused window are never read. Screenshots are never taken as part of this feature.

## What gets recorded

For the focused browser window, the app records:

- The website's address (domain and page path — e.g. `example.com/dashboard`), with the
  page's query string (the part after a `?`, which often contains search terms or other
  parameters) removed by default. An organization can choose to keep query strings instead,
  but stripping them is the default.
- The page title.
- Which browser it was (Chrome, Firefox, etc.).
- How long you were actively on that page (time when your computer is idle, locked, or
  asleep is not counted).

The website address is read directly from what your operating system's accessibility
tools report — either the browser's own internal "what tab is open" information (macOS,
for Chrome/Edge/Brave/Vivaldi/Opera), or what's actually displayed in the address bar
(Windows, and Firefox on any platform). The second method means an assumption has to be
made about whether the page uses `https://` — it always assumes yes, since that's true for
the overwhelming majority of the web today, but it is technically a best-effort reading in
those cases, not a guaranteed-exact one.

## What never gets recorded

- Anything from a tab or window that isn't currently focused.
- The full query string of a page's address, unless your organization has explicitly
  configured query strings to be kept (off by default).
- Anything on a page whose address looks like a password reset, email verification, or
  one-time login link — those are recognized and the entire reading is thrown away rather
  than stored, even the domain.
- Search terms typed into an address bar that haven't been navigated to yet, or anything
  that just looks like a plain search query rather than a real address.
- A blank/new tab page.

## Private and incognito windows

This is the part that deserves the most direct explanation. A browser's built-in "don't
track my history" extension system doesn't apply here, because this app doesn't work
through a browser extension at all — it reads window information at the operating-system
level, the same way, regardless of whether a window is private or not. So this is handled
as an explicit, deliberate rule instead of relying on the browser to exclude us automatically:

**When a window is private/incognito and we can tell:** the website address is never
recorded — not stripped-down, not partial, not at all. What we do keep is that a private
session happened, which browser it was in, the page title, and how long it lasted, so time
tracking still works, but there is no record of what site you were on.

**Browsers where we can tell private mode is active:** Chrome, Edge, Brave, Vivaldi, Opera,
and Firefox.

**Browsers where we currently cannot tell:** Safari. Safari gives no reliable signal at all
for whether a window is in private browsing mode. Rather than guessing, the app's default
behavior is to keep tracking normally on Safari and mark that reading as "private mode
undetectable on this browser" — an organization can instead choose to turn off website
tracking for Safari entirely if that default isn't acceptable to them. Either way, this is
a configured, deliberate choice, not something left to chance.

## How long this data is kept

Automatic deletion of old website-tracking data (both on your own computer and on the
server) is planned but **not yet built**. Right now, once a session is stored, nothing
automatically deletes it after a fixed period. This will change — the intent is that
uninstalling the app, or the passage of time, should not leave a long history sitting on
disk indefinitely — but until that's actually implemented, this document won't claim a
retention period that doesn't exist yet. This section will be updated with a real number
once it is.

## Questions

If anything above doesn't match what you'd expect, or you want to understand a specific
reading you've seen in your own time entries, ask — this is meant to be checkable, not
just asserted.
