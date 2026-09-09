namespace WinResolver.Core;

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
