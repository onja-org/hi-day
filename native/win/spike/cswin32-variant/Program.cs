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
using Windows.Win32.UI.Accessibility;

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
        names.Add(current.CurrentName ?? "(no name)");
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

Console.WriteLine(JsonSerializer.Serialize(result));

internal sealed class SpikeResult
{
    public string Variant { get; set; } = "";
    public bool UiaReadSucceeded { get; set; }
    public string? Value { get; set; }
    public string? Error { get; set; }
}
