using System.Collections.Concurrent;

namespace WinResolver;

/// <summary>
/// A single persistent MTA thread that all UIA/FlaUI work runs on — Step
/// 14: "Run all UIA work on a dedicated MTA thread. Never the process
/// main thread." One thread (not one per call) so UIA COM calls are
/// always serialized, avoiding concurrent-call apartment issues, and so a
/// hung call doesn't spawn an unbounded number of stuck threads.
///
/// The ~250ms hard deadline ("UIA provides no timeout... abandon past
/// it") is enforced by the CALLER racing the returned task against
/// Task.Delay, not by this class trying to forcibly interrupt a running
/// COM call — a genuinely hung native call cannot be reliably cancelled
/// that way. If the caller's deadline wins, the queued work item is
/// simply abandoned here; it may still complete later on this thread, at
/// which point it's the caller's job (via AnsweredRequestTracker) to
/// discard that late result rather than answer the same request twice.
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
