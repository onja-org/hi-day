*This research is done with Claude and all info is double checked on Google.*

This is a quick, plain guide to what the product can and can't do, so you know what to expect.

## The main thing to know

How well it works depends on whose device it runs on:

- **Work devices** (owned by the company): everything works, and staff can't switch it off.
- **Personal devices** (an employee's own laptop or phone): it still works, but staff can turn parts off. Some features become "best-effort."

## What it can do

- Track time spent on projects and tasks.
- See which apps and websites are being used.
- Take screenshots (you choose how often).
- Show how active someone is.
- Turn hours into reports, payroll, and invoices.

## What it can't do

- Track anything secretly from just a web browser — a small app must be installed.
- Run completely hidden. Staff are shown it's on, and they're asked to allow it.
- Record exactly what someone types. It only shows active vs. idle.
- Track a phone's location perfectly in the background as phones limit this.

## How it works (the apps vs. websites bit)

People usually assume that tracking which apps someone uses and tracking which websites they visit work the same way. They don't. And that difference is the whole reason one is rock-solid and the other needs an add-on.

Start with the apps. Your computer always knows which program we're using right now — it has to, or our typing wouldn't land in the right place. So our app just quietly asks the computer "what's open at the moment?" every few seconds, and the computer tells it: Chrome, Slack, Excel, whatever it is. That's it. Because the computer already has the answer, this part just works, across every program, with pretty much nothing to set up.

Websites are the tricky one. Here's the bit that trips everyone up: our computer knows Chrome is open, but it has *no idea* which website you're actually on. That stays locked inside the browser, and the browser keeps it to itself. So the same trick we use for apps doesn't work here — there's simply nobody to ask.

The only thing that knows the web address is the browser itself. So to see it, we have to put a tiny helper inside the browser. That's the add-on. It keeps an eye on the tabs and passes the current address back to the app.

Which is why website tracking comes with a couple of catches. Every browser needs its own add-on (though Chrome, Edge and Brave all share one). And because the add-on sits inside the browser, someone on their own personal laptop can just switch it off or delete it. On a company-owned device you can lock it in place so it can't be removed — and *that's* when website tracking becomes something you can genuinely count on.

## Quick summary

| Feature | Works? | Notes |
| --- | --- | --- |
| Time tracking | Yes | Works everywhere. |
| Apps in use | Yes | Works everywhere. |
| Reports | Yes | Works everywhere. |
| Screenshots | Yes | Needs the installed app + permission. |
| Website tracking | Yes | Reliable on work devices; can be turned off on personal ones. |
| Activity level | Yes | Shows active vs. idle — not what was typed. |
| Location / GPS | Yes | Phone app only; less reliable in the background. |

## The technical side: how reliable is it, and why

JavaScript is a solid choice for the whole thing — nothing here forces us into another language. The reliability questions aren't really about JavaScript itself. They're about the few small pieces that have to reach into the operating system, because plain JavaScript can't do that on its own.

Most of the product — the backend, the dashboard, the timers, reports, and even the browser extension's own logic — is ordinary JavaScript, and it's as dependable as any web app you've shipped. The parts that have to touch the operating system are the ones to watch: reading which window is open, taking screenshots, and measuring typing and mouse activity. Those can't be done in plain JavaScript, so they rely on small helper components that ship with the desktop app. They work well, but they're the things that can break when we update the app's framework ([Electron](https://www.electronjs.org/)) or when a new version of Windows or macOS lands.

So the rule of thumb is simple: pin our versions, ship everything ready-built so nobody's compiling anything on their own machine, and re-test on real Windows and Mac computers after any big OS or [Electron](https://www.electronjs.org/) update. That habit is what keeps a JavaScript agent reliable over time.

There's one real gotcha in the browser extension worth flagging. Modern extensions don't run all the time anymore — the browser puts them to sleep when nothing's happening and wakes them back up when something does (a tab changes, a page loads, the window switches). So the website tracking has to be built to *react to those events*, not to sit in a loop expecting to run forever. Done that way it's reliable. Done the naive way — say, a timer that assumes it's always running — it'll quietly miss visits.

And because the desktop app runs all day, it needs the basics of any long-running program: keep memory tidy, restart itself if it crashes, and save data locally so a dropped internet connection doesn't lose anything. JavaScript handles all of that fine — you just have to build for it on purpose.

**Here's the feature-by-feature picture:**

| Feature | Built with | Reliability | The catch |
| --- | --- | --- | --- |
| Time, reports, payroll | NestJS + Next.js | Very high | None — it's ordinary web-app code. |
| Idle detection | Electron (built in) | Very high | Nothing extra needed. |
| Apps & windows | Electron + get-windows | High | The helper must match the app's Electron version. |
| Screenshots | Electron + the OS screenshot tool | High | Needs the macOS screen-recording permission. |
| Website (URL) tracking | Browser extension (JS) | High | Browser sleeps the extension when idle — must be event-driven. |
| Activity level | Electron + uiohook-napi | Medium | Most fragile helper; can trip antivirus; sensitive to OS updates. |
| Location / GPS | React Native | Medium | The phone limits background tracking no matter what. |

## Will it cope with lots of people at once - more on the tech side?

What matters isn't the number of people; it's how the app talks to the server and where the screenshots end up. A few habits keep it comfortable:

- **Don't chat with the server constantly.** Each installed app should gather its data and send it in batches every minute or so, instead of firing off a message for every tiny thing. That turns thousands of little messages into a light, steady trickle the server barely notices.
- **Send screenshots straight to storage, not through the server.** Screenshots are the only heavy thing here. The app should upload them directly to cheap cloud storage, so the main server never carries the image files — it just keeps a note of where each one is. This is also why the settings for how often screenshots are taken, and how long they're kept, matter for cost.
- **Do the heavy lifting in the background.** Jobs like shrinking screenshots and adding up the day's totals for reports should run on a background queue, not while someone's waiting. Everything stays feeling instant.
- **Prepare the reports ahead of time.** Dashboards should read from ready-made summaries, not crunch through every raw record each time a manager opens a page.
- **Cope with dropped connections.** If someone's internet drops, the app should hold onto its data and send it once the connection's back — nothing lost, and no flood when everyone reconnects at once.

Built this way, a thousand all-day users still sits comfortably in "one modest server, one database, one storage bucket" territory, with plenty of room to grow to many thousands before anything needs rethinking. The one cost that genuinely grows with use is screenshot storage — which is exactly why the frequency and retention settings are worth getting right.

**Bottom line:** JavaScript end to end is the right call for the first version. The only place where native code (Rust, or a small Swift or C#helper) would be a bit sturdier and lighter is the always-on screenshot and activity capture, because a background program written in native code uses less memory and is less exposed to the helper-breakage above. But that's a later optimisation — and if you ever want it, we can swap out just that one piece and leave everything else in JavaScript.
