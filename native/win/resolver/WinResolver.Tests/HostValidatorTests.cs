using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class HostValidatorTests
{
    [Theory]
    [InlineData("example.com", "example.com")]
    [InlineData("https://example.com", "example.com")]
    [InlineData("https://example.com/a/b?c=d", "example.com")]
    [InlineData("sub.example.co.uk/path", "sub.example.co.uk")]
    [InlineData("192.168.1.1", "192.168.1.1")]
    [InlineData("  example.com  ", "example.com")] // surrounding whitespace trimmed
    public void NormalizesRealAddressesToTheirHost(string candidate, string expectedHost)
    {
        Assert.Equal(expectedHost, HostValidator.TryNormalizeToHost(candidate));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("how do I center a div")] // a search query — contains spaces
    [InlineData("settings")] // single-label, no dot — too ambiguous to trust
    [InlineData("localhost")] // deliberately excluded — see HostValidator's comment
    [InlineData("not a url at all")]
    public void RejectsSearchQueriesAndAmbiguousSingleWords(string? candidate)
    {
        Assert.Null(HostValidator.TryNormalizeToHost(candidate));
    }
}
