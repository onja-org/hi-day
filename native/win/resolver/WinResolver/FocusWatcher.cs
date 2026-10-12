using System.Runtime.InteropServices;
using System.Text;

namespace WinResolver;

/// <summary>
/// A window that just became the foreground window, in the shape the
/// protocol's FocusEvent needs (pid/hwnd/app/title).
/// </summary>
public sealed record FocusTarget(int Pid, long Hwnd, string App, string Title);

/// <summary>
/// Watches EVENT_SYSTEM_FOREGROUND via a dedicated thread running a native
/// Win32 message pump — event-driven and cheap, per Step 13 of the plan.
/// Deliberately NOT polling GetForegroundWindow, and NOT using UIA's own
/// focus events (documented as slow and leaky).
///
/// NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine
/// available; this is a best-effort implementation of a well-documented
/// Win32 pattern, meant to be built and exercised for real in CI/on a real
/// machine. If it fails to compile or behave correctly, fix from the real
/// error — see the fix history in native/win/spike for the established
/// pattern of iterating from real feedback rather than guessing further.
///
/// Why a message pump is required at all: SetWinEventHook's callback is
/// only ever invoked on the thread that registered the hook, and only
/// while that thread is actively pumping window messages
/// (GetMessage/TranslateMessage/DispatchMessage) — this is ordinary Win32
/// thread-affinity for window messages, not something specific to UI
/// Automation. A plain console app has no message loop by default, so this
/// class supplies one on a thread dedicated to nothing else. A raw
/// P/Invoke loop is used instead of pulling in WinForms/WPF just to call
/// Application.Run() — keeps this dependency-free and matches the plan
/// doc's own P/Invoke-style snippet.
/// </summary>
public sealed class FocusWatcher : IDisposable
{
    private const uint EventSystemForeground = 0x0003;
    private const uint WineventOutofcontext = 0x0000;
    private const int ObjidWindow = 0;

    private delegate void WinEventDelegate(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);

    [DllImport("user32.dll")]
    private static extern IntPtr SetWinEventHook(
        uint eventMin, uint eventMax, IntPtr hmodWinEventProc,
        WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern bool UnhookWinEvent(IntPtr hWinEventHook);

    [DllImport("user32.dll")]
    private static extern int GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [StructLayout(LayoutKind.Sequential)]
    private struct Msg
    {
        public IntPtr Hwnd;
        public uint Message;
        public IntPtr WParam;
        public IntPtr LParam;
        public uint Time;
        public int PtX;
        public int PtY;
    }

    [DllImport("user32.dll")]
    private static extern int GetMessage(out Msg lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref Msg lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref Msg lpMsg);

    public event Action<FocusTarget>? FocusChanged;

    private Thread? _thread;
    private IntPtr _hook;

    // Kept alive for the object's lifetime so the unmanaged hook's function
    // pointer into this delegate stays valid — if this were only a local
    // variable, the GC could collect it while SetWinEventHook still holds
    // a raw pointer to it, corrupting the callback.
    private WinEventDelegate? _callback;

    public void Start()
    {
        _thread = new Thread(Run) { IsBackground = true, Name = "FocusWatcher" };
        _thread.Start();
    }

    private void Run()
    {
        _callback = OnWinEvent;
        _hook = SetWinEventHook(
            EventSystemForeground, EventSystemForeground,
            IntPtr.Zero, _callback, 0, 0, WineventOutofcontext);

        if (_hook == IntPtr.Zero)
        {
            // Nothing registered — there is no hook event to pump for, so
            // don't spin a message loop that will never receive anything.
            // The caller sees no focus events at all in this case, which is
            // itself an observable degraded state (no ready-time error
            // surfaced here since this is Stage C.1's skeleton scope).
            return;
        }

        while (GetMessage(out var msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
    }

    private void OnWinEvent(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime)
    {
        // idObject filters out sub-object notifications (e.g. a control
        // gaining focus within an already-foreground window) — only a
        // genuine top-level window becoming foreground is a focus event.
        if (idObject != ObjidWindow || hwnd == IntPtr.Zero)
        {
            return;
        }

        GetWindowThreadProcessId(hwnd, out var pid);
        var title = ReadWindowTitle(hwnd);
        var appName = ReadProcessName(pid);

        FocusChanged?.Invoke(new FocusTarget((int)pid, hwnd.ToInt64(), appName, title));
    }

    /// <summary>
    /// Reads the caption Windows already holds for the window, so it can't
    /// hang on an unresponsive browser. Also called on every resolve:
    /// switching tabs retitles the window without a foreground event.
    /// </summary>
    public static string ReadWindowTitle(IntPtr hwnd)
    {
        var length = GetWindowTextLength(hwnd);
        if (length <= 0)
        {
            return "";
        }

        var builder = new StringBuilder(length + 1);
        GetWindowText(hwnd, builder, builder.Capacity);
        return builder.ToString();
    }

    private const uint ProcessQueryLimitedInformation = 0x1000;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool QueryFullProcessImageName(
        IntPtr hProcess, uint dwFlags, StringBuilder lpExeName, ref uint lpdwSize);

    /// <summary>
    /// Returns the executable's file name WITH extension (e.g.
    /// "chrome.exe") — the pinned wire example shows `"app": "chrome.exe"`,
    /// and browser-registry.json's match.win32 values are written the same
    /// way, so this must match exactly for registry lookups in Stage C.2
    /// to work. System.Diagnostics.Process.ProcessName deliberately isn't
    /// used here — it strips the extension. QueryFullProcessImageName is
    /// used instead of Process.MainModule for the same reason
    /// IntegrityLevelChecker uses PROCESS_QUERY_LIMITED_INFORMATION: this
    /// access right is documented to work even against a higher-integrity
    /// (elevated) process, where MainModule's stronger access
    /// requirements would throw.
    /// </summary>
    private static string ReadProcessName(uint pid)
    {
        var handle = OpenProcess(ProcessQueryLimitedInformation, false, pid);
        if (handle == IntPtr.Zero)
        {
            return "";
        }

        try
        {
            var buffer = new StringBuilder(1024);
            var size = (uint)buffer.Capacity;
            if (!QueryFullProcessImageName(handle, 0, buffer, ref size))
            {
                return "";
            }

            return Path.GetFileName(buffer.ToString());
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    public void Dispose()
    {
        if (_hook != IntPtr.Zero)
        {
            UnhookWinEvent(_hook);
            _hook = IntPtr.Zero;
        }

        // Deliberately not forcing the pump thread to stop: GetMessage
        // blocks until the next message, and there is no clean way to
        // unblock it from another thread without posting one (e.g.
        // PostThreadMessage(WM_QUIT)). The thread is marked IsBackground,
        // so it never keeps the process alive on its own — process exit
        // reclaims it regardless. Revisit only if Stage C.3's watchdog
        // work needs a faster-than-process-exit teardown than that.
    }
}
