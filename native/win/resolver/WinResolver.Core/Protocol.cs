using System.Text.Json.Serialization;

namespace WinResolver.Core;

/// <summary>
/// Mirrors desktop/src/main/url-capture/protocol.ts exactly — the wire
/// protocol is pinned there. Do not add, rename, or remove a field here
/// without updating protocol.ts and every other side-car (mac-resolver,
/// linux-resolver) in lockstep. The output assembly for this side-car is
/// named win-resolver.exe per protocol.ts's own file header comment.
/// </summary>
public abstract record ResolverRequest(int Id);

public sealed record PingRequest(int Id) : ResolverRequest(Id);

public sealed record ResolveRequest(int Id, int Pid, long Hwnd) : ResolverRequest(Id);

public sealed record PingOkResponse(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("ok")] bool Ok = true);

public sealed record ErrorResponse(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("message")] string Message)
{
    public ErrorResponse(int id, string message) : this(id, false, message)
    {
    }
}

public sealed record ResolveOkResponse(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("browser")] string Browser,
    [property: JsonPropertyName("private")] bool? Private,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("confidence")] string Confidence,
    [property: JsonPropertyName("ms")] long Ms)
{
    public ResolveOkResponse(
        int id, string url, string title, string browser, bool? isPrivate,
        string source, string confidence, long ms)
        : this(id, true, url, title, browser, isPrivate, source, confidence, ms)
    {
    }
}

public sealed record FocusEvent(
    [property: JsonPropertyName("ev")] string Ev,
    [property: JsonPropertyName("pid")] int Pid,
    [property: JsonPropertyName("hwnd")] long Hwnd,
    [property: JsonPropertyName("app")] string App,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("ts")] long Ts)
{
    public FocusEvent(int pid, long hwnd, string app, string title, long ts)
        : this("focus", pid, hwnd, app, title, ts)
    {
    }
}

public sealed record ReadyEvent(
    [property: JsonPropertyName("ev")] string Ev,
    [property: JsonPropertyName("platform")] string Platform,
    [property: JsonPropertyName("caps")] string[] Caps)
{
    public ReadyEvent(string platform, string[] caps) : this("ready", platform, caps)
    {
    }
}

public sealed record ErrorEvent(
    [property: JsonPropertyName("ev")] string Ev,
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("detail")] string Detail)
{
    public ErrorEvent(string code, string detail) : this("error", code, detail)
    {
    }
}
