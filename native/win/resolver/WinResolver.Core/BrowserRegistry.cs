using System.Text.Json;

namespace WinResolver.Core;

/// <summary>
/// Reads the SAME browser-registry.json the Electron/TypeScript side reads
/// (desktop/src/main/url-capture/browser-registry.json) — linked into this
/// project via a relative-path file reference (see WinResolver.csproj), not
/// duplicated, so there is exactly one place to add a browser or fix a
/// selector strategy. Mirrors browser-registry.ts's lookupBrowser exactly:
/// exact-string match against match.win32, fall back to "chromium-generic"
/// (never throws — an unknown/new browser degrades to the generic
/// strategy rather than disabling capture).
/// </summary>
public sealed record BrowserRegistryEntry(
    string Id,
    string? Win32ProcessName,
    string Family,
    string PrivateDetect);

public static class BrowserRegistry
{
    private const string ChromiumGenericId = "chromium-generic";

    public static IReadOnlyList<BrowserRegistryEntry> Load(string path)
    {
        return Parse(File.ReadAllText(path));
    }

    public static IReadOnlyList<BrowserRegistryEntry> Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException("Browser registry is not a JSON object.");
        }

        var entries = new List<BrowserRegistryEntry>();
        foreach (var property in document.RootElement.EnumerateObject())
        {
            entries.Add(ParseEntry(property.Name, property.Value));
        }

        return entries;
    }

    private static BrowserRegistryEntry ParseEntry(string id, JsonElement value)
    {
        string? win32ProcessName = null;
        if (value.TryGetProperty("match", out var match) &&
            match.ValueKind == JsonValueKind.Object &&
            match.TryGetProperty("win32", out var win32) &&
            win32.ValueKind == JsonValueKind.String)
        {
            win32ProcessName = win32.GetString();
        }

        var family = value.TryGetProperty("family", out var familyEl) && familyEl.ValueKind == JsonValueKind.String
            ? familyEl.GetString() ?? ""
            : "";

        var privateDetect = value.TryGetProperty("privateDetect", out var pd) && pd.ValueKind == JsonValueKind.String
            ? pd.GetString() ?? "none"
            : "none";

        return new BrowserRegistryEntry(id, win32ProcessName, family, privateDetect);
    }

    /// <summary>
    /// Exact-string match against match.win32 — deliberately NOT
    /// case-insensitive, to mirror lookupBrowser's `===` comparison on the
    /// TypeScript side exactly rather than introduce a platform-specific
    /// behavior difference.
    /// </summary>
    public static BrowserRegistryEntry FindByProcessName(IReadOnlyList<BrowserRegistryEntry> entries, string processName)
    {
        foreach (var entry in entries)
        {
            if (entry.Win32ProcessName == processName)
            {
                return entry;
            }
        }

        var fallback = entries.FirstOrDefault(e => e.Id == ChromiumGenericId);
        if (fallback is null)
        {
            throw new InvalidDataException($"Browser registry is missing its required \"{ChromiumGenericId}\" fallback entry.");
        }

        return fallback;
    }
}
