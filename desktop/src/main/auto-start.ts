import { readFileSync } from 'node:fs';
import { uptime } from 'node:os';

/**
 * Starting the timer by itself when the machine is turned on, for someone
 * who has asked for it (Preferences → "Start timer when the computer
 * starts"). Once per power-on, never per app launch: the agent relaunches
 * itself after a crash and after an update, and neither of those is a
 * working day beginning.
 *
 * The decision is pure so it can be read in one place and tested by table;
 * main holds the state it needs and the renderer does the starting, since
 * there must never be a second way to start a timer.
 */
export interface AutoStartInput {
  /** The preference. Off until somebody turns it on. */
  enabled: boolean;
  /** This power-on — see `bootIdentity`. Null when it cannot be told. */
  boot: string | null;
  /** The power-on a timer was last started for, remembered on disk. */
  lastAutoStartedBoot: string | null;
  signedIn: boolean;
  /** A timer already running anywhere — this device, the web, another machine. */
  timerRunning: boolean;
  /** An idle stretch waiting to be kept or discarded: that question comes first. */
  awaitingIdleAnswer: boolean;
  /** A timer left running by a crash, waiting to be kept or ended: likewise. */
  awaitingRecoveredAnswer: boolean;
}

export function shouldAutoStart(input: AutoStartInput): boolean {
  if (!input.enabled) return false;
  // Nothing to start against, and nothing to start it with.
  if (!input.signedIn) return false;
  // Unknown is not "new": without a way to tell power-ons apart this would
  // start a timer on every launch, which is the one outcome to avoid.
  if (input.boot === null) return false;
  if (isSameBoot(input.boot, input.lastAutoStartedBoot)) return false;
  if (input.timerRunning) return false;
  if (input.awaitingIdleAnswer) return false;
  if (input.awaitingRecoveredAnswer) return false;
  return true;
}

export const LINUX_BOOT_ID_PATH = '/proc/sys/kernel/random/boot_id';

/**
 * Two readings this far apart are two different power-ons. Only the
 * computed form needs it: `uptime()` drifts by a second or so between
 * reads, and a boot time that wobbles would read as a new machine every
 * launch. Generous against that, and still far below any real gap between
 * turning a machine off and on again.
 */
const SAME_BOOT_TOLERANCE_MS = 2 * 60 * 1000;

export interface BootIdentitySources {
  readBootId?: () => string;
  uptimeSeconds?: () => number;
  nowMs?: () => number;
}

/**
 * Something that changes when the machine is turned on, and not before.
 *
 * Linux publishes exactly that (`/proc/sys/kernel/random/boot_id`), and it
 * is unaffected by suspending — which matters, since a laptop that sleeps
 * overnight must not look like a machine that was rebooted. Elsewhere the
 * boot time is worked out from the clock and the uptime, which is exact on
 * macOS (`kern.boottime`) and tick-based on Windows; `isSameBoot` absorbs
 * the wobble that leaves.
 */
export function bootIdentity(sources: BootIdentitySources = {}): string | null {
  const readBootId =
    sources.readBootId ?? (() => readFileSync(LINUX_BOOT_ID_PATH, 'utf-8'));
  try {
    const id = readBootId().trim();
    if (id) return `id:${id}`;
  } catch {
    // Not Linux, or the file cannot be read: the clock answers instead.
  }

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
