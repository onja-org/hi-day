using System.Text.Json;
using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

/// <summary>
/// Confirms the wire JSON shape matches protocol.ts field-for-field — the
/// property casing/names are pinned, and a C# reflection-based serializer
/// silently defaulting to PascalCase (instead of respecting
/// [JsonPropertyName]) would be a real, easy-to-miss regression.
/// </summary>
public class ProtocolSerializationTests
{
    private static JsonElement SerializeToElement(object value)
    {
        var json = JsonSerializer.Serialize(value, value.GetType());
        return JsonDocument.Parse(json).RootElement;
    }

    [Fact]
    public void PingOkResponseMatchesWireShape()
    {
        var element = SerializeToElement(new PingOkResponse(7));

        Assert.Equal(7, element.GetProperty("id").GetInt32());
        Assert.True(element.GetProperty("ok").GetBoolean());
    }

    [Fact]
    public void ErrorResponseMatchesWireShape()
    {
        var element = SerializeToElement(new ErrorResponse(9, "something failed"));

        Assert.Equal(9, element.GetProperty("id").GetInt32());
        Assert.False(element.GetProperty("ok").GetBoolean());
        Assert.Equal("something failed", element.GetProperty("message").GetString());
    }

    [Fact]
    public void ResolveOkResponseMatchesWireShape()
    {
        var element = SerializeToElement(
            new ResolveOkResponse(1, "example.com", "Example", "chrome", false, "uia", "displayed", 12));

        Assert.Equal(1, element.GetProperty("id").GetInt32());
        Assert.True(element.GetProperty("ok").GetBoolean());
        Assert.Equal("example.com", element.GetProperty("url").GetString());
        Assert.Equal("Example", element.GetProperty("title").GetString());
        Assert.Equal("chrome", element.GetProperty("browser").GetString());
        Assert.False(element.GetProperty("private").GetBoolean());
        Assert.Equal("uia", element.GetProperty("source").GetString());
        Assert.Equal("displayed", element.GetProperty("confidence").GetString());
        Assert.Equal(12, element.GetProperty("ms").GetInt64());
    }

    [Fact]
    public void ResolveOkResponseAllowsNullPrivate()
    {
        // private: null is a deliberate, distinct wire value (e.g. Safari,
        // where private-mode detection is not possible) — never coerced to
        // false, which would falsely claim "definitely not private".
        var element = SerializeToElement(
            new ResolveOkResponse(1, "example.com", "Example", "safari", null, "uia", "displayed", 12));

        Assert.Equal(JsonValueKind.Null, element.GetProperty("private").ValueKind);
    }

    [Fact]
    public void FocusEventMatchesWireShape()
    {
        var element = SerializeToElement(new FocusEvent(111, 222, "chrome.exe", "Example — Google Chrome", 1000));

        Assert.Equal("focus", element.GetProperty("ev").GetString());
        Assert.Equal(111, element.GetProperty("pid").GetInt32());
        Assert.Equal(222, element.GetProperty("hwnd").GetInt64());
        Assert.Equal("chrome.exe", element.GetProperty("app").GetString());
        Assert.Equal("Example — Google Chrome", element.GetProperty("title").GetString());
        Assert.Equal(1000, element.GetProperty("ts").GetInt64());
    }

    [Fact]
    public void ReadyEventMatchesWireShapeAndAdvertisesOnlyFocusCapability()
    {
        var element = SerializeToElement(new ReadyEvent("win32", new[] { "focus" }));

        Assert.Equal("ready", element.GetProperty("ev").GetString());
        Assert.Equal("win32", element.GetProperty("platform").GetString());
        var caps = element.GetProperty("caps").EnumerateArray().Select(e => e.GetString()).ToArray();
        Assert.Equal(new[] { "focus" }, caps);
    }

    [Fact]
    public void ErrorEventMatchesWireShape()
    {
        var element = SerializeToElement(new ErrorEvent("some-code", "some detail"));

        Assert.Equal("error", element.GetProperty("ev").GetString());
        Assert.Equal("some-code", element.GetProperty("code").GetString());
        Assert.Equal("some detail", element.GetProperty("detail").GetString());
    }
}
