using System.Collections.Concurrent;

namespace WinResolver;

/// <summary>
/// The single MTA thread all UIA work runs on (Step 14). One thread, not one
/// per call, so COM calls serialize and a hung call cannot spawn unbounded
/// stuck threads.
///
/// The ~250ms deadline is enforced by the CALLER racing the returned task — a
/// hung native call cannot be reliably cancelled. An abandoned work item may
/// still complete later, so the caller discards late results via
/// AnsweredRequestTracker.
/// </summary>
public sealed class UiaWorker : IDisposable
{
    private readonly BlockingCollection<Action> _queue = new();
    private readonly Thread _thread;

    public UiaWorker()
    {
        _thread = new Thread(Run) { IsBackground = true, Name = "UiaWorker" };
        _thread.SetApartmentState(ApartmentState.MTA);
        _thread.Start();
    }

    private void Run()
    {
        foreach (var work in _queue.GetConsumingEnumerable())
        {
            work();
        }
    }

    /// <summary>
    /// Queues work to run on the dedicated UIA thread and returns a task
    /// that completes once it does. This method itself enforces no
    /// timeout — the caller is responsible for racing the returned task
    /// against its own deadline.
    /// </summary>
    public Task<T> Enqueue<T>(Func<T> work)
    {
        var completionSource = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        _queue.Add(() =>
        {
            try
            {
                completionSource.TrySetResult(work());
            }
            catch (Exception ex)
            {
                completionSource.TrySetException(ex);
            }
        });
        return completionSource.Task;
    }

    public void Dispose()
    {
        _queue.CompleteAdding();
        // Deliberately not joining the thread: if it's stuck mid-COM-call,
        // joining would hang process shutdown. It's a background thread,
        // so process exit reclaims it regardless (same reasoning as
        // FocusWatcher.Dispose).
    }
}
