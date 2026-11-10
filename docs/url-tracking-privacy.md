# Website tracking: what it does, in plain language

This explains what the hiday desktop app records about the websites you visit. It is written for the person being tracked, not for engineers. If something here is unclear, ask.

## When it happens

Website tracking is off unless your organisation turns it on. An admin chooses this with the "Track apps & URLs" setting, for the whole organisation or for you alone. By default it records apps only, not websites.

When it is on, websites are recorded only while you have a work timer running. With no timer running, nothing about your browsing is recorded or sent.

While a timer runs, the app only looks at the browser window in front, the one you are using. Background tabs and windows you've switched away from are never read. This feature never takes screenshots. Screenshots are a separate setting.

## What gets recorded

For the browser window in front, the app records:

- The full website address, for example `example.com/search?q=report#results`. That includes the part after `?` and `#`, which can contain search terms.
- The page title, unless your organisation has turned "Window titles" off.
- Which browser it was (Chrome, Firefox, and so on).
- How long you were actively on that page. Time while your computer is idle, locked or asleep is not counted.

The address comes from what your operating system's accessibility tools report. On a Mac, Chrome, Edge, Brave, Vivaldi, Opera and Safari report the address of the open tab directly. Everywhere else (Firefox on a Mac, and every browser on Windows and Linux) the app reads what the address bar displays. The address bar usually hides `https://`, so the app assumes it. That is true for almost every site today, but it means these readings are best-effort rather than exact.

If the app can see you are in a browser but can't read its address bar, it records that time as "Unknown website" with the browser's name and nothing else.

## What never gets recorded

- Anything in a tab or window that isn't in front.
- Pages whose address looks like a password reset, email verification or one-time login link. The app recognises these and throws the whole reading away, domain included.
- Text you've typed into the address bar but not gone to yet, or anything that looks like a search phrase rather than an address.
- A blank or new tab page.

## Private and incognito windows

The app doesn't use a browser extension, so a browser's own "don't track me in private windows" rules don't apply to it. It reads windows from the operating system in the same way whether they are private or not. Private windows are handled by an explicit rule instead.

When the app can tell a window is private, it never records the website address, not even part of it. It keeps only that a private session happened, which browser, the page title and how long it lasted. Your time is still counted, but there is no record of which site you were on.

Whether the app can tell depends on your computer:

- Mac: it can tell for Chrome, Edge, Brave, Vivaldi, Opera and Firefox. It cannot tell for Safari, because Safari gives no signal. Safari private windows are recorded like normal ones, and marked "private mode unknown".
- Windows: it can tell for Firefox. For Chrome, Edge, Brave, Vivaldi and Opera the check is not confirmed to work, so assume private windows in those browsers are recorded like normal ones.
- Linux: it cannot tell for any browser. Private windows are recorded like normal ones, and marked "private mode unknown".

## How long it is kept

There is no automatic deletion after a fixed period yet. Once a session is stored, it stays until one of these happens:

- An admin or manager deletes all of your sessions for one website. You can't delete your own, and every deletion is logged.
- The time entry it happened during is deleted, or shortened so it no longer covers that time.

On your computer, sessions wait in a local database until they're uploaded. That database is emptied when you log out, and anything left by another person is deleted when you log in.

This section will be updated with a real retention period once one is built.

## Questions

If anything here doesn't match what you see in your own time entries, ask. This is meant to be checkable.
