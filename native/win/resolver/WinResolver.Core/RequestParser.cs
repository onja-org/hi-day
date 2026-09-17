using System.Text.Json;

namespace WinResolver.Core;

/// <summary>
/// Parses and fully validates one incoming protocol line — mirrors
/// desktop/src/main/resolvers/darwin/index.ts's parseRequestLine exactly:
/// not just "is this JSON with an op field" but the precise shape a
/// ResolverRequest needs. A malformed line must never throw — it is
/// dropped and logged by the caller, never a crash, since a hostile or
/// buggy line from a side-car's own stdin is not something the protocol
/// loop can treat as fatal.
/// </summary>
public static class RequestParser
{
    public static ResolverRequest? Parse(string line)
    {
        JsonElement root;
        try
        {
            using var document = JsonDocument.Parse(line);
            root = document.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }

        if (root.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!root.TryGetProperty("id", out var idElement) || idElement.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        if (!idElement.TryGetInt32(out var id))
        {
            return null;
        }

        if (!root.TryGetProperty("op", out var opElement) || opElement.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return opElement.GetString() switch
        {
            "ping" => new PingRequest(id),
            "resolve" => TryParseResolve(root, id),
            _ => null,
        };
    }

    private static ResolverRequest? TryParseResolve(JsonElement root, int id)
    {
        if (!root.TryGetProperty("pid", out var pidElement) || pidElement.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        if (!root.TryGetProperty("hwnd", out var hwndElement) || hwndElement.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        if (!pidElement.TryGetInt32(out var pid) || !hwndElement.TryGetInt64(out var hwnd))
        {
            return null;
        }

        return new ResolveRequest(id, pid, hwnd);
    }
}
