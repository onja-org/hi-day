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
        // normalization pipeline every platform feeds into already says so
        // explicitly — see validateHost in
        // url-capture/normalization/host-validation.ts, which accepts
        // `parsed.hostname === 'localhost'` alongside public suffixes and
        // IP literals. The Linux resolver does no host filtering of its
        // own and relies entirely on that rule, so excluding localhost
        // here made Windows quietly stricter than Linux for the one host
        // developers visit all day.
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase))
        {
            return host;
        }

        // Otherwise a dot is still required. Uri.CheckHostName classifies
        // any syntactically legal single-label name ("settings", a
        // half-typed search) as Dns too, and this conservative fallback
        // exists to keep those out — localhost is carved out by name
        // above precisely so the general rule can stay strict.
        return host.Contains('.') ? host : null;
    }
}
