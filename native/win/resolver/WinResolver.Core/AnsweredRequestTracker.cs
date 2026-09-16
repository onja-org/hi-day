namespace WinResolver.Core;

/// <summary>
/// Guards the resolve() timeout race (Step 14): the caller answers with
/// uia_timeout after ~250ms, but the queued UIA work may still finish and
/// produce a real result. First one here wins; the loser is discarded, since
/// ResolverManager expects exactly one response per id.
/// </summary>
public sealed class AnsweredRequestTracker
{
    private readonly object _lock = new();
    private readonly HashSet<int> _answered = new();

    /// <summary>
    /// Atomically claims `id`, returning true only for the first caller.
    /// Gate "should I write this response" on the result.
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
