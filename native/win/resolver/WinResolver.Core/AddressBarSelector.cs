namespace WinResolver.Core;

/// <summary>One UIA element: its value, keyboard-focus state and control type.</summary>
public sealed record AddressBarCandidate(string? Value, bool HasKeyboardFocus, bool IsEdit);

/// <summary>
/// Pure selection over already-fetched candidates, kept separate from the UIA
/// walk so it is testable off Windows. Step 15's generic fallback: first Edit
/// without keyboard focus whose value normalizes to a valid host.
/// </summary>
public static class AddressBarSelector
{
    public static string? SelectGenericFallback(IEnumerable<AddressBarCandidate> candidates)
    {
        foreach (var candidate in candidates)
        {
            if (!candidate.IsEdit)
            {
                continue;
            }

            // Eliminates most half-typed-search garbage: the user is typing,
            // so whatever this holds is not a navigated URL.
            if (candidate.HasKeyboardFocus)
            {
                continue;
            }

            if (HostValidator.TryNormalizeToHost(candidate.Value) is not null)
            {
                return candidate.Value?.Trim();
            }
        }

        return null;
    }
}
