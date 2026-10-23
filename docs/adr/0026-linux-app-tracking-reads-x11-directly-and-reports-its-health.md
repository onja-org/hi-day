# Linux app tracking reads X11 directly on every session, and reports whether it works

Some Ubuntu users never had any app tracking, while URL tracking worked on the same machines and colleagues on what looked like identical setups had both. Nothing looked broken: the agent ran, URLs synced, and the Apps tab for those people was simply empty.

## Root cause

`WindowSampler.tick()` had three Linux paths:

- **Wayland:** X11 for XWayland clients (`X11WindowTracker`, the pure-JS `x11` protocol client added in `09c75fb`), then AT-SPI for Wayland-native windows (`docs/adr/0016-...`).
- **Xorg:** `@paymoapp/active-window`, the native addon (`docs/adr/0011-...`).

The addon's Linux prebuild links against **glibc 2.38** (`objdump -T` lists `GLIBC_2.38` and `GLIBC_2.36`). Ubuntu 22.04 ships glibc 2.35. Loading it in an `ubuntu:22.04` container fails with:

```
libc.so.6: version `GLIBC_2.38' not found (required by .../@paymoapp+active-window.node)
```

`loadActiveWindowModule()` caught that, logged it once to a console that a packaged app writes nowhere, and every sample after that had `appName: null`. `AppEventUploader` drops null-app samples, so nothing reached the server and nothing said why.

So the affected set was **Ubuntu 22.04 (or any glibc < 2.38) on an Xorg session**. Two 22.04 machines with the same hardware and setup split on which session the person picked at the login screen, or which one GDM picked for them. NVIDIA machines on 22.04 commonly default to Xorg. Wayland sessions on 22.04 were unaffected, because that branch already avoided the addon. `09c75fb` named the glibc problem, but only rerouted the Wayland branch.

URL tracking kept working because it never used this path. It reads the browser through AT-SPI (`resolvers/linux/`), which has no native addon.

## What this ADR decided

- **The addon is never used on Linux.** `X11WindowTracker` is read first on every Linux session. On Xorg it sees every window; on Wayland, every XWayland client. AT-SPI is consulted only on Wayland, only when X11 reports no focused window. On Xorg, a null from X11 means the desktop itself has focus, and the sample is empty without a `not-exposed` tag.
- **App names don't change.** The addon reported the `WM_CLASS` class on Linux, which is exactly what `X11WindowTracker` reads. This was checked side by side on the same windows: `zenity` gave `zenity` from both; Chrome gave `Google-chrome` from both. Existing Xorg users on 24.04, whose tracking already worked, keep the same rows in the Apps tab. Titles match too: `X11WindowTracker` falls back to the legacy `WM_NAME` when `_NET_WM_NAME` is empty, as the addon did (`XGetWMName`).
- **The agent reports app-capture health on its heartbeat**, and the Devices page shows it. `assessAppCapture()` (`desktop/src/main/app-capture-health.ts`) judges from whether each window source came up, not from samples coming back empty, since an empty sample is ordinary whenever the desktop has focus:

  | Session | X11 | AT-SPI | Status |
  | --- | --- | --- | --- |
  | Xorg | up | (not needed) | `ok` |
  | Xorg | down | (not needed) | `unavailable` |
  | Wayland | up | up | `ok` |
  | Wayland | up | down | `degraded`: Wayland-native windows missing |
  | Wayland | down | up | `degraded`: XWayland windows missing |
  | Wayland | down | down | `unavailable` |
  | Windows / macOS | addon loaded | | `ok`, otherwise `unavailable` |

  AT-SPI counts as "up" only once the registry has recorded the `window:activate` listener. `AtspiClient.start()` already checks this, because at-spi2-core 2.44 accepts a registration and then drops it. The heartbeat also carries the session type and desktop (`x11 · ubuntu:GNOME`), the variable that separates two machines that look alike.
- **A desktop release need not wait for the backend.** The backend validates with `forbidNonWhitelisted`, so a backend older than these fields rejects the heartbeat with a 400. That would stop `lastSeenAt` moving and show the device offline. The agent retries a 400 with the version alone.
- **Stored on the Device**, as `appCaptureStatus` (enum), `appCaptureDetail` and `displaySession`. A heartbeat without a status (an older agent, or a newer one whose sources are still starting) leaves the last report standing rather than clearing it.

## Supported set

- **Xorg, any EWMH-compliant window manager** (GNOME, KDE, Xfce, Cinnamon, MATE and most others): full coverage via the X protocol. A window manager that doesn't publish `_NET_ACTIVE_WINDOW` reports `ok` but records nothing. The addon needed the same property, so this was never covered.
- **GNOME on Wayland:** full coverage via X11 (XWayland clients) plus AT-SPI (Wayland-native windows).
- **Other Wayland desktops:** whichever of the two sources answers. XWayland clients are always covered while XWayland runs; Wayland-native windows only if that compositor emits AT-SPI `window:activate`, which was verified only on GNOME. The Devices page shows `degraded` when one source is missing.

## Verification

- The addon load failure was reproduced in an `ubuntu:22.04` container (glibc 2.35).
- The Xorg branch was exercised under Electron on a real X server, with `WAYLAND_DISPLAY` unset and `XDG_SESSION_TYPE=x11`. The focused X11 window was sampled through `X11WindowTracker`, with the addon stubbed to throw, and health came back `ok`. Pointing `DISPLAY` at a display that doesn't exist gave `unavailable` with the reason.
- **Not yet verified:** a real Ubuntu 22.04 Xorg session from an affected user. That run, and the session type and glibc version of affected and unaffected machines (`echo $XDG_SESSION_TYPE; ldd --version | head -1`), are what close this out.
