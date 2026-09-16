using FlaUI.Core;
using FlaUI.Core.Definitions;
using FlaUI.UIA3;
using WinResolver.Core;

namespace WinResolver;

public sealed record AddressBarReadResult(string Value, bool? IsPrivate);

/// <summary>
/// The UIA tree walk and address-bar read (plan Steps 14/15). Every call
/// MUST run on UiaWorker's MTA thread; this class trusts its caller for that.
///
/// Verified on Windows 10 against Chrome, Edge, Brave, Opera, Vivaldi and
/// Firefox. IncognitoIndicatorAutomationId remains unconfirmed — see its
/// comment.
/// </summary>
public sealed class AddressBarReader : IDisposable
{
    // UNVERIFIED guess at Chromium's incognito-indicator AutomationId. A wrong
    // value fails silently — the window is simply never marked private, and
    // session-engine only redacts when private===true. Confirm with
    // Accessibility Insights against a real incognito window before relying on
    // Chromium private detection.
    private const string IncognitoIndicatorAutomationId = "IncognitoAvatarButton";

    private readonly UIA3Automation _automation = new();

    /// <summary>
    /// Every candidate from the most recent Read(), successful or not —
    /// --capture-fixtures needs all of them, not just the winner.
    /// </summary>
    public IReadOnlyList<AddressBarCandidate> LastCandidates { get; private set; } = Array.Empty<AddressBarCandidate>();

    public AddressBarReadResult Read(FocusTarget focus, BrowserRegistryEntry entry, IReadOnlyList<string> firefoxPrivateMarkers)
    {
        var window = _automation.FromHandle(new IntPtr(focus.Hwnd));
        if (window is null)
        {
            LastCandidates = Array.Empty<AddressBarCandidate>();

            // Probed separately: this path returns before any tree walk, so
            // without it a failure here looks like the probe never ran.
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

    /// <summary>Upper bound on TextPattern reads — a URL bar, not a document.</summary>
    private const int MaxTextLength = 2048;

    /// <summary>
    /// AutomationProperty.Value THROWS when the property is unsupported rather
    /// than returning null, and PatternOrDefault only guards the pattern's
    /// absence, not an unsupported property on a present pattern. Gecko exposes
    /// LegacyIAccessible without a readable Value, so every read goes through
    /// TryGetValue instead.
    /// </summary>
    private static string? ReadPatternValue(AutomationProperty<string>? property)
    {
        if (property is null)
        {
            return null;
        }

        try
        {
            return property.TryGetValue(out var value) ? value : null;
        }
        catch
        {
            // A provider can fail mid-call even when the property reports as
            // supported; one bad element must not sink the whole read.
            return null;
        }
    }

    /// <summary>
    /// ValuePattern first — the five Chromium browsers answer on it in 40-85ms.
    /// LegacyIAccessible then TextPattern for Gecko, which answers on neither
    /// of the first two.
    /// </summary>
    private static string? ReadValue(FlaUI.Core.AutomationElements.AutomationElement element)
    {
        var value = ReadPatternValue(element.Patterns.Value.PatternOrDefault?.Value);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        value = ReadPatternValue(element.Patterns.LegacyIAccessible.PatternOrDefault?.Value);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return ReadTextPattern(element);
    }

    /// <summary>
    /// Last source, for Gecko: Firefox reported ValuePattern and
    /// LegacyIAccessible empty with TextPattern present on every Edit.
    /// </summary>
    private static string? ReadTextPattern(FlaUI.Core.AutomationElements.AutomationElement element)
    {
        try
        {
            var text = element.Patterns.Text.PatternOrDefault?.DocumentRange.GetText(MaxTextLength);
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Same throwing hazard as ReadPatternValue; absent focus is the safe default.</summary>
    private static bool ReadHasKeyboardFocus(FlaUI.Core.AutomationElements.AutomationElement element)
    {
        try
        {
            return element.Properties.HasKeyboardFocus.TryGetValue(out var focused) && focused;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Opt-in probe for "this browser reads but that one doesn't". All three
    /// no-address-bar exits share one wire code, so without it a tree-shape
    /// mismatch is indistinguishable from a value that failed host validation.
    ///
    /// Identifiers, counts and lengths only — never element text, since an
    /// address bar's value IS the URL and stderr reaches the normal logger.
    /// Gated because it re-walks a window under a 250ms deadline.
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

            // AutomationId and ClassName are provider-hardcoded identifiers
            // ("urlbar-input"), safe to print where a value or Name is not.
            // Lengths separate "returned nothing" from "returned something we
            // then rejected".
            var patterns = new List<string>();
            foreach (var edit in editsAnywhere)
            {
                var id = ReadPatternValue(edit.Properties.AutomationId) ?? "";
                var cls = ReadPatternValue(edit.Properties.ClassName) ?? "";
                var valueLen = (ReadPatternValue(edit.Patterns.Value.PatternOrDefault?.Value) ?? "").Length;
                var legacyLen = (ReadPatternValue(edit.Patterns.LegacyIAccessible.PatternOrDefault?.Value) ?? "").Length;
                var textLen = (ReadTextPattern(edit) ?? "").Length;
                var nameLen = (ReadPatternValue(edit.Properties.Name) ?? "").Length;
                patterns.Add(
                    $"id='{id}' class='{cls}' valueLen={valueLen} legacyLen={legacyLen} " +
                    $"textLen={textLen} nameLen={nameLen}");
            }

            Console.Error.WriteLine(
                $"[tree] {focus.App} stage={stage} toolbars={toolbars.Length} " +
                $"editsAnywhere={editsAnywhere.Length} documents={docs.Length} " +
                $"toolbarEdits={candidates.Count} withNonEmptyValue={withValue} withFocus={withFocus} " +
                $"edits[{string.Join(" | ", patterns)}]");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[tree] {focus.App} probe failed: {ex.GetType().Name}");
        }
    }

    /// <summary>
    /// Scoped to toolbar subtrees, never the whole window (Step 14). Every
    /// toolbar is scanned, not just the first — a bookmarks bar simply
    /// contributes no candidates.
    /// </summary>
    private static List<AddressBarCandidate> CollectToolbarCandidates(FlaUI.Core.AutomationElements.AutomationElement window)
    {
        var candidates = new List<AddressBarCandidate>();

        // No CacheRequest: one caching only Value and HasKeyboardFocus made
        // every browser read throw, because these searches filter on
        // ControlType. If reads prove slow, reintroduce it with ControlType
        // included and measure.
        var toolbars = window.FindAllDescendants(cf => cf.ByControlType(ControlType.ToolBar));
        // Gecko's URL bar is an editable ComboBox (it carries the autocomplete
        // dropdown); Chromium exposes a plain Edit. Both cover every browser.
        foreach (var toolbar in toolbars)
        {
            Collect(toolbar.FindAllDescendants(cf => cf.ByControlType(ControlType.Edit)));
            Collect(toolbar.FindAllDescendants(cf => cf.ByControlType(ControlType.ComboBox)));
        }

        // Never widen this to a window-wide search: one tried here found no
        // browser chrome at all, only page inputs — including a password
        // field. Host validation rejected them, but they are not ours to read.

        void Collect(FlaUI.Core.AutomationElements.AutomationElement[] elements)
        {
            foreach (var element in elements)
            {
                candidates.Add(new AddressBarCandidate(
                    ReadValue(element), ReadHasKeyboardFocus(element), IsEdit: true));
            }
        }

        return candidates;
    }

    /// <summary>
    /// Best-effort heuristic, not a confirmed signal — see
    /// IncognitoIndicatorAutomationId. Absence is treated as "not private"
    /// rather than "unknown".
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
