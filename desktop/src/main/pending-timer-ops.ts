import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TimeEntry, TrackingResult } from './api-client';

const FILE_NAME = 'pending-timer-ops.json';

export type PendingOp =
  | { type: 'stop'; at: string }
  | { type: 'start'; at: string; projectId: string | null; taskId: string | null };

export interface PendingTimerClient {
  pauseTimer(deviceToken: string): Promise<TrackingResult<TimeEntry>>;
  stopTimer(deviceToken: string, endedAt?: string): Promise<TrackingResult<TimeEntry>>;
  startTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    startedAt?: string,
  ): Promise<TrackingResult<TimeEntry>>;
  switchTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
  ): Promise<TrackingResult<TimeEntry>>;
}

/** A transport failure: the server never answered, so the action can wait. */
function isOffline<T>(result: TrackingResult<T>): boolean {
  return !result.ok && result.status === undefined && !result.unauthorized;
}

/**
 * Pause, start and switch while the server can't be reached. Pausing ends
 * the entry (the backend's `pause` is a stop), so each of these reduces to
 * "stop at T" and/or "start at T"; they are recorded in order, persisted so
 * a quit or crash doesn't lose them, and replayed with their original times
 * once the server is reachable — so hours land when the person pressed the
 * button, not when the connection came back.
 */
export class PendingTimerOps {
  /** The live entry as last seen, so an offline action can answer from it. */
  private current: TimeEntry | null = null;

  constructor(private readonly userDataDir: string) {}

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
    this.current = entry;
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
   * timer, or the server still sees the old entry. Returns true when nothing
   * is left waiting.
   */
  async flush(deviceToken: string, client: PendingTimerClient): Promise<boolean> {
    const ops = this.load();
    while (ops.length > 0) {
      const op = ops[0];
      const result =
        op.type === 'stop'
          ? await client.stopTimer(deviceToken, op.at)
          : await client.startTimer(deviceToken, op.projectId, op.taskId, op.at);
      if (isOffline(result)) break;
      if (result.ok && result.data && !result.data.endedAt) this.current = result.data;
      ops.shift();
      // The server answered with a rejection, so retrying can't help. A
      // start that never happened must not leave its matching stop to end
      // some other entry.
      if (!result.ok && op.type === 'start' && ops[0]?.type === 'stop') ops.shift();
      this.save(ops);
    }
    this.save(ops);
    return ops.length === 0;
  }

  async pause(deviceToken: string, client: PendingTimerClient): Promise<TrackingResult<TimeEntry>> {
    const at = new Date().toISOString();
    // Anything waiting happened before this click, and must reach the server first.
    if (this.hasPending() && !(await this.flush(deviceToken, client))) {
      return this.queueStop(at);
    }
    const result = await client.pauseTimer(deviceToken);
    if (result.ok) this.current = null;
    return isOffline(result) ? this.queueStop(at) : result;
  }

  private queueStop(at: string): TrackingResult<TimeEntry> {
    if (!this.current) return { ok: false, message: 'No timer is currently running.' };
    this.save([...this.load(), { type: 'stop', at }]);
    const entry = { ...this.current, endedAt: at };
    this.current = null;
    return { ok: true, data: entry };
  }

  async start(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    client: PendingTimerClient,
    startedAt?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = startedAt ?? new Date().toISOString();
    if (this.hasPending() && !(await this.flush(deviceToken, client))) {
      return this.queueStart(projectId, taskId, at);
    }
    const result = await client.startTimer(deviceToken, projectId, taskId, startedAt);
    return isOffline(result) ? this.queueStart(projectId, taskId, at) : result;
  }

  private queueStart(projectId: string | null, taskId: string | null, at: string): TrackingResult<TimeEntry> {
    this.save([...this.load(), { type: 'start', at, projectId, taskId }]);
    this.current = this.localEntry(projectId, taskId, at);
    return { ok: true, data: this.current };
  }

  async switchTo(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    client: PendingTimerClient,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = new Date().toISOString();
    if (this.hasPending() && !(await this.flush(deviceToken, client))) {
      return this.queueSwitch(projectId, taskId, at);
    }
    const result = await client.switchTimer(deviceToken, projectId, taskId);
    return isOffline(result) ? this.queueSwitch(projectId, taskId, at) : result;
  }

  /** An offline switch is a stop and a start at the same instant. */
  private queueSwitch(projectId: string | null, taskId: string | null, at: string): TrackingResult<TimeEntry> {
    if (!this.current) return this.queueStart(projectId, taskId, at);
    this.save([
      ...this.load(),
      { type: 'stop', at },
      { type: 'start', at, projectId, taskId },
    ]);
    this.current = this.localEntry(projectId, taskId, at);
    return { ok: true, data: this.current };
  }
}
