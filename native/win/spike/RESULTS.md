# Stage C.0 spike results — FlaUI vs. CsWin32 under NativeAOT

**Status: run for real in CI.** Every number below came from actual `windows-latest` GitHub
Actions runs (workflow: `windows-native-spike.yml`), not a guess. Where something could not
be measured, that's stated plainly rather than filled in with a plausible-looking number.

## Why Notepad, not Chrome

The runtime risk being tested is whether COM marshalling survives NativeAOT's compilation —
that risk lives in the *interop mechanism*, not in which specific application is on the
other end of the COM call. Notepad gets the same UIA COM round-trip with none of a browser's
install/focus/version flakiness on a CI runner. Browser-specific element-finding is a
separate, later concern for Stage C.1+, validated on a real machine once a library is chosen
here.

## Results

| | FlaUI | CsWin32 |
|---|---|---|
| JIT build | succeeded | succeeded |
| AOT publish (compile/link) | succeeded | succeeded |
| AOT binary size | 15,608,320 bytes (~14.9 MiB) | 2,346,496 bytes (~2.24 MiB) |
| **UIA read succeeded at runtime under AOT** | **No** | **No** |
| Runtime error under AOT | `System.InvalidProgramException`: the body of method `Interop.UIAutomationClient.CUIAutomation8Class..ctor()` is invalid | `System.InvalidProgramException`: the body of method `Windows.Win32.UI.Accessibility.CUIAutomation..ctor()` is invalid |
| Trimmed self-contained publish (non-AOT) | succeeded, 34,930,240 bytes | succeeded, 12,195,105 bytes |
| **UIA read succeeded under trimmed self-contained** | **No** | **No** |
| Runtime error under trimmed self-contained | `System.NotSupportedException`: "Built-in COM has been disabled via a feature switch" | same — `System.NotSupportedException`, built-in COM disabled |
| Plain (non-trimmed) self-contained publish | not measured — see below | not measured — see below |
| Cold start / 100-read timing | not measured (gated behind a successful read, which never happened) | not measured (same) |

## What this actually shows

Both libraries fail identically at two independent packaging options, for two different but
both well-understood reasons:

1. **NativeAOT**: the AOT compiler (ILC) generates invalid IL for the COM coclass activation
   constructor (`CUIAutomation`/`CUIAutomation8Class..ctor()`) regardless of which tool
   generated the interop code (FlaUI's classic dynamic COM interop, CsWin32's
   source-generated bindings). This is a hard, structural incompatibility between
   NativeAOT and classic/built-in COM coclass activation — not a bug in either library that
   could be worked around with different code.
2. **Trimming**: independently of AOT, .NET's linker disables built-in COM interop entirely
   under `PublishTrimmed=true` (a documented feature switch,
   https://aka.ms/dotnet-illink/com). So a trimmed build was never viable for either
   variant regardless of the AOT question.

Both failure modes are properties of the **packaging option** (AOT / trimming), not of the
library choice. FlaUI and CsWin32 are equally disqualified from both.

**Not directly confirmed in CI**: whether a plain, non-trimmed self-contained publish (the
only packaging option left) actually gets a working UIA read. Both variants' CI runs hung
indefinitely attempting this — first past an 18-minute silent run, then again past a
10-minute step timeout added specifically to bound it, with the hang's exact cause still
undiagnosed (an `[STAThread]` fix, the most likely suspect given UI Automation's documented
apartment-threading requirement, did not resolve it). Rather than keep spending CI cycles
chasing what looks like a runner-environment issue (GitHub's hosted Windows runners are a
known-flaky environment for real GUI automation — launching and driving a window via UIA,
independent of which .NET library is used), this is called out honestly as unverified by
CI rather than guessed at.

This is **not** treated as equivalent uncertainty to the AOT/trim questions above. Classic
COM-based UI Automation in an ordinary (non-AOT, non-trimmed) .NET process is how
screen readers, WinAppDriver, and every FlaUI-based test suite have worked for well over a
decade — it is the single most well-trodden path in this entire spike, not a novel or risky
one. The hang is far more likely an artifact of automating a GUI app inside a hosted CI
runner than evidence that plain self-contained UI Automation is broken.

## Recommendation

**Ship the Windows resolver as a plain self-contained .NET application — no NativeAOT, no
trimming.** Both are confirmed dead ends, for reasons independent of library choice.

**Use FlaUI**, not CsWin32, for the real Stage C.1 resolver implementation. The only reason
to prefer CsWin32's lower-level, more error-prone raw-COM style (manual `BSTR` handling,
uncertain generated API shapes) was NativeAOT's smaller/faster footprint — and that
advantage no longer applies, since AOT is off the table for both. FlaUI's higher-level,
typed API (element trees, patterns) is materially easier to write and maintain the real
address-bar-reading resolver against, with no remaining downside once AOT is out of the
picture.

**Before writing production Stage C.1 code**, get a real-machine confirmation that a plain
self-contained FlaUI build's UIA read actually works outside of CI's hosted-runner
environment. `native/win/fixture-capture/` already exists for exactly this — it's a
FlaUI-based, non-AOT, non-trimmed, self-contained single-file tool built for manual use on
a real Windows machine (see `desktop-build.yml`'s `windows-native` job for the build/upload
step). Running that on a real machine is a more reliable way to confirm feasibility than
continuing to fight the hosted-runner hang in this throwaway spike.

## How to reproduce

Trigger `.github/workflows/windows-native-spike.yml` via `workflow_dispatch` (Actions tab →
"Windows native spike" → Run workflow). It builds both variants twice (JIT sanity build,
then AOT publish; then, since neither AOT read worked, a plain non-trimmed self-contained
publish — see the note above on why trimming was dropped from the fallback), runs each
published binary, and uploads the JSON result + binary sizes as a build artifact.
`run-variant.ps1` streams live progress output for each step, added after the
self-contained fallback attempt hung with no way to tell which step was stuck. The trimmed
self-contained numbers in the table above came from an earlier version of this script,
before that pivot — they remain valid data (trimming disables COM regardless of AOT), just
not what the script currently produces on a fresh run.
