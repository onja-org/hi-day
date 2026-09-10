# URL tracking — native resolver toolchain requirements

What each platform's native resolver (`native/win/`, `desktop/native/darwin/`, `native/linux/`)
actually needs, split by who needs it and for what — building it from source, testing that it
really captures a URL on that platform, and running the finished, packaged app. These are three
different requirement sets and conflating them is exactly what caused the confusion this doc
corrects: "the SDK is a dev-only requirement" is true for *running* the packaged app, but
building the same resolver two different ways needs two different toolchains, and "end user
needs nothing" is flatly wrong for Linux.

Linux's resolver is now built and verified on real hardware — see its section below, which
also records where the shipped implementation deliberately departs from
`docs/url-tracking-plan.md` Steps 18-19 and why.

## Windows

`native/win/resolver/` (C#/.NET, FlaUI/UI Automation). Two build paths exist because Stage C.0's
NativeAOT-vs-CsWin32 spike (`native/win/spike/RESULTS.md`) ruled out both NativeAOT and
trimming with real CI evidence (`InvalidProgramException` under AOT; built-in COM disabled
entirely under trimming) — the shipped path is plain self-contained, **not** AOT. That decision
is already pinned in `WinResolver.csproj` (`<PublishAot>false</PublishAot>`,
`<PublishTrimmed>false</PublishTrimmed>`, `<SelfContained>true</SelfContained>` are explicit
properties, not just command-line flags someone could omit) — so a plain `dotnet publish` can't
silently drift into a framework-dependent or AOT build. Listing the AOT toolchain below anyway,
since the spike's own wording only rules AOT out for *this* interop approach, not forever.

| | Build (plain self-contained — the shipped path) | Build (NativeAOT — ruled out, listed for completeness) | Test URL capture | End user |
|---|---|---|---|---|
| Requires | .NET 8 SDK | .NET 8 SDK **+** the MSVC linker and Windows SDK — in practice, Visual Studio 2022 (or standalone Build Tools) with the **"Desktop development with C++"** workload | A real Windows machine, Chrome/Edge/Brave/Vivaldi/Opera/Firefox actually installed, and [Accessibility Insights for Windows](https://accessibilityinsights.io/) (free, Microsoft) to inspect the real UIA tree when a read fails | **Nothing** — `win-resolver.exe` is published self-contained + single-file, bundling the .NET runtime; electron-builder's `win.extraResources` ships that one file |
| Why | `dotnet build`/`dotnet publish` needs only the SDK for a managed, non-AOT build | NativeAOT's `ilc` compiles to native code and needs a real platform linker to produce the final executable — without the C++ workload, publish fails with `error : Platform linker not found` | UIA reads real browser toolbars; nothing about this can be meaningfully mocked (see `native/win/resolver/MANUAL_TESTING.md`) | Self-contained publish is specifically "the runtime ships inside the exe" — that's the whole point of the flag |
| Command | `dotnet build native/win/resolver/WinResolver/WinResolver.csproj -c Release` (dev) or the full publish in `native/win/README.md` (packaging) | N/A — not the project's current publish config | See `MANUAL_TESTING.md`'s per-browser checklist | — |

## macOS

`desktop/native/darwin/` — the main resolver (Chrome/Safari/Edge/Brave/Vivaldi/Opera) is plain
AppleScript via `osascript`, nothing to compile at all. Only the Firefox piece
(`firefox-ax-helper-swift/`, since Firefox has no AppleScript URL support — Mozilla bugs
369901/516502) is compiled Swift.

| | Build | Test URL capture | End user |
|---|---|---|---|
| Requires | Xcode **Command Line Tools** (`swiftc`/`swift build`) is enough to compile `firefox-ax-helper` | Full **Xcode** (not just the CLT) — **Accessibility Inspector**, the tool needed to locate real AX elements when the Firefox helper's guessed element (see `AddressBarReader`-equivalent AX walk) needs fixing, ships only with full Xcode, not the CLT alone | A real macOS machine, the target browsers installed, and a real, consistent code-signing identity — see next row | **Nothing at runtime** *if* the packaged app is properly signed and notarized (see below) |
| Why | `swift build -c release` (see `firefox-ax-helper-swift/build.sh`) only needs the compiler | Locating AX elements by trial and error against Accessibility Inspector is how `IncognitoIndicatorAutomationId`-equivalent guesses in this codebase get confirmed or fixed (`MANUAL_TESTING.md`'s Windows equivalent — no macOS version exists yet, same gap) | Apple Events' Automation permission grant is **keyed to the app's code signature** (`docs/url-tracking-permissions.md`) — re-signing with a different signature (including going from an ad-hoc/dev signature to a real Developer ID one) resets every permission grant. **This is a bug class that only shows up on someone else's machine**: a developer's own ad-hoc-signed local build, once granted permission once, keeps working locally — the same feature silently fails (or re-prompts unexpectedly) on a machine that received a differently-signed build | `hardenedRuntime: true` + `entitlements: build/entitlements.mac.plist` in `electron-builder.yml` are already wired, but `identity: null` (no real cert yet) means they're currently **inert** — see `desktop/README.md`'s "Known limitations" |
| Also needed for real dev/test parity | A **Developer ID Application certificate** and the entitlements plist (`desktop/build/entitlements.mac.plist`) — belongs in the *dev/test* toolchain, not just "release signing," because a build signed ad-hoc (electron-builder's default with no cert configured) behaves differently for Apple Events consent than a build signed with a real, stable identity | | |

**electron-builder cannot build or sign a macOS installer from Linux.** Confirmed directly —
running `electron-builder --mac` on this Linux machine packages the app but logs `skipped
macOS application code signing  reason=supported only on macOS`, and the Firefox helper step
is skipped too (`file source doesn't exist … native/darwin/firefox-ax-helper`, since that
binary has to be built with Swift on macOS first). A real `.dmg`/notarized build can only be
produced on a real Mac, not from CI running on a Linux runner or from a developer's Linux
machine.

## Linux

`desktop/src/main/resolvers/linux/` — **built and verified working on real hardware.** Implemented in TypeScript talking to AT-SPI2 directly over D-Bus (`dbus-next`), *not* as the Python side-car `docs/url-tracking-plan.md` Step 19 proposed. `pyatspi` is only a GObject-introspection wrapper over the same D-Bus calls, so going straight to the bus removes Python from the shipped product entirely and keeps the resolver inside the app's own TypeScript build, exactly like darwin's.

**Step 18's specified focus mechanism does not work and is not used.** `org.gnome.Shell.Introspect.GetWindows` returns `AccessDenied: GetWindows is not allowed` to an ordinary user process on a stock GNOME 46 session, and so does `GetRunningApplications` — measured, not assumed. AT-SPI's own `window:activate` events supply the same information, so focus detection and URL reading both come from one mechanism.

| | Build | Test URL capture | End user |
|---|---|---|---|
| Requires | Nothing beyond the normal `pnpm build` — it is TypeScript compiled with the rest of the app | A real Linux desktop session (GNOME-on-Wayland or any-WM-on-Xorg per Step 20's gate), target browsers installed, and `toolkit-accessibility` enabled. [`accerciser`](https://gitlab.gnome.org/GNOME/accerciser) is useful for inspecting the AT-SPI tree but is not required | `at-spi2-core` (already present on any GNOME install — it provides the accessibility bus) |
| No longer required | — | — | ~~`python3-pyatspi`, `python3-gi`, `gir1.2-atspi-2.0`, `libatk-adaptor`~~ — eliminated by dropping Python |

**Still a runtime configuration step, not installable as a dependency:** `org.gnome.desktop.interface toolkit-accessibility` must be `true`. GTK apps only build their AT-SPI tree when it is on, and it is **off by default**. The resolver detects this and surfaces the exact command through the coverage screen rather than appearing silently broken:

```bash
gsettings set org.gnome.desktop.interface toolkit-accessibility true
# then restart the browser — the setting is read at launch
```

**Verified on this machine** (Ubuntu 24.04, GNOME Shell 46.0, Wayland): the compiled resolver spawned as a real side-car, emitted `ready` with `caps: ["focus","url"]`, tracked window focus across Chrome/GNOME Shell/terminal, and answered `resolve` with a real captured URL (`nodejs.org/en/about`, `browser: "chrome"`, `source: "atspi"`, `confidence: "displayed"`) in ~14ms.

**`private` is deliberately not a declared capability.** No Chromium incognito marker has been confirmed through AT-SPI on a real machine, and claiming the capability without one would under-report `private` — the failure direction that leaks a private URL. It reports `null` (unknown) instead, which the session engine already handles.

**Packaging gap, not yet closed:** `desktop/electron-builder.yml`'s `linux.target` currently
builds `AppImage` and `deb` only — no `rpm` target is configured. Fedora is one of the three
environments the Stage D.1 spike explicitly asks to be tested against
(`native/linux/spike/probe.sh`'s own usage instructions), but there is currently no `.rpm`
output for it to ship as at all. When a `deb` target is built, the dependencies above should be
declared via `deb.depends` in `electron-builder.yml`. That list is now much shorter than it
would have been — dropping Python removed four packages, leaving `at-spi2-core` as the only
real candidate, and it is already present on any GNOME install. An eventual `rpm` target
would need the equivalent `rpm.depends`, still unconfirmed against a real Fedora machine.
