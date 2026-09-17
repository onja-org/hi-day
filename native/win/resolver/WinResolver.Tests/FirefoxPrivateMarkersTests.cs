using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class FirefoxPrivateMarkersTests
{
    private const string FixtureJson = """
    {
      "markers": ["(Private Browsing)", "(Navigation privée)"]
    }
    """;

    [Fact]
    public void ParsesTheMarkersArray()
    {
        var markers = FirefoxPrivateMarkers.Parse(FixtureJson);

        Assert.Equal(new[] { "(Private Browsing)", "(Navigation privée)" }, markers);
    }

    [Fact]
    public void DetectsAKnownMarkerAnywhereInTheTitle()
    {
        var markers = FirefoxPrivateMarkers.Parse(FixtureJson);

        Assert.True(FirefoxPrivateMarkers.TitleIndicatesPrivate("Mozilla Firefox (Private Browsing)", markers));
    }

    [Fact]
    public void DetectsALocalizedMarker()
    {
        var markers = FirefoxPrivateMarkers.Parse(FixtureJson);

        Assert.True(FirefoxPrivateMarkers.TitleIndicatesPrivate("Exemple — Mozilla Firefox (Navigation privée)", markers));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Example — Mozilla Firefox")]
    public void ReturnsFalseWhenNoMarkerIsPresent(string? title)
    {
        var markers = FirefoxPrivateMarkers.Parse(FixtureJson);

        Assert.False(FirefoxPrivateMarkers.TitleIndicatesPrivate(title, markers));
    }
}
