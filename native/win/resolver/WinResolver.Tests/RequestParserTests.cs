using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class RequestParserTests
{
    [Fact]
    public void ParsesAPingRequest()
    {
        var request = RequestParser.Parse("""{"id":1,"op":"ping"}""");

        var ping = Assert.IsType<PingRequest>(request);
        Assert.Equal(1, ping.Id);
    }

    [Fact]
    public void ParsesAResolveRequest()
    {
        var request = RequestParser.Parse("""{"id":2,"op":"resolve","pid":1234,"hwnd":5678}""");

        var resolve = Assert.IsType<ResolveRequest>(request);
        Assert.Equal(2, resolve.Id);
        Assert.Equal(1234, resolve.Pid);
        Assert.Equal(5678, resolve.Hwnd);
    }

    [Fact]
    public void ParsesALargeHwndThatDoesNotFitInAnInt32()
    {
        // Real HWND values on x64 are handle-table indices and stay well
        // under 2^32 in practice, but the wire type is a plain JSON number
        // with no declared bit width — hwnd is read as Int64 specifically
        // so a value that happens to exceed Int32 range is not silently
        // truncated or rejected.
        var request = RequestParser.Parse("""{"id":3,"op":"resolve","pid":1,"hwnd":9876543210}""");

        var resolve = Assert.IsType<ResolveRequest>(request);
        Assert.Equal(9876543210L, resolve.Hwnd);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("null")]
    [InlineData("42")]
    [InlineData("[]")]
    [InlineData("""{"op":"ping"}""")] // missing id
    [InlineData("""{"id":"1","op":"ping"}""")] // id is a string, not a number
    [InlineData("""{"id":1}""")] // missing op
    [InlineData("""{"id":1,"op":"unknown-op"}""")]
    [InlineData("""{"id":1,"op":"resolve","pid":1}""")] // missing hwnd
    [InlineData("""{"id":1,"op":"resolve","hwnd":1}""")] // missing pid
    [InlineData("""{"id":1,"op":"resolve","pid":"1","hwnd":1}""")] // pid is a string
    public void DropsMalformedOrIncompleteLinesWithoutThrowing(string line)
    {
        var request = RequestParser.Parse(line);

        Assert.Null(request);
    }
}
