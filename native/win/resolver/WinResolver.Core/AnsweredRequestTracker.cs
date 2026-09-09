namespace WinResolver.Core;

/// <summary>
/// Guards the resolve() timeout race from Step 14: the caller answers a
/// request with uia_timeout after ~250ms, but the queued UIA work may
/// still complete afterwards and produce a real result. Whichever side
/// gets here first must win — the loser's response must be silently
/// discarded, never written to stdout, since ResolverManager expects
/// exactly one response per request id and a second one would be either
/// dropped as "unknown id" (harmless, but wasted work) or, worse, matched
/// against a NEWER request that happens to reuse the id space unexpectedly.
/// </summary>
public sealed class AnsweredRequestTracker
{
    private readonly object _lock = new();
    private readonly HashSet<int> _answered = new();

    /// <summary>
    /// Atomically checks whether `id` is already answered and, if not,
    /// claims it — returns true only for the first caller to claim a given
    /// id. Callers must gate "should I actually write this response" on
    /// the return value.
    /// </summary>
    public bool TryClaim(int id)
    {
        lock (_lock)
        {
            return _answered.Add(id);
        }
    }

    /// <summary>
    /// Drops bookkeeping for an id once it can never be raced again, so
    /// this set doesn't grow unboundedly over the side-car's lifetime.
    /// </summary>
    public void Forget(int id)
    {
        lock (_lock)
        {
            _answered.Remove(id);
        }
    }
}
