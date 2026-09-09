using System.Text.Json;

namespace WinResolver.Core;

/// <summary>
/// Reads the SAME per-locale Firefox private-window title marker table the
/// darwin resolver uses (resolvers/darwin/firefox-private-markers.json) —
/// linked in via a relative-path file reference, not duplicated. Firefox's
/// title-marker behavior is a Firefox property, not a macOS-vs-Windows one,
/// so the same table applies on both platforms.
/// </summary>
public static class FirefoxPrivateMarkers
{
    public static IReadOnlyList<string> Load(string path)
    {
        return Parse(File.ReadAllText(path));
    }

    public static IReadOnlyList<string> Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!document.RootElement.TryGetProperty("markers", out var markers) ||
            markers.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException("Firefox private-markers file has no \"markers\" array.");
        }

        var result = new List<string>();
        foreach (var marker in markers.EnumerateArray())
        {
            if (marker.ValueKind == JsonValueKind.String)
            {
                var text = marker.GetString();
                if (!string.IsNullOrEmpty(text))
                {
                    result.Add(text);
                }
            }
        }

        return result;
    }

    /// <summary>
    /// True when the window title carries any known locale's private-window
    /// marker — this is Firefox's only private-mode signal on Windows (it
    /// has no UIA-exposed incognito indicator the way Chromium does), same
    /// as on macOS.
    /// </summary>
    public static bool TitleIndicatesPrivate(string? title, IReadOnlyList<string> markers)
    {
        if (string.IsNullOrEmpty(title))
        {
            return false;
        }

        foreach (var marker in markers)
        {
            if (title.Contains(marker, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }
}
