// Throwaway spike (Prompt C.0) — do not integrate this into the real
// resolver. Tests whether CsWin32's source-generated (static) COM interop
// for UI Automation compiles AND actually works at runtime under NativeAOT
// publish. No browser needed — walks the desktop root's first few child
// elements via IUIAutomationTreeWalker and reads their Name property,
// exercising the same COM-call path (source-generated interop hitting a
// real out-of-process COM server) a real address-bar read would use.
//
// NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine, no
// dotnet SDK, and NativeAOT can't cross-compile from Linux anyway. This is
// a best-effort reconstruction of CsWin32's generated API shape from the
// well-documented IUIAutomation/IUIAutomationTreeWalker COM interfaces —
// exact generated names/signatures are unverified. If it fails to compile,
// that's expected — fix from the real compiler error, don't guess further
// blind. `new CUIAutomation()` in particular may need to become an explicit
// activation call instead, depending on how CsWin32 projects the coclass.

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using Windows.Win32.UI.Accessibility;

// Explicit Main with [STAThread] instead of top-level statements: UI
// Automation client calls (the whole point of this program) require an
// STA thread — Microsoft's own docs state this. Top-level statements
// compile to an MTA Main by default with no supported way to attach
// [STAThread], and a real CI run of the FlaUI variant (identical COM
// subsystem, same requirement) hung for 18+ minutes with zero output
// making a COM call from MTA (cross-apartment proxy setup can genuinely
// hang rather than throw) — the first run where COM wasn't rejected
// outright by AOT/trim and the call was actually attempted for real.
internal static class Program
{
    [STAThread]
    private static void Main()
    {
        var result = new SpikeResult { Variant = "CsWin32" };

        try
        {
            var automation = (IUIAutomation)new CUIAutomation();

            var root = automation.GetRootElement();
            if (root is null)
            {
                throw new InvalidOperationException("GetRootElement() returned null.");
            }

            var walker = automation.RawViewWalker;
            if (walker is null)
            {
                throw new InvalidOperationException("RawViewWalker was null.");
            }

            var names = new List<string>();
            var current = walker.GetFirstChildElement(root);
            var count = 0;
            while (current is not null && count < 5)
            {
                // current.CurrentName is a CsWin32-generated BSTR, not a C#
                // string — CsWin32's static/source-generated interop exposes
                // the raw COM type rather than auto-marshalling it the way
                // classic dynamic COM interop did. Confirmed via a real
                // CS0019 compiler error (`??` cannot apply to BSTR and
                // string), not guessed in advance.
                var name = current.CurrentName.ToString();
                names.Add(string.IsNullOrEmpty(name) ? "(no name)" : name);
                current = walker.GetNextSiblingElement(current);
                count++;
            }

            if (names.Count == 0)
            {
                throw new InvalidOperationException("Desktop root had no child elements to read.");
            }

            result.UiaReadSucceeded = true;
            result.Value = string.Join(" | ", names);
        }
        catch (Exception ex)
        {
            result.UiaReadSucceeded = false;
            result.Error = ex.ToString();
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

// Source-generated (not reflection-based) JSON serialization — the generic
// JsonSerializer.Serialize<T> overload triggers an IL3050 AOT-safety warning
// because the trimmer can't prove it won't need reflection metadata that got
// trimmed away. Using a JsonSerializerContext sidesteps that: it removes any
// doubt about whether a *result-reporting* warning is contaminating the
// actual question this spike asks (does the UIA COM read work under AOT).
[JsonSerializable(typeof(SpikeResult))]
internal partial class SpikeResultJsonContext : JsonSerializerContext
{
}
