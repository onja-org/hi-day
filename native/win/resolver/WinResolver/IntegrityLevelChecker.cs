using System.Runtime.InteropServices;

namespace WinResolver;

/// <summary>
/// Windows mandatory integrity levels, ordered so a plain int comparison
/// tells you which is higher — the SID sub-authority (RID) Windows itself
/// uses for each level already sorts this way, so the enum's underlying
/// values are set to match exactly rather than an arbitrary 0..N ordering.
/// </summary>
public enum IntegrityLevel
{
    Untrusted = 0x0000,
    Low = 0x1000,
    Medium = 0x2000,
    MediumPlus = 0x2100,
    High = 0x3000,
    System = 0x4000,
    ProtectedProcess = 0x5000,
}

/// <summary>
/// Compares a target process's Windows integrity level against our own.
/// Step 14 of the plan: a browser running elevated (High/System) cannot be
/// read by UI Automation from a non-elevated (Medium) agent — that failure
/// must be detected and reported with a typed reason, never silently
/// swallowed as "no window found" or similar.
///
/// NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine
/// available. The token/SID manipulation here (OpenProcessToken +
/// GetTokenInformation(TokenIntegrityLevel) + reading the SID's last
/// sub-authority) is the standard, well-documented pattern for this check
/// — there is no managed .NET API for mandatory integrity labels — but the
/// exact P/Invoke signatures are unverified against a real compiler/runtime.
/// If this fails to compile or misbehaves, fix from the real error.
/// </summary>
public static class IntegrityLevelChecker
{
    private const uint TokenQuery = 0x0008;
    private const int TokenIntegrityLevelClass = 25; // TOKEN_INFORMATION_CLASS.TokenIntegrityLevel
    private const uint ProcessQueryLimitedInformation = 0x1000;

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool OpenProcessToken(IntPtr processHandle, uint desiredAccess, out IntPtr tokenHandle);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool GetTokenInformation(
        IntPtr tokenHandle, int tokenInformationClass,
        IntPtr tokenInformation, int tokenInformationLength, out int returnLength);

    [DllImport("advapi32.dll")]
    private static extern IntPtr GetSidSubAuthorityCount(IntPtr sid);

    [DllImport("advapi32.dll")]
    private static extern IntPtr GetSidSubAuthority(IntPtr sid, uint subAuthorityIndex);

    /// <summary>
    /// True only when the target is definitively readable-or-not relative
    /// to us; an indeterminate result (couldn't open the process/token —
    /// most commonly because it already exited) is treated as "not our
    /// call to make" rather than a false positive, leaving whatever UIA
    /// read is actually attempted to surface its own real error.
    /// </summary>
    public static bool IsElevatedRelativeToUs(int targetProcessId)
    {
        var target = TryGetIntegrityLevel(targetProcessId);
        if (target is null)
        {
            return false;
        }

        return (int)target.Value > (int)GetOwnIntegrityLevel();
    }

    private static IntegrityLevel GetOwnIntegrityLevel()
    {
        // We always hold a valid token for our own process; if this ever
        // returns null, something is badly wrong with our own security
        // context rather than the normal "can't inspect another process"
        // case, so fall back to Medium (the default for a standard
        // non-elevated user process) instead of propagating a nullable
        // into every caller for a case that realistically never happens.
        return TryGetIntegrityLevel(GetCurrentProcess()) ?? IntegrityLevel.Medium;
    }

    private static IntegrityLevel? TryGetIntegrityLevel(int processId)
    {
        var processHandle = OpenProcess(ProcessQueryLimitedInformation, false, processId);
        if (processHandle == IntPtr.Zero)
        {
            return null;
        }

        try
        {
            return TryGetIntegrityLevel(processHandle);
        }
        finally
        {
            CloseHandle(processHandle);
        }
    }

    private static IntegrityLevel? TryGetIntegrityLevel(IntPtr processHandle)
    {
        if (!OpenProcessToken(processHandle, TokenQuery, out var tokenHandle))
        {
            return null;
        }

        try
        {
            GetTokenInformation(tokenHandle, TokenIntegrityLevelClass, IntPtr.Zero, 0, out var length);
            if (length == 0)
            {
                return null;
            }

            var buffer = Marshal.AllocHGlobal(length);
            try
            {
                if (!GetTokenInformation(tokenHandle, TokenIntegrityLevelClass, buffer, length, out _))
                {
                    return null;
                }

                // The returned buffer is a TOKEN_MANDATORY_LABEL, whose
                // only field (a SID_AND_ATTRIBUTES) starts with the SID
                // pointer — reading a pointer-sized value at offset 0 gets
                // it without needing the rest of the struct layout.
                var sidPtr = Marshal.ReadIntPtr(buffer);
                var subAuthorityCountPtr = GetSidSubAuthorityCount(sidPtr);
                var subAuthorityCount = Marshal.ReadByte(subAuthorityCountPtr);
                if (subAuthorityCount == 0)
                {
                    return null;
                }

                // The integrity level lives in the SID's last sub-authority
                // (RID) — GetSidSubAuthority returns a pointer to that DWORD.
                var ridPtr = GetSidSubAuthority(sidPtr, (uint)(subAuthorityCount - 1));
                return (IntegrityLevel)Marshal.ReadInt32(ridPtr);
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }
        finally
        {
            CloseHandle(tokenHandle);
        }
    }
}
