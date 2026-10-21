import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTransportFailure } from './api-client';
import type { TimeEntry, TrackingResult } from './api-client';

const FILE_NAME = 'pending-timer-ops.json';

export type PendingOp =
  | { type: 'stop'; at: string; opId?: string }
  | {
      type: 'start';
      at: string;
      projectId: string | null;
      taskId: string | null;
      opId?: string;
    };

/**
 * An operation the server answered by refusing it — the Project was
 * archived while the device was away, a work-time limit was reached, or
 * the start was older than a device may reach back. The hours are gone
 * either way; this exists so the person is told rather than left to
 * discover a hole in their timesheet.
 */
export interface RefusedOp {
  op: PendingOp;
  message: string;
}

export interface FlushResult {
  /** True when nothing is left waiting — the queue is empty. */
  settled: boolean;
  refused: RefusedOp[];
}

export interface PendingTimerClient {
  pauseTimer(deviceToken: string): Promise<TrackingResult<TimeEntry>>;
  stopTimer(
    deviceToken: string,
    endedAt?: string,
    opId?: string,
  ): Promise<TrackingResult<TimeEntry>>;
  startTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    startedAt?: string,
    opId?: string,
  ): Promise<TrackingResult<TimeEntry>>;
  switchTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
  ): Promise<TrackingResult<TimeEntry>>;
}

/**
 * Where the entry believed to be running is kept between calls.
 *
 * It used to be a field on `PendingTimerOps`, which meant it lived only as
 * long as the process. Offline that is the difference between being able
 * to stop and not: with nothing running in memory, `queueStop` has no
 * entry to end and answers "No timer is currently running" to somebody
 * looking straight at a ticking clock. Behind an interface so the main
 * process can back it with the offline cache, while tests keep the cheap
 * in-memory one.
 */
export interface RunningEntryStore {
  read(): TimeEntry | null;
  write(entry: TimeEntry | null): void;
}

class InMemoryRunningEntryStore implements RunningEntryStore {
  private entry: TimeEntry | null = null;

  read(): TimeEntry | null {
    return this.entry;
  }

  write(entry: TimeEntry | null): void {
    this.entry = entry;
  }
}

/**
 * Pause, start and switch while the server can't be reached. Pausing ends
 * the entry (the backend's `pause` is a stop), so each of these reduces to
 * "stop at T" and/or "start at T"; they are recorded in order, persisted so
 * a quit or crash doesn't lose them, and replayed with their original times
 * once the server is reachable — so hours land when the person pressed the
 * button, not when the connection came back.
 *
 * Each carries an `opId` generated once, when the operation is queued, and
 * reused on every replay of it. A reconnect that dies after the server
 * committed but before the response arrived would otherwise send the same
 * start again and write the hours twice; the server recognises the id and
 * returns what it already wrote (see docs/adr/0025-...).
 */
export class PendingTimerOps {
  constructor(
    private readonly userDataDir: string,
    /** Defaults to memory-only, which is enough for a single session. */
    private readonly running: RunningEntryStore = new InMemoryRunningEntryStore(),
  ) {}

  private get filePath(): string {
    return join(this.userDataDir, FILE_NAME);
  }

  load(): PendingOp[] {
    try {
      if (!existsSync(this.filePath)) return [];
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as unknown;
      return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
    } catch {
      return [];
    }
  }

  private save(ops: PendingOp[]): void {
    if (ops.length === 0) {
      if (existsSync(this.filePath)) unlinkSync(this.filePath);
      return;
    }
    writeFileSync(this.filePath, JSON.stringify(ops), 'utf-8');
  }

  hasPending(): boolean {
    return this.load().length > 0;
  }

  /** Call with every live entry (or null) the server reports. */
  remember(entry: TimeEntry | null): void {
    this.running.write(entry);
  }

  /** The entry believed to be running — what an offline stop would end. */
  current(): TimeEntry | null {
    return this.running.read();
  }

  private localEntry(projectId: string | null, taskId: string | null, at: string): TimeEntry {
    return {
      id: `offline-${randomUUID()}`,
      projectId,
      taskId,
      startedAt: at,
      endedAt: null,
      pausedAt: null,
      pausedSeconds: 0,
    };
  }

  /**
   * Settles waiting actions in order. Must run before anything that starts a
   * timer, or the server still sees the old entry. Reports anything the
   * server refused, so the person can be told about hours that did not land
   * rather than finding the gap themselves later.
   */
  async flush(
    deviceToken: string,
    client: PendingTimerClient,
  ): Promise<FlushResult> {
    const ops = this.load();
    const refused: RefusedOp[] = [];
    while (ops.length > 0) {
      const op = ops[0];
      const result =
        op.type === 'stop'
          ? await client.stopTimer(deviceToken, op.at, op.opId)
          : await client.startTimer(
              deviceToken,
              op.projectId,
              op.taskId,
              op.at,
              op.opId,
            );
      if (isTransportFailure(result)) break;
      if (result.ok && result.data && !result.data.endedAt) {
        this.running.write(result.data);
      }
      // A rejection the server will give again however many times it is
      // asked. The time is lost; saying so is the least that is owed.
      if (!result.ok && !result.unauthorized) {
        refused.push({ op, message: result.message });
      }
      ops.shift();
      // The server answered with a rejection, so retrying can't help. A
      // start that never happened must not leave its matching stop to end
      // some other entry.
      if (!result.ok && op.type === 'start' && ops[0]?.type === 'stop') ops.shift();
      this.save(ops);
    }
    this.save(ops);
    return { settled: ops.length === 0, refused };
  }

  async pause(deviceToken: string, client: PendingTimerClient): Promise<TrackingResult<TimeEntry>> {
    const at = new Date().toISOString();
    // Anything waiting happened before this click, and must reach the server first.
    if (this.hasPending() && !(await this.flush(deviceToken, client)).settled) {
      return this.queueStop(at);
    }
    const result = await client.pauseTimer(deviceToken);
    if (result.ok) this.running.write(null);
    return isTransportFailure(result) ? this.queueStop(at) : result;
  }

  /**
   * Ends the running entry, queueing it like any other action when the
   * server cannot be reached — so a stop survives an outage rather than
   * failing outright, which is what used to happen to an idle discard and
   * to a timer recovered after a crash.
   *
   * `endedAt` is passed to the server only when the caller actually meant
   * to backdate: the backend reads its presence as "this stop was an idle
   * discard" and records it as such, so sending "now" on an ordinary stop
   * would mislabel every one of them. The queued record still needs a
   * concrete instant, and uses now when none was given.
   */
  async stopAt(
    deviceToken: string,
    client: PendingTimerClient,
    endedAt?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = endedAt ?? new Date().toISOString();
    if (this.hasPending() && !(await this.flush(deviceToken, client)).settled) {
      return this.queueStop(at);
    }
    const result = await client.stopTimer(deviceToken, endedAt);
    if (result.ok) this.running.write(null);
    return isTransportFailure(result) ? this.queueStop(at) : result;
  }

  /**
   * Each `queue*` below answers `ok` so the person sees their click take
   * effect, and marks the answer `fromCache` because it did not come from
   * the server. Without that the main process counts a queued action as
   * the server having just replied, and the clock that decides how stale
   * the cache is — and when capture stops trusting its settings — is reset
   * by an action that never left the machine.
   */
  private queueStop(at: string): TrackingResult<TimeEntry> {
    const current = this.running.read();
    if (!current) return { ok: false, message: 'No timer is currently running.' };
    this.save([...this.load(), { type: 'stop', at, opId: randomUUID() }]);
    const entry = { ...current, endedAt: at };
    this.running.write(null);
    return { ok: true, data: entry, fromCache: true };
  }

  async start(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    client: PendingTimerClient,
    startedAt?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = startedAt ?? new Date().toISOString();
    if (this.hasPending() && !(await this.flush(deviceToken, client)).settled) {
      return this.queueStart(projectId, taskId, at);
    }
    const result = await client.startTimer(deviceToken, projectId, taskId, startedAt);
    if (result.ok) this.running.write(result.data);
    return isTransportFailure(result) ? this.queueStart(projectId, taskId, at) : result;
  }

  private queueStart(projectId: string | null, taskId: string | null, at: string): TrackingResult<TimeEntry> {
    this.save([
      ...this.load(),
      { type: 'start', at, projectId, taskId, opId: randomUUID() },
    ]);
    const entry = this.localEntry(projectId, taskId, at);
    this.running.write(entry);
    return { ok: true, data: entry, fromCache: true };
  }

  async switchTo(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    client: PendingTimerClient,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = new Date().toISOString();
    if (this.hasPending() && !(await this.flush(deviceToken, client)).settled) {
      return this.queueSwitch(projectId, taskId, at);
    }
    const result = await client.switchTimer(deviceToken, projectId, taskId);
    if (result.ok) this.running.write(result.data);
    return isTransportFailure(result) ? this.queueSwitch(projectId, taskId, at) : result;
  }

  /** An offline switch is a stop and a start at the same instant. */
  private queueSwitch(projectId: string | null, taskId: string | null, at: string): TrackingResult<TimeEntry> {
    if (!this.running.read()) return this.queueStart(projectId, taskId, at);
    this.save([
      ...this.load(),
      { type: 'stop', at, opId: randomUUID() },
      { type: 'start', at, projectId, taskId, opId: randomUUID() },
    ]);
    const entry = this.localEntry(projectId, taskId, at);
    this.running.write(entry);
    return { ok: true, data: entry, fromCache: true };
  }
}
