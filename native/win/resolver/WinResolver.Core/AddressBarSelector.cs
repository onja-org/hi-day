namespace WinResolver.Core;

/// <summary>
/// One UIA element as seen through a single cache-request round trip —
/// value, keyboard-focus state, and control type together, mirroring the
/// three properties Step 14 requires fetching in one cross-process call
/// rather than three.
/// </summary>
public sealed record AddressBarCandidate(string? Value, bool HasKeyboardFocus, bool IsEdit);

/// <summary>
/// Pure selection logic over an already-fetched list of toolbar-subtree
/// candidates — kept separate from the actual UIA tree walk (which can
/// only run on real Windows) so the decision logic itself is fully
/// testable. Implements the generic fallback from Step 15: "first Edit
/// descendant that does not have keyboard focus and whose value
/// normalizes to a valid host."
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

            // "This one check eliminates most half-typed-search-query
            // garbage" — Step 14. The user is actively typing into this
            // field; whatever it currently holds is not a navigated URL.
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
