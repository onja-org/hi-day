# What hiday can and can't do

A plain guide to what to expect. Checked against the product in November 2026.

## The main thing to know

How well it works depends on whose device it runs on.

- Work devices (owned by the company): everything works, and the company controls the machine's permissions. Locking the app so staff can't quit it is planned. Today anyone can quit it from the tray menu.
- Personal devices (an employee's own laptop): it still works, but staff can quit the app or refuse the permissions it asks for. Some features become best-effort.

## What it can do

- Track time spent on projects and tasks, including while offline.
- See which apps and websites are being used.
- Take screenshots, as often as you choose, and delete them after a set number of days.
- Show how active someone is.
- Turn hours into reports, with CSV export.

Payroll and client invoicing are planned, not built yet.

## What it can't do

- Track anything from just a web browser. The desktop app must be installed.
- Run hidden. A tray icon shows when tracking is on, and admins can publish a notice explaining what is tracked.
- Record what someone types. It only shows active vs. idle.
- Track a phone's location. There is no phone app yet.

## Apps vs. websites

Tracking apps and tracking websites work differently, which is why one is solid everywhere and the other has gaps.

Apps are easy. The computer always knows which program is in front, so the app asks every few seconds and gets an answer: Chrome, Slack, Excel. This works across every program with almost nothing to set up.

Websites are harder. The computer knows Chrome is open but not which page it shows. hiday doesn't use a browser add-on. Instead it reads the address bar the same way screen readers for blind users do, through the system's accessibility features. How well that works depends on the system:

- Mac: exact web addresses for Safari, Chrome, Edge, Brave, Vivaldi and Opera. Firefox gives the address as shown in its bar. The person has to allow it in System Settings, and can say no.
- Windows: the address as shown in the browser's bar. No permission needed.
- Linux: the address as shown in the bar, on GNOME (Wayland) or any desktop running Xorg. A browser that was already open before hiday was first started can't be read until it is restarted. hiday offers to do that.

When hiday can see that a browser is in front but can't read its address, it records that time as "URL unknown" instead of guessing or dropping it.

## Quick summary

| Feature | Works? | Notes |
| --- | --- | --- |
| Time tracking | Yes | Web and desktop. Keeps working offline. |
| Apps in use | Yes | Every platform. |
| Reports | Yes | CSV export. Payroll and invoicing planned. |
| Screenshots | Yes | Needs the desktop app. On a Mac it needs the screen-recording permission. |
| Website tracking | Yes | Depends on the browser and system (see above). |
| Activity level | Yes | Active vs. idle, never what was typed. |
| Location / GPS | No | Needs a phone app, which is planned for a later release. |

## How reliable is it, and why

Most of hiday (the server, the web console, timers and reports) is ordinary TypeScript and as dependable as any web app.

The parts to watch are the ones that reach into the operating system: reading which window is in front, reading browser address bars, and taking screenshots. They rely on small helpers that ship with the desktop app, and they can break when the app's framework ([Electron](https://www.electronjs.org/)) is updated or a new Windows or macOS version comes out. The habit that keeps them reliable: pin versions, ship everything prebuilt, and re-test on real Windows and Mac machines after any big update.

Because the desktop app runs all day, it also restarts itself after a crash and saves captured data on the computer first, so a dropped connection loses nothing.

| Feature | Built with | Reliability | The catch |
| --- | --- | --- | --- |
| Time and reports | NestJS + Next.js | Very high | None. Ordinary web-app code. |
| Idle detection | Electron (built in) | Very high | On Linux Wayland it works on GNOME only. Other Wayland desktops don't report idle time. |
| Apps and windows | Electron + @paymoapp/active-window | High | The helper must match the app's Electron version. |
| Screenshots | Electron's own screen capture | High | Needs the macOS screen-recording permission. |
| Activity level | Electron's idle timer | High | Measures whether there was input, not how much. Same Linux limits as idle detection. |
| Website tracking | Small helper per system (C# on Windows, TypeScript on Mac and Linux) | Medium | Depends on each browser's accessibility support and on permissions. |

## Will it cope with lots of people at once?

Yes. The desktop app sends data in batches about once a minute, screenshots go straight to cloud storage without passing through the server, and reconnecting apps spread out their retries. That keeps 1,000 all-day users within one modest server, one database and one storage bucket. The one cost that grows with use is screenshot storage, which is why the frequency and retention settings matter. See `TECH_DESIGN.md` §4 and §8 for the details.
