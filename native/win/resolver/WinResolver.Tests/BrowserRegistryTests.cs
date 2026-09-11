using WinResolver.Core;
using Xunit;

namespace WinResolver.Tests;

public class BrowserRegistryTests
{
    // A trimmed-down fixture mirroring the real registry's shape exactly —
    // not the live file, so this test doesn't churn every time a browser
    // is added to the real registry. Real-content parity is exercised by
    // whatever loads the actual file at runtime; this proves the parser.
    private const string FixtureJson = """
    {
      "chrome": {
        "match": { "darwin": "com.google.Chrome", "win32": "chrome.exe", "linux": "google-chrome" },
        "family": "chromium",
        "strategy": { "win32": "uia-omnibox" },
        "privateDetect": "chromium-window-mode"
      },
      "firefox": {
        "match": { "win32": "firefox.exe" },
        "family": "gecko",
        "strategy": { "win32": "uia-omnibox" },
        "privateDetect": "firefox-title-marker"
      },
      "arc": {
        "match": { "darwin": "company.thebrowser.Browser" },
        "family": "chromium",
        "strategy": { "darwin": "apple-events" },
        "privateDetect": "chromium-window-mode"
      },
      "chromium-generic": {
        "family": "chromium",
        "strategy": { "win32": "uia-omnibox" },
        "privateDetect": "chromium-window-mode"
      }
    }
    """;

    [Fact]
    public void ParsesEveryEntryWithItsWin32ProcessNameFamilyAndPrivateDetect()
    {
        var entries = BrowserRegistry.Parse(FixtureJson);

        var chrome = entries.Single(e => e.Id == "chrome");
        Assert.Equal("chrome.exe", chrome.Win32ProcessName);
        Assert.Equal("chromium", chrome.Family);
        Assert.Equal("chromium-window-mode", chrome.PrivateDetect);
    }

    [Fact]
    public void ParsesAnEntryWithNoWin32MatchAsNull()
    {
        var entries = BrowserRegistry.Parse(FixtureJson);

        var arc = entries.Single(e => e.Id == "arc");
        Assert.Null(arc.Win32ProcessName);
    }

    [Fact]
    public void FindsTheExactMatchingEntryByProcessName()
    {
        var entries = BrowserRegistry.Parse(FixtureJson);

        var found = BrowserRegistry.FindByProcessName(entries, "firefox.exe");

        Assert.Equal("firefox", found.Id);
    }

    [Fact]
    public void MatchIsExactStringEqualityNotCaseInsensitive()
    {
        // Mirrors lookupBrowser's `===` comparison on the TypeScript side —
        // a deliberate parity choice, not an oversight.
        var entries = BrowserRegistry.Parse(FixtureJson);

        var found = BrowserRegistry.FindByProcessName(entries, "Chrome.EXE");

        Assert.Equal("chromium-generic", found.Id);
    }

    [Fact]
    public void FallsBackToChromiumGenericForAnUnknownProcessName()
    {
        var entries = BrowserRegistry.Parse(FixtureJson);

        var found = BrowserRegistry.FindByProcessName(entries, "some-new-browser.exe");

        Assert.Equal("chromium-generic", found.Id);
    }

    [Fact]
    public void ThrowsIfTheRegistryIsMissingItsRequiredFallbackEntry()
    {
        const string json = """{ "chrome": { "match": {"win32":"chrome.exe"}, "family": "chromium", "strategy": {}, "privateDetect": "none" } }""";
        var entries = BrowserRegistry.Parse(json);

        Assert.Throws<InvalidDataException>(() => BrowserRegistry.FindByProcessName(entries, "unknown.exe"));
    }
}
