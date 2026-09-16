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
///  1. The CacheRequest usage below (batching value/keyboard-focus/
///     control-type into one round trip) — FlaUI's exact CacheRequest API
///     surface is less certain than the plain Win32 P/Invoke code
///     elsewhere in this project, which is unusually stable and
///     well-documented by comparison. If this fails to compile, that is
///     the single most likely point of failure — fix from the real
///     compiler error.
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
            throw new ResolveFailureException(new ResolveFailure(
                ResolveErrorCode.NoAddressBar, "Could not attach to the focused window via UIA."));
        }

        var candidates = CollectToolbarCandidates(window);
        LastCandidates = candidates;
        if (candidates.Count == 0)
        {
            throw new ResolveFailureException(new ResolveFailure(
                ResolveErrorCode.NoAddressBar, "No toolbar Edit elements found in the focused window."));
        }

        var anyEditHasFocus = candidates.Any(c => c.IsEdit && c.HasKeyboardFocus);
        var value = AddressBarSelector.SelectGenericFallback(candidates);
        if (value is null)
        {
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
    /// Scoped to toolbar subtrees rather than the whole window — Step 14:
    /// "Do not walk the full tree... narrow the scope to the toolbar."
    /// Some browsers have more than one toolbar-role container (e.g. a
    /// bookmarks bar); every one found is scanned rather than assuming the
    /// first is the right one, since only the toolbar actually containing
    /// an Edit control matters and a bookmarks-only toolbar naturally
    /// contributes no candidates.
    ///
    /// Uses a CacheRequest so value, keyboard-focus state, and control
    /// type are fetched in ONE cross-process round trip per element
    /// rather than three separate calls — see this class's own
    /// higher-risk-area note about this specific API surface.
    /// </summary>
    private static List<AddressBarCandidate> CollectToolbarCandidates(FlaUI.Core.AutomationElements.AutomationElement window)
    {
        var candidates = new List<AddressBarCandidate>();

        // The cached property/pattern identifiers come from the automation
        // instance's own libraries (AutomationBase.PropertyLibrary /
        // .PatternLibrary), NOT from statics on AutomationElement — an
        // earlier best-effort guess at this API cost three compile errors
        // (CS1674/CS0120/CS0117). Verified against FlaUI's source:
        // CacheRequest.Add takes a PropertyId or PatternId, CacheRequest
        // itself is not IDisposable (Activate() returns the IDisposable
        // that pops it), and FrameworkAutomationElementBase reaches
        // HasKeyboardFocus through exactly this Element-group path.
        //
        // The property-access calls inside the loop
        // (.Patterns.Value.PatternOrDefault?.Value.Value,
        // .Properties.HasKeyboardFocus.Value) were never in doubt: they
        // reuse the exact syntax already confirmed to compile in the C.0
        // spike's flaui-variant (see its fix history) rather than guessing
        // new property names. Searching directly for ControlType.Edit (rather
        // than enumerating every descendant and checking its type
        // afterward) mirrors that exact confirmed FindFirstDescendant
        // call, pluralized, instead of relying on an unverified
        // parameterless "all descendants" overload.
        var automation = window.Automation;
        var cacheRequest = new CacheRequest();
        cacheRequest.Add(automation.PropertyLibrary.Element.HasKeyboardFocus);
        cacheRequest.Add(automation.PatternLibrary.ValuePattern);
        cacheRequest.TreeScope = TreeScope.Descendants;

        // Activate() returns the IDisposable that deactivates the request —
        // the cache is only populated for calls made inside this block.
        using (cacheRequest.Activate())
        {
            var toolbars = window.FindAllDescendants(cf => cf.ByControlType(ControlType.ToolBar));
            foreach (var toolbar in toolbars)
            {
                var editElements = toolbar.FindAllDescendants(cf => cf.ByControlType(ControlType.Edit));
                foreach (var element in editElements)
                {
                    var hasKeyboardFocus = element.Properties.HasKeyboardFocus.Value;
                    var value = element.Patterns.Value.PatternOrDefault?.Value.Value;
                    candidates.Add(new AddressBarCandidate(value, hasKeyboardFocus, IsEdit: true));
                }
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
