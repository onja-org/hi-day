// A standalone data-collection tool — hand a colleague this published .exe
// with nothing else to install, and it captures real, raw address-bar
// strings from whichever supported browser is in the foreground, once
// every 2 seconds, into a local JSONL file. This is what Stage E's
// normalization pipeline needs real fixtures from — we are not inventing
// those strings (see docs/url-tracking-plan.md Step 21).
//
// NEVER RUN OR VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine
// available. Uses FlaUI (not the library C.0 may end up recommending for
// the real resolver) because this tool never gets published via NativeAOT —
// it's run manually, cold-start time doesn't matter, and FlaUI's higher
// -level API is simply less code to get right blind.
//
// PRIVACY: the output file will contain real URLs from whatever you browse
// while this runs. Only run it on your own machine, with browsers you're
// genuinely fine capturing from, and don't commit or share the output file
// without checking its contents first.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;

var knownBrowsers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    // Matches process names (no .exe) from desktop/src/main/url-capture/browser-registry.json —
    // deliberately hardcoded and short, not the real registry. This is a
    // throwaway collection tool, not the production resolver.
    "chrome", "msedge", "firefox", "brave", "opera", "vivaldi",
};

var outputPath = args.Length > 0 ? args[0] : "fixtures.jsonl";

Console.WriteLine("=== URL tracking fixture capture ===");
Console.WriteLine("Reads the address bar of whichever supported browser is in the foreground");
Console.WriteLine("and appends the raw string to a local file, once every 2 seconds.");
Console.WriteLine();
Console.WriteLine($"Output file: {Path.GetFullPath(outputPath)}");
Console.WriteLine("This file WILL contain real URLs you visit while this is running.");
Console.WriteLine("Only run this on your own machine, with browsers you're fine capturing from.");
Console.WriteLine("Do not commit this file or share it without checking its contents first.");
Console.WriteLine();
Console.WriteLine("Press Ctrl+C to stop.");
Console.WriteLine();

using var automation = new UIA3Automation();
string? lastCaptured = null;

while (true)
{
    try
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        if (hwnd != IntPtr.Zero)
        {
            NativeMethods.GetWindowThreadProcessId(hwnd, out var pid);
            using var process = Process.GetProcessById((int)pid);
            var processName = process.ProcessName;

            if (knownBrowsers.Contains(processName))
            {
                var window = automation.FromHandle(hwnd);
                var editElement = window?.FindFirstDescendant(cf => cf.ByControlType(ControlType.Edit));
                var raw = editElement?.AsTextBox()?.Text;

                if (!string.IsNullOrWhiteSpace(raw) && raw != lastCaptured)
                {
                    lastCaptured = raw;
                    var record = new
                    {
                        browser = processName,
                        capturedAt = DateTimeOffset.UtcNow.ToString("O"),
                        raw,
                    };
                    File.AppendAllText(outputPath, JsonSerializer.Serialize(record) + Environment.NewLine);
                    Console.WriteLine($"[{processName}] captured: {raw}");
                }
            }
        }
    }
    catch (Exception ex)
    {
        // Best-effort: a transient failure (window closed mid-read, an
        // elevated process we can't inspect, etc.) should never crash the
        // loop — skip this tick and try again.
        Console.Error.WriteLine($"skip: {ex.Message}");
    }

    Thread.Sleep(2000);
}

internal static class NativeMethods
{
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    internal static extern IntPtr GetForegroundWindow();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    internal static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
