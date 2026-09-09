# Windows native resolver — build, packaging, and the watchdog contract

`native/win/resolver/` is `win-resolver.exe` — the Windows side-car implementing the pinned
resolver protocol (see `desktop/src/main/url-capture/protocol.ts` and
`docs/url-tracking-plan.md` Stage C). `native/win/spike/` is the throwaway NativeAOT-vs-CsWin32
decision spike (see its own `RESULTS.md`) — not part of the shipped build. (An earlier,
separate `native/win/fixture-capture/` data-collection tool has been removed — the real
resolver's own `--capture-fixtures` mode, see MANUAL_TESTING.md, supersedes it.)

**NEVER RUN OR VERIFIED BY THE AGENT THAT WROTE THIS.** No Windows machine or dotnet SDK is
available in the environment this was written in — every file here is best-effort from
documented APIs, fixed only from real CI compiler/runtime feedback (see `native/win/spike`'s
fix history for how that loop worked in practice for the decision spike). Treat anything below
about signing or the manual watchdog checks as unverified until run for real.

## Prerequisites

- .NET 8 SDK, on Windows (NativeAOT was ruled out — see `native/win/spike/RESULTS.md` — but
  the FlaUI/COM interop this project uses still only works on Windows; it cannot be built or
  meaningfully tested on Linux/macOS even though the C# itself compiles cross-platform).
- For code signing only: a code-signing certificate and `signtool.exe` (ships with the Windows
  SDK).

## Building locally

```powershell
# Tests first — WinResolver.Tests references WinResolver.Core only, no
# Windows-specific code, so this part actually could run anywhere.
dotnet test native/win/resolver/WinResolver.Tests/WinResolver.Tests.csproj -c Release

# The actual side-car, self-contained, single file — NOT AOT, NOT trimmed,
# per native/win/spike/RESULTS.md's recommendation.
dotnet publish native/win/resolver/WinResolver/WinResolver.csproj -c Release -r win-x64 `
  --self-contained -p:PublishSingleFile=true
```

The publish output (`bin/Release/net8.0-windows/win-x64/publish/`) contains `win-resolver.exe`
plus `browser-registry.json` and `firefox-private-markers.json`, copied there automatically
from their single sources of truth (see `WinResolver.csproj`'s linked `<None>` entries) — do
not edit those copies; edit the linked originals under `desktop/src/main/`.

See `native/win/resolver/MANUAL_TESTING.md` for how to exercise the actual UIA read, which
can't be meaningfully covered by automated tests.

## How CI builds it

`.github/workflows/desktop-build.yml`'s `windows-native` job runs `dotnet test` then
`dotnet build` against this project on every manual dispatch (`workflow_dispatch`) — build
only there, not publish/package, since that job's purpose is "does this still compile and
pass its tests," not producing a release artifact. The full publish + electron-builder
packaging happens as part of that same workflow's normal Windows build path (`dist:win`),
which picks up `win.extraResources` in `desktop/electron-builder.yml`.

## Packaging

`electron-builder.yml`'s `win.extraResources` bundles the published output directory into
`resources/native/win/resolver/` inside the packaged app. `resolvers/win32/resolver-path.ts`
resolves the right path at runtime for both dev (walking up from `__dirname` to the raw
`dotnet build` output) and packaged (`process.resourcesPath`). `main.ts`'s
`resolverSpawnConfigForPlatform` now wires this in via `ResolverOrchestrator` — still
completely unverified against a real Windows machine, same as everything else in this
directory (see this file's top disclosure). Confirm it actually works there before trusting
any of it.

## Code signing

`native/win/resolver/sign.ps1` signs `win-resolver.exe` itself, separately from whatever
signs the final installer — an unsigned child `.exe` beside a signed app is exactly what EDR
products flag. Run it against the published exe after `dotnet publish`, before packaging:

```powershell
./native/win/resolver/sign.ps1 -ExePath native/win/resolver/WinResolver/bin/Release/net8.0-windows/win-x64/publish/win-resolver.exe
```

The certificate is never committed — the script reads it from environment variables
(`WIN_CODESIGN_PFX_PATH` + `WIN_CODESIGN_PFX_PASSWORD`, or `WIN_CODESIGN_THUMBPRINT` for a
cert already in the machine's certificate store; whichever form this project ends up using).
With neither set, the script warns and exits successfully rather than failing the build — a
local/CI build without signing configured still produces a runnable (just unsigned) binary.

**Verify the signature** with `signtool verify /pa win-resolver.exe` (also what `sign.ps1`
itself runs immediately after signing) — a clean run prints "Successfully verified."

## The watchdog contract (Prompt C.3)

Three things Electron's `ResolverManager` depends on, and why each already holds by
construction rather than needing extra code:

- **`ping`/`pong` survives a UIA hang.** `Program.cs` answers `ping` synchronously, inline,
  on the same thread that reads stdin — it never touches `UiaWorker` (the dedicated MTA
  thread all FlaUI/COM calls run on). A wedged UIA call can only ever block *that* thread and
  whatever `resolve()` call is waiting on it; the ping-handling path has no dependency on it
  at all. See `MANUAL_TESTING.md`'s "Timeout check" for how to verify this concretely (an
  artificial `Thread.Sleep` in `AddressBarReader.Read`, confirming pings — send them
  interleaved with a slowed-down `resolve` — still return instantly).
- **Clean exit on stdin close.** `Program.cs`'s main loop is `while ((line =
  Console.In.ReadLine()) != null)` — `ReadLine` returns `null` on EOF, the loop exits, the
  three background resources (`focusWatcher`, `uiaWorker`, `addressBarReader`) are disposed,
  and the process exits naturally since none of their threads are foreground.
- **No orphaned COM state on respawn.** `ResolverManager` kills and respawns the entire OS
  process, not a thread within a persistent one — Windows tears down every COM
  proxy/handle/thread belonging to a killed process as part of ordinary process cleanup, and
  the *target* browser's own accessibility provider (a different process) is unaffected by
  our client dying mid-call. A fresh `win-resolver.exe` process starts with fresh COM state
  by construction; there is no shared state between the old and new process for anything to
  leak through.

## Known limitations

- Chromium incognito detection uses a guessed `AutomationId` — see
  `AddressBarReader.cs`'s `IncognitoIndicatorAutomationId` and `MANUAL_TESTING.md`. Confirm
  against a real incognito window before relying on it; a wrong guess fails silently
  (under-reports `private`), which is the worse failure direction given
  `session-engine.ts` only strips `url`/`host`/`path` when `private === true`.
- No code-signing certificate exists yet in this project — `sign.ps1` is prepared but
  inert until one is provisioned, the same state darwin's notarization setup is in.
