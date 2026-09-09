namespace WinResolver.Core;

/// <summary>
/// The generic per-browser-strategy fallback per Step 15 of the plan:
/// "first Edit descendant that does not have keyboard focus and whose
/// value normalizes to a valid host." Deliberately conservative — a search
/// query typed into the same address bar control must NOT normalize to
/// something that looks like a host, or every half-typed search becomes a
/// false-positive URL.
/// </summary>
public static class HostValidator
{
    public static string? TryNormalizeToHost(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return null;
        }

        var trimmed = candidate.Trim();

        // A literal space is a strong signal this is a typed search query,
        // not a URL/host — real URLs encode spaces, they don't contain a
        // literal one.
        if (trimmed.Contains(' '))
        {
            return null;
        }

        var withScheme = trimmed.Contains("://", StringComparison.Ordinal) ? trimmed : $"https://{trimmed}";

        if (!Uri.TryCreate(withScheme, UriKind.Absolute, out var uri))
        {
            return null;
        }

        var host = uri.Host;
        if (string.IsNullOrEmpty(host))
        {
            return null;
        }

        var hostType = Uri.CheckHostName(host);
        if (hostType is UriHostNameType.IPv4 or UriHostNameType.IPv6)
        {
            return host;
        }

        // Uri.CheckHostName classifies any syntactically legal single-label
        // name (e.g. "settings", "localhost") as Dns too, not just real
        // multi-label domains — an explicit dot is required here so a
        // single typed word doesn't pass as "a valid host". This means a
        // bare "localhost" is deliberately NOT treated as a host by this
        // generic fallback; per-browser-specific strategies are the
        // primary path, and this conservative-by-design fallback exists to
        // avoid false positives from search queries, not to catch every
        // possible valid target.
        return hostType == UriHostNameType.Dns && host.Contains('.') ? host : null;
    }
}
