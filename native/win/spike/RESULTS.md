# Stage C.0 spike results — FlaUI vs. CsWin32 under NativeAOT

**Status: not yet run.** Nothing below is a real measurement — this file is a template to be
filled in from an actual CI run's output. See `.github/workflows/windows-native-spike.yml`
(workflow_dispatch) for how to run it.

Every number in this file must come from a real run. If something couldn't be measured,
write "not measured" and say why — never fill in a plausible-looking placeholder.

## Why Notepad, not Chrome

The runtime risk being tested is whether COM marshalling survives NativeAOT's trimming —
that risk lives in the *interop mechanism*, not in which specific application is on the
other end of the COM call. Notepad gets the same UIA COM round-trip with none of a browser's
install/focus/version flakiness on a CI runner. Browser-specific element-finding is a
separate, later concern (validated in a real VM once a library is chosen here).

## Results

| | FlaUI | CsWin32 |
|---|---|---|
| AOT compile | not measured | not measured |
| Compile error (if failed) | — | — |
| Binary size (self-contained AOT publish) | not measured | not measured |
| **UIA read succeeded at runtime under AOT** | not measured | not measured |
| Runtime error (if failed) | — | — |
| Cold start (indicative only, not a decision input) | not measured | not measured |
| 100-read time (indicative only, not a decision input) | not measured | not measured |

## Recommendation

Not yet determined — pending the table above. Per the original brief: if AOT compiles but
the runtime UIA read fails for a variant, that's a **hard disqualifier for that variant**
regardless of compile success, since it means dynamic COM marshalling was trimmed away. If
neither variant's AOT runtime read succeeds, the fallback is self-contained trimmed (non-AOT)
publish, with its measured size recorded here instead — not a guess.

## How to reproduce

Trigger `.github/workflows/windows-native-spike.yml` via `workflow_dispatch` (Actions tab →
"Windows native spike" → Run workflow). It builds both variants twice (JIT sanity build, then
AOT publish), runs each published binary once, and uploads the JSON result + binary size as
a build artifact. Paste the job output back for this file to be filled in for real.
