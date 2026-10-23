import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * An idle stretch the timer has been stopped for, waiting to be settled —
 * see src/renderer/idle-hold.ts for what happens to it, which this mirrors.
 * Kept on disk because the question outlives a renderer reload, the app
 * relaunching after an update, and a crash: lost, the idle time would
 * simply vanish rather than be kept or discarded.
 */
export interface IdleHold {
  projectId: string | null;
  taskId: string | null;
  idleStartedAt: string;
  returnedAt: string | null;
  reason: 'timeout' | 'sleep';
}

export class IdleHoldStore {
  private readonly path: string;

  constructor(private readonly userDataDir: string) {
    this.path = join(userDataDir, 'idle-hold.json');
  }

  load(): IdleHold | null {
    if (!existsSync(this.path)) return null;
    try {
      return JSON.parse(readFileSync(this.path, 'utf-8')) as IdleHold;
    } catch {
      return null; // A torn write is no hold rather than a crash.
    }
  }

  save(hold: IdleHold): void {
    mkdirSync(this.userDataDir, { recursive: true });
    writeFileSync(this.path, JSON.stringify(hold), 'utf-8');
  }

  clear(): void {
    rmSync(this.path, { force: true });
  }

  /** Records when the person came back — once; a later reading never moves it. */
  markReturned(at: string): IdleHold | null {
    const hold = this.load();
    if (!hold) return null;
    if (hold.returnedAt === null) {
      hold.returnedAt = at;
      this.save(hold);
    }
    return hold;
  }
}

/** Readings older than this say little about when input stopped. */
const MAX_IDLE_READING_AGE_MS = 60_000;

/**
 * When input stopped, from the latest idle reading — for a machine going to
 * sleep, whose stretch counts from there rather than from the sleep itself.
 * Without a recent reading the best that can be said is "now": that only
 * ever under-counts the time away, so it can resume a timer that should
 * have asked, but never asks about time that was really worked.
 */
export function whenInputStopped(
  reading: { seconds: number; atMs: number } | null,
  nowMs: number,
): number {
  if (!reading || nowMs - reading.atMs > MAX_IDLE_READING_AGE_MS) return nowMs;
  return Math.min(nowMs, reading.atMs - reading.seconds * 1000);
}
