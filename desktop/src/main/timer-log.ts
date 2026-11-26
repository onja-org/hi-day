import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type TimerLogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * What happened to the timer's offline queue, on disk, one JSON line per
 * event: actions queued, each attempt and its verdict, refusals, sleeps
 * and wakes. Lost time was otherwise only explainable by reproducing it,
 * since nothing recorded which start went missing or why a stop was
 * refused. Ids only — never a project name or anything typed.
 *
 * `logs/timer.log` in the app's data folder; past `maxBytes` it moves to
 * `timer.log.1`, so the two together stay small. Never throws: a log that
 * cannot be written must not stop the timer.
 */
export class TimerLog {
  private readonly dir: string;
  private readonly path: string;

  constructor(
    userDataDir: string,
    private readonly now: () => Date = () => new Date(),
    private readonly maxBytes = 1_000_000,
  ) {
    this.dir = join(userDataDir, 'logs');
    this.path = join(this.dir, 'timer.log');
  }

  write(event: string, fields: TimerLogFields = {}): void {
    // Its own time and name last, so a field of the same name cannot
    // overwrite them — a queued action's time went out as "at" once.
    const line = JSON.stringify({ ...fields, at: this.now().toISOString(), event });
    console.log(`[timer-log] ${line}`);
    try {
      mkdirSync(this.dir, { recursive: true });
      this.rotateIfFull();
      appendFileSync(this.path, `${line}\n`, 'utf-8');
    } catch {
      // Logged to the console above; the file is a convenience.
    }
  }

  private rotateIfFull(): void {
    try {
      if (statSync(this.path).size < this.maxBytes) return;
    } catch {
      return; // No file yet.
    }
    renameSync(this.path, `${this.path}.1`);
  }
}
