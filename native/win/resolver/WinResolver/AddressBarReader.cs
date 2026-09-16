using FlaUI.Core;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;
using WinResolver.Core;

namespace WinResolver;

public sealed record AddressBarReadResult(string Value, bool? IsPrivate);

/// <summary>
/// The actual UIA tree walk and address-bar read — Steps 14/15 of the
/// plan. Every call here MUST run on UiaWorker's dedicated MTA thread;
/// this class has no threading logic of its own and trusts its caller.
///
/// NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine
/// available. Two areas here carry meaningfully higher risk than the rest
/// of this project's native code:
///
///  1. RESOLVED. A CacheRequest here was the single biggest risk, exactly
///     as predicted: it did not compile (7515cf5), and once it did, every
///     browser read threw while non-browser windows resolved fine. It has
///     been removed — see CollectToolbarCandidates. The prediction was
///     right; the mitigation was to stop using the API, not to get it
///     right blind.
///  2. IncognitoIndicatorAutomationId below is a GUESS, not a confirmed
///     value — see that constant's own comment. A wrong guess here fails
///     SILENTLY (an incognito window just never gets detected as
///     private), which is the worse failure direction given
///     session-engine.ts strips url/host/path only when private===true —
///     confirming this against a real incognito Chrome window is a
///     must-do before relying on Chromium private-mode detection, not a
///     nice-to-have.
/// </summary>
public sealed class AddressBarReader : IDisposable
{
    // GUESS, UNVERIFIED: Chromium's toolbar avatar/incognito-indicator
    // button's AutomationId on Windows. Confirm the real value using
    // Microsoft's free "Accessibility Insights for Windows" tool against
    // an actual incognito Chrome/Edge/Brave window's toolbar before
    // trusting this in production — do not assume this string is correct.
    private const string IncognitoIndicatorAutomationId = "IncognitoAvatarButton";

    private readonly UIA3Automation _automation = new();

    /// <summary>
    /// Every toolbar candidate collected by the most recent Read() call,
    /// regardless of whether it succeeded — populated for
    /// --capture-fixtures (Step 14's fixture-building requirement), which
    /// needs every raw candidate string seen, not just the one that won.
    /// </summary>
    public IReadOnlyList<AddressBarCandidate> LastCandidates { get; private set; } = Array.Empty<AddressBarCandidate>();

    public AddressBarReadResult Read(FocusTarget focus, BrowserRegistryEntry entry, IReadOnlyList<string> firefoxPrivateMarkers)
    {
        var window = _automation.FromHandle(new IntPtr(focus.Hwnd));
        if (window is null)
        {
            LastCandidates = Array.Empty<AddressBarCandidate>();

            // Instrumented separately from the two searches below: this
            // path returns before any tree walk, so a browser failing here
            // produces a no-address-bar in the log and NOTHING from the
            // probe — which is exactly how Firefox first presented, and
            // read as "the probe is not running" rather than "the window
            // could not be attached to".
            if (Environment.GetEnvironmentVariable("WINRESOLVER_DIAGNOSE_TREE") == "1")
            {
                Console.Error.WriteLine(
                    $"[tree] {focus.App} stage=window-null hwnd={focus.Hwnd} pid={focus.Pid} " +
                    "— UIA could not attach to this handle at all");
            }

            throw new ResolveFailureException(new ResolveFailure(
                ResolveErrorCode.NoAddressBar, "Could not attach to the focused window via UIA."));
        }

        var candidates = CollectToolbarCandidates(window);
        LastCandidates = candidates;
        if (candidates.Count == 0)
        {
            DiagnoseTree(window, focus, candidates, "no-toolbar-edits");
            throw new ResolveFailureException(new ResolveFailure(
                ResolveErrorCode.NoAddressBar, "No toolbar Edit elements found in the focused window."));
        }

        var anyEditHasFocus = candidates.Any(c => c.IsEdit && c.HasKeyboardFocus);
        var value = AddressBarSelector.SelectGenericFallback(candidates);
        if (value is null)
        {
            if (!anyEditHasFocus)
            {
                DiagnoseTree(window, focus, candidates, "no-valid-host");
            }

            throw new ResolveFailureException(anyEditHasFocus
                ? new ResolveFailure(ResolveErrorCode.AddressBarFocused,
                    "The address bar has keyboard focus; the user appears to be typing.")
                : new ResolveFailure(ResolveErrorCode.NoAddressBar,
                    "No Edit element's value normalized to a valid host."));
        }

        bool? isPrivate = entry.PrivateDetect switch
        {
            "firefox-title-marker" => FirefoxPrivateMarkers.TitleIndicatesPrivate(focus.Title, firefoxPrivateMarkers),
            "chromium-window-mode" => DetectChromiumIncognito(window),
            _ => null, // "none" (e.g. Safari-only entries) or an unrecognized strategy
        };

        return new AddressBarReadResult(value, isPrivate);
    }

    /// <summary>
    /// Opt-in structural probe for "this browser reads on Windows but that
    /// one doesn't". Both no-address-bar paths collapse to one wire code,
    /// so from the outside a tree that doesn't match the toolbar/Edit shape
    /// is indistinguishable from one that matches but whose values fail
    /// host validation — the exact ambiguity Firefox presented after five
    /// Chromium browsers worked.
    ///
    /// Counts and booleans only, never element text: an address bar's value
    /// IS the URL, and stderr is forwarded to the agent's normal logger.
    ///
    /// Gated on WINRESOLVER_DIAGNOSE_TREE=1 because it re-walks the window
    /// on a path that has already failed, and the read runs under a 250ms
    /// deadline — free when unset, which is how it ships.
    /// </summary>
    private static void DiagnoseTree(
        FlaUI.Core.AutomationElements.AutomationElement window,
        FocusTarget focus,
        IReadOnlyList<AddressBarCandidate> candidates,
        string stage)
    {
        if (Environment.GetEnvironmentVariable("WINRESOLVER_DIAGNOSE_TREE") != "1")
        {
            return;
        }

        try
        {
            // Only call shapes already proven against real browser windows
            // here — this file's history is a lesson in not inventing FlaUI
            // API surface on a machine that cannot compile it.
            var toolbars = window.FindAllDescendants(cf => cf.ByControlType(ControlType.ToolBar));
            var editsAnywhere = window.FindAllDescendants(cf => cf.ByControlType(ControlType.Edit));
            var docs = window.FindAllDescendants(cf => cf.ByControlType(ControlType.Document));

            var withValue = 0;
            var withFocus = 0;
            foreach (var c in candidates)
            {
                if (!string.IsNullOrWhiteSpace(c.Value)) withValue++;
                if (c.HasKeyboardFocus) withFocus++;
            }

            Console.Error.WriteLine(
                $"[tree] {focus.App} stage={stage} toolbars={toolbars.Length} " +
                $"editsAnywhere={editsAnywhere.Length} documents={docs.Length} " +
                $"toolbarEdits={candidates.Count} withNonEmptyValue={withValue} withFocus={withFocus}");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[tree] {focus.App} probe failed: {ex.GetType().Name}");
        }
    }

    /// <summary>
    /// Scoped to toolbar subtrees rather than the whole window — Step 14:
    /// "Do not walk the full tree... narrow the scope to the toolbar."
    /// Some browsers have more than one toolbar-role container (e.g. a
    /// bookmarks bar); every one found is scanned rather than assuming the
    /// first is the right one, since only the toolbar actually containing
    /// an Edit control matters and a bookmarks-only toolbar naturally
    /// contributes no candidates.
    ///
    /// Each property read is its own cross-process round trip. A
    /// CacheRequest was meant to batch them, and is gone — see the body.
    /// </summary>
    private static List<AddressBarCandidate> CollectToolbarCandidates(FlaUI.Core.AutomationElements.AutomationElement window)
    {
        var candidates = new List<AddressBarCandidate>();

        // No CacheRequest here, deliberately. One was written into the
        // original blind implementation and never worked: it failed to
        // compile at all until 7515cf5, and on its first real run against
        // Chrome and Edge every read threw, while cmd.exe and explorer.exe
        // resolved correctly. A cache request caches the properties it is
        // told to and no others, but these searches filter on ControlType,
        // which was never among them — and browser windows are the ones
        // deep enough to reach that nested search, which is exactly the
        // split the logs showed.
        //
        // It was only ever an optimisation. Searching without one is
        // FlaUI's default path, so this trades a speed-up that has never
        // once worked for the plain behaviour that should. If the reads
        // now succeed but run slow, reintroduce caching deliberately, with
        // ControlType included and measured on real hardware.
        var toolbars = window.FindAllDescendants(cf => cf.ByControlType(ControlType.ToolBar));
        foreach (var toolbar in toolbars)
        {
            Collect(toolbar.FindAllDescendants(cf => cf.ByControlType(ControlType.Edit)));
        }

        // Gecko fallback. Firefox exposes four ToolBars and exactly one Edit
        // — and that Edit, the address bar, sits under none of them:
        //
        //   [tree] firefox.exe toolbars=4 editsAnywhere=1 toolbarEdits=0
        //
        // measured on Windows 10 with Firefox's accessibility engine fully
        // active (three Documents present). The toolbar scoping is right for
        // the five Chromium browsers, which all resolve in 40-85ms through
        // the loop above; it is simply not how Gecko nests its URL bar.
        //
        // Only reached when the narrow search found nothing, so Chromium
        // never pays for it. Widening the scope risks pulling in page-content
        // inputs, which is what the narrowing was guarding against — but the
        // guard that actually matters is downstream and unchanged:
        // SelectGenericFallback still requires a candidate's value to
        // normalize to a valid host and to not hold keyboard focus, so a
        // search box containing "how do I center a div" cannot win.
        if (candidates.Count == 0)
        {
            Collect(window.FindAllDescendants(cf => cf.ByControlType(ControlType.Edit)));
        }

        void Collect(FlaUI.Core.AutomationElements.AutomationElement[] elements)
        {
            foreach (var element in elements)
            {
                var hasKeyboardFocus = element.Properties.HasKeyboardFocus.Value;
                var value = element.Patterns.Value.PatternOrDefault?.Value.Value;
                candidates.Add(new AddressBarCandidate(value, hasKeyboardFocus, IsEdit: true));
            }
        }

        return candidates;
    }

    /// <summary>
    /// See IncognitoIndicatorAutomationId's comment — this is a best-effort
    /// heuristic, not a confirmed signal. Absence of the indicator is
    /// treated as "not private" rather than "unknown", matching the
    /// plan's own classification of this as a (heuristic, not perfect)
    /// positive signal for Chromium on Windows.
    /// </summary>
    private static bool DetectChromiumIncognito(FlaUI.Core.AutomationElements.AutomationElement window)
    {
        var indicator = window.FindFirstDescendant(cf => cf.ByAutomationId(IncognitoIndicatorAutomationId));
        return indicator is not null;
    }

    public void Dispose()
    {
        _automation.Dispose();
    }
}
