namespace WinResolver.Core;

/// <summary>
/// Typed reasons a resolve() call can fail. The pinned wire protocol's
/// ErrorResponse only carries a free-text message (no code field — that
/// only exists on the unsolicited ev:"error" event), so a typed reason is
/// modeled here internally and collapsed into a single greppable message
/// string at the wire boundary — the same pattern the darwin resolver
/// uses for its own internal typed errors (see resolvers/darwin/errors.ts).
/// </summary>
public enum ResolveErrorCode
{
    /// <summary>Stage C.1 skeleton has no UIA reading yet — Stage C.2 replaces this.</summary>
    NotImplemented,

    /// <summary>The target process runs at a higher integrity level than this agent (Step 14).</summary>
    ElevatedTarget,

    /// <summary>The requested (pid, hwnd) does not match the currently focused window.</summary>
    FocusMismatch,

    /// <summary>The UIA read did not complete within its ~250ms hard deadline (Step 14).</summary>
    UiaTimeout,

    /// <summary>UIA could not find a usable address-bar element for this window.</summary>
    NoAddressBar,

    /// <summary>The address bar has keyboard focus — the user is typing; the reading is rejected.</summary>
    AddressBarFocused,

    /// <summary>
    /// The read threw something no other code covers. Tagged like every other
    /// failure so it cannot be confused with a request that got no reply.
    /// </summary>
    Unexpected,
}

public sealed record ResolveFailure(ResolveErrorCode Code, string Message)
{
    private static string Tag(ResolveErrorCode code) => code switch
    {
        ResolveErrorCode.NotImplemented => "not-implemented",
        ResolveErrorCode.ElevatedTarget => "elevated-target",
        ResolveErrorCode.FocusMismatch => "focus-mismatch",
        ResolveErrorCode.UiaTimeout => "uia-timeout",
        ResolveErrorCode.NoAddressBar => "no-address-bar",
        ResolveErrorCode.AddressBarFocused => "address-bar-focused",
        ResolveErrorCode.Unexpected => "unexpected",
        _ => "unknown",
    };

    public string ToWireMessage() => $"[{Tag(Code)}] {Message}";
}

/// <summary>
/// Carries a typed ResolveFailure up through a call stack that otherwise
/// only knows how to propagate exceptions (e.g. a Task from a background
/// worker) — the catch site converts this back into a typed wire error
/// instead of the generic "unexpected failure" path used for anything
/// else that throws.
/// </summary>
public sealed class ResolveFailureException(ResolveFailure failure) : Exception(failure.Message)
{
    public ResolveFailure Failure { get; } = failure;
}
