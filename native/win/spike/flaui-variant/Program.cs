// Throwaway spike (Prompt C.0) — do not integrate this into the real
// resolver. Tests whether FlaUI's dynamic COM interop survives NativeAOT
// publish at RUNTIME, not just compile time: launches Notepad (not a
// browser — same COM interop path, no browser install/window-focus
// flakiness needed on a CI runner) and reads its text area's value via
// UIA's ValuePattern, exactly the kind of call the real resolver will make
// against a browser's address bar.
//
// NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine, no
// dotnet SDK, and NativeAOT can't cross-compile from Linux anyway. This is
// a best-effort attempt at FlaUI's documented API shape, meant to be built
// and run for real in CI. If it fails to compile, that's expected — fix
// from the real compiler error, don't guess further blind.

using System;
using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using FlaUI.Core;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;

// Explicit Main with [STAThread] instead of top-level statements: UI
// Automation client calls (the whole point of this program) require an
// STA thread — Microsoft's own docs state this. Top-level statements
// compile to an MTA Main by default with no supported way to attach
// [STAThread], and a real CI run hung for 18+ minutes with zero output
// making a COM call from MTA (cross-apartment proxy setup can genuinely
// hang rather than throw) — the first run where COM wasn't rejected
// outright by AOT/trim and the call was actually attempted for real.
internal static class Program
{
    [STAThread]
    private static void Main()
    {
        var result = new SpikeResult { Variant = "FlaUI" };
        Process? notepad = null;

        try
        {
            notepad = Process.Start("notepad.exe");
            if (notepad is null)
            {
                throw new InvalidOperationException("Process.Start returned null for notepad.exe.");
            }

            using var automation = new UIA3Automation();
            var app = Application.Attach(notepad);
            var window = app.GetMainWindow(automation, TimeSpan.FromSeconds(10));
            if (window is null)
            {
                throw new TimeoutException("Notepad's main window did not appear within 10s.");
            }

            var editElement = window.FindFirstDescendant(cf => cf.ByControlType(ControlType.Edit));
            if (editElement is null)
            {
                throw new InvalidOperationException("Could not find an Edit control in Notepad's window.");
            }

            // Reading via FlaUI's pattern-access API instead of the typed
            // wrapper (editElement.AsTextBox()) — a real CS1061 compiler
            // error showed that method isn't resolvable against these
            // usings/this package version. Patterns is a member of
            // AutomationElement itself (FlaUI.Core), not an extension
            // method living in some other namespace, so this is a more
            // robust choice than guessing a different wrapper method name
            // — but it's still unverified against a real compiler. If
            // PatternOrDefault or the nested .Value shape is wrong, fix
            // from the next real error.
            var valuePattern = editElement.Patterns.Value.PatternOrDefault;
            if (valuePattern is null)
            {
                throw new InvalidOperationException("Edit element does not support the UIA Value pattern.");
            }
            var value = valuePattern.Value.Value;

            result.UiaReadSucceeded = true;
            result.Value = value;
        }
        catch (Exception ex)
        {
            result.UiaReadSucceeded = false;
            result.Error = ex.ToString();
        }
        finally
        {
            if (notepad is not null)
            {
                try
                {
                    notepad.Kill();
                    notepad.WaitForExit(5000);
                }
                catch
                {
                    // Best-effort cleanup — don't let a failed kill mask the real result.
                }
            }
        }

        Console.WriteLine(JsonSerializer.Serialize(result, SpikeResultJsonContext.Default.SpikeResult));
    }
}

internal sealed class SpikeResult
{
    public string Variant { get; set; } = "";
    public bool UiaReadSucceeded { get; set; }
    public string? Value { get; set; }
    public string? Error { get; set; }
}

// Source-generated (not reflection-based) JSON serialization — see the
// identical note in the CsWin32 variant's Program.cs: this removes an
// AOT-safety warning about result reporting that's unrelated to the actual
// question this spike asks (does the UIA COM read work under AOT).
[JsonSerializable(typeof(SpikeResult))]
internal partial class SpikeResultJsonContext : JsonSerializerContext
{
}
