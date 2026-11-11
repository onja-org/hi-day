# URL tracking: resolver toolchain

What you need to build and test each platform's URL resolver. For what an end user's machine needs at runtime, see [`url-tracking-machine-requirements.md`](./url-tracking-machine-requirements.md).

`electron-builder` refuses to package when the platform's resolver is missing (`scripts/beforePack.mjs`), so an installer can't ship without URL tracking by accident.

## Windows

`native/win/resolver/` is C#/.NET using FlaUI and UI Automation. It ships as `win-resolver.exe`, published self-contained and single-file, so the end user needs nothing installed. Full build, packaging and signing steps are in [`native/win/README.md`](../native/win/README.md).

| | Requires |
|---|---|
| Build | .NET 8 SDK, on Windows. `pnpm --filter desktop dist:win` runs the `dotnet publish` step itself |
| Test URL capture | A real Windows machine with the target browsers installed. [Accessibility Insights for Windows](https://accessibilityinsights.io/) to inspect the real UIA tree when a read fails. See `native/win/resolver/MANUAL_TESTING.md` |
| End user | Nothing. The .NET runtime is inside the exe |

NativeAOT and trimming are ruled out (`native/win/spike/RESULTS.md`: `InvalidProgramException` under AOT, built-in COM disabled under trimming). `WinResolver.csproj` pins `PublishAot=false`, `PublishTrimmed=false` and `SelfContained=true`, so a plain `dotnet publish` can't drift into either. If AOT is ever reconsidered, it also needs the MSVC linker and Windows SDK (Visual Studio 2022 or Build Tools with the "Desktop development with C++" workload). Without them, publish fails with `Platform linker not found`.

## macOS

The resolver for Chrome, Edge, Brave, Vivaldi, Opera and Safari is AppleScript run through `osascript`, so there is nothing to compile. Firefox has no AppleScript URL support (Mozilla bugs 369901 and 516502), so it uses a compiled Swift helper, `desktop/native/darwin/firefox-ax-helper-swift/`.

| | Requires |
|---|---|
| Build | Xcode Command Line Tools (`swift build -c release`, see `build.sh`). `pnpm --filter desktop dist:mac` runs it |
| Test URL capture | A real Mac with the target browsers installed. Full Xcode for Accessibility Inspector, which you need to find the right AX element when the Firefox helper's guess is wrong. It does not ship with the Command Line Tools |
| End user | Nothing to install. The Automation and Accessibility grants in [`url-tracking-permissions.md`](./url-tracking-permissions.md) |

Signing matters for testing, not only for release. Apple Events consent is keyed to the code signature, and builds are currently ad-hoc signed (`identity: "-"`, with `hardenedRuntime` and `build/entitlements.mac.plist`). An ad-hoc signature changes on every build, so each new build re-prompts for every grant. A developer's own build that was granted once keeps working, while the same feature re-prompts or fails on a machine that got a differently signed build. A Developer ID certificate would give dev and test the same stable identity as release.

You can't build a real macOS installer on Linux. `electron-builder --mac` on Linux packages the app but skips signing (`supported only on macOS`), and skips the Firefox helper because it must be compiled with Swift on a Mac first.

## Linux

`desktop/src/main/resolvers/linux/` is TypeScript talking to AT-SPI2 directly over D-Bus (`dbus-next`). It is compiled with the rest of the app and runs as a child process, like the macOS resolver. There is no Python. Focus comes from AT-SPI's `window:activate` events, because `org.gnome.Shell.Introspect.GetWindows` returns `AccessDenied` to an ordinary process on GNOME 46.

| | Requires |
|---|---|
| Build | Nothing beyond `pnpm build` |
| Test URL capture | A real desktop session: GNOME on Wayland, or any window manager on Xorg. Target browsers installed and launched through the agent's launcher overrides (see machine requirements). [`accerciser`](https://gitlab.gnome.org/GNOME/accerciser) helps inspect the AT-SPI tree but is optional |
| End user | `at-spi2-core`, declared in `deb.depends` |

The resolver declares no `private` capability and always reports `private: null`. No Chromium incognito marker has been confirmed through AT-SPI on a real machine, and claiming the capability without one would report private windows as normal ones.

Verified on Ubuntu 24.04, GNOME Shell 46, Wayland: the resolver started as a side-car, sent `ready` with `caps: ["focus","url"]`, tracked focus across Chrome, GNOME Shell and a terminal, and answered `resolve` with a real URL (`nodejs.org/en/about`, `source: "atspi"`, `confidence: "displayed"`) in about 14 ms.

Packaging gap: `linux.target` builds `AppImage` and `deb` only. There is no `rpm` target, so nothing ships for Fedora. An `rpm` target would need the equivalent `rpm.depends`, untested on a real Fedora machine.
