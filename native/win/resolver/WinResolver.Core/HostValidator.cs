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

        if (hostType != UriHostNameType.Dns)
        {
            return null;
        }

        // localhost is a real target, not an ambiguous word. The shared
        // pipeline every platform feeds into already accepts it — see
        // validateHost in url-capture/normalization/host-validation.ts — and
        // Linux relies on that rule alone, so excluding it here made Windows
        // stricter than Linux.
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase))
        {
            return host;
        }

        // Otherwise a dot is required: CheckHostName treats any legal
        // single-label name ("settings", a half-typed search) as Dns too.
        return host.Contains('.') ? host : null;
    }
}
