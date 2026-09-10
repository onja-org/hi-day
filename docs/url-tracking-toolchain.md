# URL tracking — native resolver toolchain requirements

What each platform's native resolver (`native/win/`, `desktop/native/darwin/`, `native/linux/`)
actually needs, split by who needs it and for what — building it from source, testing that it
really captures a URL on that platform, and running the finished, packaged app. These are three
different requirement sets and conflating them is exactly what caused the confusion this doc
corrects: "the SDK is a dev-only requirement" is true for *running* the packaged app, but
building the same resolver two different ways needs two different toolchains, and "end user
needs nothing" is flatly wrong for Linux.

Linux's resolver (`native/linux/`) is not built yet — Stage D is still at the feasibility-spike
stage (`native/linux/spike/`, see its `RESULTS.md`). Its row below is what the plan
(`docs/url-tracking-plan.md` Steps 18-20) commits to, not verified shipped behavior yet.

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

`native/linux/` — planned as a Python side-car speaking the pinned protocol (GNOME Shell
Introspect for focus, AT-SPI2/pyatspi for the URL); **not built yet**, only spiked
(`native/linux/spike/RESULTS.md`). The end-user column below is the packaging plan, not
verified shipped behavior.

| | Build | Test URL capture | End user |
|---|---|---|---|
| Requires | Nothing to compile — plain Python. Development/spike work needs `python3-pyatspi` installed locally (see below) | A real Linux desktop session (GNOME-on-Wayland or any-WM-on-Xorg per Step 20's support gate — nothing else), target browsers installed, and [`accerciser`](https://gitlab.gnome.org/GNOME/accerciser) to inspect the real AT-SPI tree when a read fails (`docs/url-tracking-plan.md` Step 20's own verification spike calls this out by name) | **Real packages, not nothing** — see below |
| Why | No compiler in the loop for a Python side-car | `native/linux/spike/probe.py` already confirms `python3-pyatspi` isn't installed by default even on a current Ubuntu LTS — a fresh test machine needs it explicitly | `pyatspi` is a GObject-introspection binding, not a self-contained library — running it requires the actual AT-SPI2 accessibility stack present and *turned on*, none of which can be bundled into the app the way Windows/macOS bundle their compiled resolvers |
| End-user runtime dependencies (verified via `apt-cache depends python3-pyatspi` on Ubuntu 24.04) | — | — | `python3-pyatspi`, which itself depends on `python3-gi`, `gir1.2-atspi-2.0`, `libatk-adaptor`, and `at-spi2-core` (the last one is what actually provides the accessibility bus — `at-spi-bus-launcher`/`at-spi2-registryd`) |
| End-user runtime *configuration*, not installable as a package dependency | — | — | The accessibility bus must be running (`at-spi2-core` provides it, but it still has to be active) and `org.gnome.desktop.interface toolkit-accessibility` must be `true` — GTK apps only build their AT-SPI tree when this is on, and it's off by default. Needs documenting as a first-run setup step, not just a dependency |

**Packaging gap, not yet closed:** `desktop/electron-builder.yml`'s `linux.target` currently
builds `AppImage` and `deb` only — no `rpm` target is configured. Fedora is one of the three
environments the Stage D.1 spike explicitly asks to be tested against
(`native/linux/spike/probe.sh`'s own usage instructions), but there is currently no `.rpm`
output for it to ship as at all. When a `deb` target is built, the dependencies above should be
declared via `deb.depends` in `electron-builder.yml` (not yet done — Linux resolver code
doesn't exist yet to depend on); an eventual `rpm` target would need the equivalent
`rpm.depends` with Fedora's package names (not yet confirmed against a real Fedora machine —
same "don't guess" caveat `native/linux/spike/probe.py` already applies to Fedora's exact
`python3-pyatspi` package name).
