using System.Text.Json;
using WinResolver;
using WinResolver.Core;

// The side-car entry point: reads newline-delimited JSON requests from
// stdin, writes responses/events to stdout, logs everything else to
// stderr — never anything but protocol JSON on stdout (CLAUDE.md's pinned
// rule; see also resolvers/darwin/index.ts, which follows the same rule
// on the macOS side).
//
// NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine
// available. Written from the pinned protocol contract and Steps 12-15 of
// docs/url-tracking-plan.md; fix from the real compiler/runtime error
// once this runs in CI, per the pattern established in native/win/spike.

// --capture-fixtures[=path]: dumps every raw toolbar candidate seen (not
// just the winning one) to a JSONL file, for building Stage E's real
// normalization fixtures — see docs/url-tracking-plan.md Step 14. Default
// path chosen to be obviously a debug artifact, never written unless
// explicitly requested.
var captureFixturesFlag = args.FirstOrDefault(a => a.StartsWith("--capture-fixtures", StringComparison.Ordinal));
var captureFixturesPath = captureFixturesFlag switch
{
    null => null,
    var flag when flag.Contains('=') => flag[(flag.IndexOf('=') + 1)..],
    _ => "address-bar-fixtures.jsonl",
};

// The remote kill switch (Step 16): "You will want this the first time a
// browser update makes UIA hang on a specific version." Electron decides
// whether to pass this based on its own remote config — this side-car
// only needs to honor it once passed, by never touching FlaUI/UIA at all
// and falling back to reporting just the window title. Advertised via
// `ready`'s caps (no "url"/"private") using the same mechanism Stage C.1's
// pre-UIA skeleton state already used, rather than inventing a new one.
var uiaDisabled = args.Contains("--disable-uia");

var registryPath = Path.Combine(AppContext.BaseDirectory, "browser-registry.json");
var markersPath = Path.Combine(AppContext.BaseDirectory, "firefox-private-markers.json");
var registry = BrowserRegistry.Load(registryPath);
var firefoxPrivateMarkers = FirefoxPrivateMarkers.Load(markersPath);

var stdoutLock = new object();
var focusLock = new object();
FocusTarget? lastFocus = null;

var answeredRequests = new AnsweredRequestTracker();
var uiaWorker = new UiaWorker();
var addressBarReader = new AddressBarReader();

void WriteLine(object value)
{
    var json = JsonSerializer.Serialize(value, value.GetType());
    lock (stdoutLock)
    {
        Console.Out.Write(json);
        Console.Out.Write('\n');
        Console.Out.Flush();
    }
}

void CaptureFixturesIfEnabled(FocusTarget focus)
{
    if (captureFixturesPath is null)
    {
        return;
    }

    var record = new
    {
        ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        app = focus.App,
        title = focus.Title,
        candidates = addressBarReader.LastCandidates
            .Where(c => c.IsEdit)
            .Select(c => new { c.Value, c.HasKeyboardFocus })
            .ToArray(),
    };
    File.AppendAllText(captureFixturesPath, JsonSerializer.Serialize(record) + "\n");
}

var focusWatcher = new FocusWatcher();
focusWatcher.FocusChanged += target =>
{
    lock (focusLock)
    {
        lastFocus = target;
    }

    WriteLine(new FocusEvent(target.Pid, target.Hwnd, target.App, target.Title,
        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
};
focusWatcher.Start();

WriteLine(new ReadyEvent("win32", uiaDisabled ? new[] { "focus" } : new[] { "focus", "url", "private" }));

async Task HandleResolveAsync(ResolveRequest request)
{
    FocusTarget? focus;
    lock (focusLock)
    {
        focus = lastFocus;
    }

    if (focus is null || focus.Pid != request.Pid)
    {
        WriteLine(new ErrorResponse(request.Id, new ResolveFailure(
            ResolveErrorCode.FocusMismatch,
            "Resolve request does not match the currently focused window.").ToWireMessage()));
        return;
    }

    // The title captured at focus time goes stale as soon as the person
    // switches tabs, and would be reported against the new tab's URL.
    focus = focus with { Title = FocusWatcher.ReadWindowTitle(new IntPtr(focus.Hwnd)) };

    if (IntegrityLevelChecker.IsElevatedRelativeToUs(request.Pid))
    {
        WriteLine(new ErrorResponse(request.Id, new ResolveFailure(
            ResolveErrorCode.ElevatedTarget,
            "Target process runs at a higher integrity level than this agent and cannot be read.").ToWireMessage()));
        return;
    }

    if (uiaDisabled)
    {
        // Title-only fallback: no FlaUI/COM call at all, ever — that's the
        // whole point of the kill switch. url is deliberately "" (the same
        // "intentionally no real URL" convention session-engine.ts already
        // uses for private sessions) rather than guessing at a host from
        // the title text, which would be unreliable and misleading.
        WriteLine(new ResolveOkResponse(
            request.Id, "", focus.Title ?? "", focus.App, null, "title", "guess", 0));
        return;
    }

    var entry = BrowserRegistry.FindByProcessName(registry, focus.App);
    var started = DateTimeOffset.UtcNow;

    // Step 14's hard ~250ms deadline: the actual read runs on the
    // dedicated UIA thread (never here), raced against a plain delay —
    // see UiaWorker's own comment on why a timeout can't forcibly cancel
    // a hung native COM call, only abandon waiting for it.
    var workTask = uiaWorker.Enqueue(() =>
    {
        var result = addressBarReader.Read(focus, entry, firefoxPrivateMarkers);
        CaptureFixturesIfEnabled(focus);
        return result;
    });
    var winner = await Task.WhenAny(workTask, Task.Delay(250));

    if (winner != workTask)
    {
        if (answeredRequests.TryClaim(request.Id))
        {
            WriteLine(new ErrorResponse(request.Id, new ResolveFailure(
                ResolveErrorCode.UiaTimeout,
                "UIA read did not complete within the 250ms deadline.").ToWireMessage()));
        }

        // The queued read may still finish later on the UIA thread; when
        // it does, claim the id too so a late result can never be
        // written a second time — this claim will fail (we already
        // claimed it above), so the late result is silently discarded.
        _ = workTask.ContinueWith(
            _ =>
            {
                answeredRequests.TryClaim(request.Id);
                answeredRequests.Forget(request.Id);
            },
            TaskScheduler.Default);
        return;
    }

    if (!answeredRequests.TryClaim(request.Id))
    {
        // Lost an extremely unlikely race against the timeout path above.
        return;
    }

    try
    {
        var result = await workTask;
        var elapsedMs = (long)(DateTimeOffset.UtcNow - started).TotalMilliseconds;
        WriteLine(new ResolveOkResponse(
            request.Id, result.Value, focus.Title ?? "", focus.App, result.IsPrivate,
            "uia", "displayed", elapsedMs));
    }
    catch (ResolveFailureException ex)
    {
        WriteLine(new ErrorResponse(request.Id, ex.Failure.ToWireMessage()));
    }
    catch (Exception ex)
    {
        // Type and stack only, never ex.Message: a UIA exception can quote the
        // element text it choked on, which for an address bar is the URL, and
        // stderr reaches the normal logger.
        Console.Error.WriteLine(
            $"[resolve] {ex.GetType().FullName} reading {focus.App}{Environment.NewLine}{ex.StackTrace}");
        WriteLine(new ErrorResponse(request.Id, new ResolveFailure(
            ResolveErrorCode.Unexpected,
            $"UIA read threw {ex.GetType().Name}.").ToWireMessage()));
    }
    finally
    {
        answeredRequests.Forget(request.Id);
    }
}

void HandleLine(string line)
{
    var request = RequestParser.Parse(line);
    if (request is null)
    {
        Console.Error.WriteLine($"Dropped unrecognized request line: {Truncate(line, 200)}");
        return;
    }

    switch (request)
    {
        case PingRequest ping:
            // Answered synchronously, right here on the main protocol
            // thread — never routed through the UIA worker, so a
            // slow/hung UIA call can never delay the pong the watchdog
            // depends on (see ResolverManager's ping watchdog on the
            // Electron side).
            WriteLine(new PingOkResponse(ping.Id));
            break;
        case ResolveRequest resolve:
            _ = HandleResolveAsync(resolve);
            break;
    }
}

static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];

string? line;
while ((line = Console.In.ReadLine()) != null)
{
    if (line.Trim().Length == 0)
    {
        continue;
    }

    HandleLine(line);
}

// stdin closed — exit cleanly rather than hanging. focusWatcher's pump
// thread and uiaWorker's thread are both background (see their own
// Dispose comments) and never keep the process alive on their own.
focusWatcher.Dispose();
uiaWorker.Dispose();
addressBarReader.Dispose();
