import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { uptime } from 'node:os';

/**
 * Starting the timer by itself when the machine is turned on. On unless
 * somebody turns it off (Preferences → "Start timer when the computer
 * starts"): the working day this agent is most likely to miss is the one
 * nobody remembered to press play for.
 *
 * Once per power-on, never per app launch: the agent relaunches itself
 * after a crash and after an update, and neither of those is a working day
 * beginning.
 *
 * The decision is pure so it can be read in one place and tested by table;
 * main holds the state it needs and the renderer does the starting, since
 * there must never be a second way to start a timer.
 */
export interface AutoStartInput {
  /** The preference. On until somebody turns it off. */
  enabled: boolean;
  /** This power-on — see `bootIdentity`. Null when it cannot be told. */
  boot: string | null;
  /** The power-on this already answered for, remembered on disk. */
  lastAutoStartedBoot: string | null;
  /** Today, by `localDay` — the day the timer display counts from. */
  today: string;
  /** The day this already answered for, remembered on disk. */
  lastAutoStartedDay: string | null;
  signedIn: boolean;
  /** A timer already running anywhere — this device, the web, another machine. */
  timerRunning: boolean;
  /** An idle stretch waiting to be kept or discarded: that question comes first. */
  awaitingIdleAnswer: boolean;
  /** A timer left running by a crash, waiting to be kept or ended: likewise. */
  awaitingRecoveredAnswer: boolean;
}

/**
 * `spend` is the one that is easy to miss: do not start, but use the
 * power-on up anyway, so a start something displaced cannot turn up hours
 * later. `wait` spends nothing — signed out, it becomes `start` at the
 * sign-in, which is the whole of "whether logged in or not".
 */
export type AutoStartDecision = 'start' | 'spend' | 'wait';

export function decideAutoStart(input: AutoStartInput): AutoStartDecision {
  if (!input.enabled) return 'wait';
  // A machine at its login screen has not had its chance yet.
  if (!input.signedIn) return 'wait';

  // A working day begins when the machine is turned on, and it also just
  // begins — most people suspend rather than shut down, and a laptop that
  // slept overnight is on the same power-on as yesterday. So either a new
  // day or a new power-on is an occasion, which also means a machine
  // rebooted at lunchtime still gets one.
  const newDay = input.today !== input.lastAutoStartedDay;
  // A boot that cannot be told apart is no evidence either way, so the day
  // alone decides — at most one start, which is the outcome to protect.
  const newBoot =
    input.boot !== null && !isSameBoot(input.boot, input.lastAutoStartedBoot);
  if (!newDay && !newBoot) return 'wait';

  // Spent from here down: a timer announcing that the machine has just
  // come on would be lying by the time any of these clears.
  if (input.timerRunning) return 'spend';
  if (input.awaitingIdleAnswer) return 'spend';
  if (input.awaitingRecoveredAnswer) return 'spend';
  return 'start';
}

/**
 * The calendar day in the machine's own timezone, which is the day the
 * timer display counts from — the renderer's `startOfToday()` draws the
 * same boundary, and the two must agree: "the timer reset to 00:00" and
 * "the timer started itself" are one event to the person watching.
 */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const LINUX_BOOT_ID_PATH = '/proc/sys/kernel/random/boot_id';

/**
 * A counter the kernel bumps on each boot. Undocumented — Microsoft's
 * Memory Management registry page covers only the VA-limit values beside
 * it — but it is the only per-boot identifier Windows exposes without a
 * native addon, and being a counter rather than a time, no clock change
 * can move it. `SystemBootEnvironmentInformation.BootIdentifier` is not an
 * alternative: that GUID names the BCD entry booted, and survives reboots.
 */
export const WINDOWS_BOOT_ID_KEY =
  'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters';

/** The `BootId    REG_DWORD    0x1f` line out of `reg query` output. */
export function parseWindowsBootId(regOutput: string): string | null {
  return /\bBootId\s+REG_DWORD\s+(0x[0-9a-f]+)/i.exec(regOutput)?.[1] ?? null;
}

/**
 * Each platform's own per-boot identifier, where it has one. Exact where
 * it answers, so only a real power-on changes it — and in particular a
 * suspend does not, which matters since a laptop that sleeps overnight
 * must not look like a machine that was rebooted.
 *
 * Linux and macOS both publish one (`boot_id`, `kern.bootsessionuuid`);
 * Windows has only the undocumented counter above.
 */
function readExactBootId(platform: NodeJS.Platform): string | null {
  try {
    if (platform === 'linux') {
      return readFileSync(LINUX_BOOT_ID_PATH, 'utf-8').trim() || null;
    }
    // stderr ignored on both: a probe that finds nothing falls back to the
    // clock, and has no business printing on the way.
    if (platform === 'darwin') {
      return (
        execFileSync('sysctl', ['-n', 'kern.bootsessionuuid'], {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null
      );
    }
    if (platform === 'win32') {
      return parseWindowsBootId(
        execFileSync('reg', ['query', WINDOWS_BOOT_ID_KEY, '/v', 'BootId'], {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      );
    }
  } catch {
    // No such file, no such key, no such tool: the clock answers instead.
  }
  return null;
}

/**
 * Two readings this far apart are two different power-ons. Only the
 * computed form needs it: `uptime()` drifts by a second or so between
 * reads, and a boot time that wobbles would read as a new machine every
 * launch. Generous against that, and still far below any real gap between
 * turning a machine off and on again.
 */
const SAME_BOOT_TOLERANCE_MS = 2 * 60 * 1000;

export interface BootIdentitySources {
  platform?: NodeJS.Platform;
  /** Overrides the per-platform read in tests. */
  readBootId?: () => string | null;
  uptimeSeconds?: () => number;
  nowMs?: () => number;
}

/**
 * Something that changes when the machine is turned on, and not before.
 *
 * An exact per-boot id where the platform publishes one (see
 * `readExactBootId`). Where none answers, the boot time is worked out from
 * the clock and the uptime, and `isSameBoot` absorbs the wobble that
 * leaves. That fallback is a last resort rather than a second-best:
 * `os.uptime()` is `now - kern.boottime` on macOS, and a stepped clock
 * moves `kern.boottime` by the same delta (XNU's
 * `clock_set_calendar_microtime` adjusts it deliberately), so a big enough
 * NTP correction reads as a fresh power-on. On Windows it is
 * `GetTickCount64()`, which counts time spent asleep and hibernating —
 * including, with Fast Startup, time the machine was "off" — so a
 * power-on may not move it at all.
 */
export function bootIdentity(sources: BootIdentitySources = {}): string | null {
  const read =
    sources.readBootId ??
    (() => readExactBootId(sources.platform ?? process.platform));
  let exact: string | null = null;
  try {
    exact = read();
  } catch {
    exact = null;
  }
  if (exact?.trim()) return `id:${exact.trim()}`;

  const seconds = (sources.uptimeSeconds ?? uptime)();
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const bootedAtMs = (sources.nowMs ?? Date.now)() - seconds * 1000;
  return `at:${Math.round(bootedAtMs)}`;
}

/** Whether two readings describe the same power-on. */
export function isSameBoot(boot: string, remembered: string | null): boolean {
  if (remembered === null) return false;
  // An exact id is exact: only a reboot changes it.
  if (boot.startsWith('id:') || remembered.startsWith('id:')) {
    return boot === remembered;
  }
  const a = Number(boot.slice('at:'.length));
  const b = Number(remembered.slice('at:'.length));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= SAME_BOOT_TOLERANCE_MS;
}
