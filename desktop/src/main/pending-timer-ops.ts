import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serverVerdict } from './api-client';
import type { TimeEntry, TrackingResult } from './api-client';
import { computeRetryDelayMs } from './offline-queue';

const FILE_NAME = 'pending-timer-ops.json';

/**
 * What a caller gets back when the queue cannot be sent because the
 * session is gone. Carries `unauthorized` so `callDeviceApi` signs out on
 * it exactly as it does for a 401 off the wire — the alternative is a
 * clock ticking in front of somebody whose hours can never land.
 */
const SIGNED_OUT: TrackingResult<never> = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
  unauthorized: true,
  status: 401,
};

export type PendingOp =
  | { type: 'stop'; at: string; opId?: string; owner?: string }
  | {
      type: 'start';
      at: string;
      projectId: string | null;
      taskId: string | null;
      opId?: string;
      owner?: string;
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
  /**
   * The session was refused while replaying. The queue is kept — these
   * are the person's hours and a login brings them back — and the caller
   * is expected to sign out locally rather than retry a dead token every
   * fifteen seconds in silence.
   */
  signedOut: boolean;
}

export interface PendingTimerClient {
  pauseTimer(deviceToken: string, opId?: string): Promise<TrackingResult<TimeEntry>>;
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
 * Where the entry believed to be running is kept between calls. A field
 * on `PendingTimerOps` lived only as long as the process, so offline
 * `queueStop` had no entry to end and answered "No timer is currently
 * running" to somebody watching a ticking clock. Behind an interface so
 * main can back it with the offline cache and tests stay in memory.
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
 * Each carries an `opId` generated once, **before the first attempt**, and
 * reused by the queued copy and every replay of it. A request that dies
 * after the server committed but before the response arrived would
 * otherwise send the same start again and write the hours twice; the
 * server recognises the id and returns what it already wrote (see
 * docs/adr/0025-...).
 *
 * Minting it at queue time instead — which is what this did — left the
 * first attempt anonymous, so the one case the id exists for was the one
 * case it could not cover. A five-second timeout (`REQUEST_TIMEOUT_MS`) on
 * a request the server had already applied queued a *differently* named
 * copy of it, and the replay met a 409 for a start or a 404 for a stop and
 * told the person their hours could not be saved. They had been saved.
 */
export class PendingTimerOps {
  /** Consecutive replays the server answered with "not now". */
  private attempts = 0;
  /** Nothing is sent before this, so a struggling server is left alone. */
  private nextAttemptAt = 0;

  /** Who is logged in now, or null for nobody. Unset, every op is one owner's. */
  private ownerSource: (() => string | null) | null = null;

  private readonly now: () => number;
  private readonly random: () => number;

  constructor(
    private readonly userDataDir: string,
    /** Defaults to memory-only, which is enough for a single session. */
    private readonly running: RunningEntryStore = new InMemoryRunningEntryStore(),
    options: {
      now?: () => number;
      random?: () => number;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  private get filePath(): string {
    return join(this.userDataDir, FILE_NAME);
  }

  /**
   * Ties each queued action to whoever took it, and replays only the
   * actions of whoever is logged in now. One Device serves everybody on a
   * machine, so without this A's offline start and stop would replay
   * under B's token and become hours on B's timesheet.
   */
  setOwnerSource(source: () => string | null): void {
    this.ownerSource = source;
  }

  /** `undefined` when nobody is logged in; null when no source is set. */
  private currentOwner(): string | null | undefined {
    if (!this.ownerSource) return null;
    return this.ownerSource() ?? undefined;
  }

  private stamp<T extends PendingOp>(op: T): T {
    const owner = this.currentOwner();
    return owner ? { ...op, owner } : op;
  }

  private loadAll(): PendingOp[] {
    try {
      if (!existsSync(this.filePath)) return [];
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as unknown;
      return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
    } catch {
      return [];
    }
  }

  /** The actions of whoever is logged in now — nobody's when nobody is. */
  load(): PendingOp[] {
    const owner = this.currentOwner();
    if (owner === undefined) return [];
    return this.loadAll().filter((op) => (op.owner ?? null) === owner);
  }

  /**
   * Drops every action not taken by `owner` — called when `owner` logs in,
   * so nobody else's can ever be replayed. Returns how many went.
   */
  discardOtherOwners(owner: string): number {
    const all = this.loadAll();
    const kept = all.filter((op) => op.owner === owner);
    this.save(kept);
    return all.length - kept.length;
  }

  /**
   * Drops every queued action, whoever took it — on logout and remote
   * sign-out, once nothing more can be sent. Returns how many went.
   */
  discardAll(): number {
    const count = this.loadAll().length;
    this.save([]);
    return count;
  }

  /** Gives actions written before owners were recorded to `owner`. */
  adoptUnowned(owner: string): void {
    const all = this.loadAll();
    if (!all.some((op) => !op.owner)) return;
    this.save(all.map((op) => (op.owner ? op : { ...op, owner })));
  }

  /**
   * Writes `ops` as the whole queue. Every caller passes what `load`
   * returned plus or minus its own change, so another owner's actions are
   * dropped here — by then the person logged in is not them, and theirs
   * must never be replayed for somebody else.
   */
  private save(ops: PendingOp[]): void {
    if (ops.length === 0) {
      if (existsSync(this.filePath)) unlinkSync(this.filePath);
      return;
    }
    writeFileSync(this.filePath, JSON.stringify(ops), 'utf-8');
  }

  /**
   * Whether a replay may be attempted now. Only an *answered* refusal
   * sets a wait — a server that cannot be reached is an outage, and the
   * fifteen-second tick is how a reconnect gets noticed at all.
   */
  isDue(): boolean {
    return this.now() >= this.nextAttemptAt;
  }

  /** Drops the wait: somebody pressing Quit is asking for one last try. */
  retryNow(): void {
    this.nextAttemptAt = 0;
  }

  private backOff(): void {
    this.attempts += 1;
    this.nextAttemptAt =
      this.now() +
      computeRetryDelayMs(this.attempts, undefined, undefined, this.random);
  }

  /** An op settled either way is progress, and the queue is moving again. */
  private progressed(): void {
    this.attempts = 0;
    this.nextAttemptAt = 0;
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
   *
   * An operation leaves the queue only on a verdict — accepted, or refused
   * in terms the server would repeat. Everything else keeps its place:
   * this used to drop anything carrying an HTTP status at all, so a deploy
   * or an overloaded minute during a reconnect deleted hours somebody had
   * really worked, and a revoked session deleted them without a word.
   */
  async flush(
    deviceToken: string,
    client: PendingTimerClient,
  ): Promise<FlushResult> {
    const ops = this.load();
    const refused: RefusedOp[] = [];
    if (ops.length === 0) return { settled: true, refused, signedOut: false };
    if (!this.isDue()) return { settled: false, refused, signedOut: false };

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
      const verdict = serverVerdict(result);

      // Not this session's to send any more — but still this person's, and
      // a login brings the token back. `owner` is what stops them reaching
      // the next person to use the machine.
      if (verdict === 'signedOut') {
        this.save(ops);
        return { settled: false, refused, signedOut: true };
      }

      if (verdict === 'undecided') {
        // A server that answered — 503, 502, 429 — is asking to be left
        // alone, and every device that failed with it is about to try
        // again at the same moment. One that never answered is an outage,
        // where the fifteen-second tick is the only reconnect detector.
        if (!result.ok && result.status !== undefined) this.backOff();
        break;
      }

      this.progressed();
      if (result.ok && result.data && !result.data.endedAt) {
        this.running.write(result.data);
      }
      // A rejection the server will give again however many times it is
      // asked. The time is lost; saying so is the least that is owed.
      if (!result.ok) refused.push({ op, message: result.message });
      ops.shift();
      // The server answered with a rejection, so retrying can't help. A
      // start that never happened must not leave its matching stop to end
      // some other entry.
      if (!result.ok && op.type === 'start' && ops[0]?.type === 'stop') ops.shift();
      this.save(ops);
    }
    this.save(ops);
    return { settled: ops.length === 0, refused, signedOut: false };
  }

  /**
   * Replays what is waiting before an action of this person's own, which
   * every public method here has to do: a lone stop sent ahead of a queued
   * start would end whatever the server still thinks is running. Answers
   * with what the caller should return instead of acting, or null to go on.
   */
  private async settleFirst(
    deviceToken: string,
    client: PendingTimerClient,
    queue: () => TrackingResult<TimeEntry>,
  ): Promise<TrackingResult<TimeEntry> | null> {
    if (!this.hasPending()) return null;
    const { settled, signedOut } = await this.flush(deviceToken, client);
    // Queueing this click would start a clock in front of somebody whose
    // session is already gone, and nothing it recorded could ever land.
    if (signedOut) return SIGNED_OUT;
    return settled ? null : queue();
  }

  async pause(deviceToken: string, client: PendingTimerClient): Promise<TrackingResult<TimeEntry>> {
    const at = new Date().toISOString();
    // Anything waiting happened before this click, and must reach the server first.
    const opId = randomUUID();
    const answer = await this.settleFirst(deviceToken, client, () => this.queueStop(at, opId));
    if (answer) return answer;
    const result = await client.pauseTimer(deviceToken, opId);
    if (result.ok) this.running.write(null);
    return serverVerdict(result) === 'undecided' ? this.queueStop(at, opId) : result;
  }

  /**
   * Ends the running entry, queueing it when the server cannot be reached
   * — an idle discard used to fail outright instead. `endedAt` reaches
   * the server only when the caller meant to backdate, since the backend
   * reads its presence as "idle discard"; the queued record still needs a
   * concrete instant and uses now.
   */
  async stopAt(
    deviceToken: string,
    client: PendingTimerClient,
    endedAt?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = endedAt ?? new Date().toISOString();
    const opId = randomUUID();
    const answer = await this.settleFirst(deviceToken, client, () => this.queueStop(at, opId));
    if (answer) return answer;
    const result = await client.stopTimer(deviceToken, endedAt, opId);
    if (result.ok) this.running.write(null);
    return serverVerdict(result) === 'undecided' ? this.queueStop(at, opId) : result;
  }

  /**
   * Ends the timer, writing the record to disk *before* the network — for
   * the one caller that gets no second chance.
   *
   * `pause` asks the server first and writes only once that has failed,
   * which is fine while the process survives to reconcile it. On quit,
   * suspend and shutdown it does not: being killed between asking and
   * writing loses the stop entirely, and the person comes back to a timer
   * that ran all night. Write-ahead costs nothing if killed, since the
   * next launch replays it at the time it really happened; the send still
   * follows, and clears the record if it lands.
   */
  async pauseDurably(
    deviceToken: string,
    client: PendingTimerClient,
    /**
     * Ends the entry here rather than now — when input stopped, for a
     * machine going to sleep mid-idle — and as a stop, since only a stop
     * carries a time.
     */
    endedAt?: string,
  ): Promise<TrackingResult<TimeEntry>> {
    const current = this.running.read();
    // Nothing is known to be running here, but the server may still hold
    // an entry this device never saw stop. Asking is what this did
    // unconditionally before, and is still the only way to catch that.
    if (!current) return await this.pause(deviceToken, client);

    const at = endedAt ?? new Date().toISOString();
    const opId = randomUUID();
    const waiting = this.load();
    this.save([...waiting, this.stamp({ type: 'stop', at, opId })]);
    this.running.write(null);
    const ended: TimeEntry = { ...current, endedAt: at };

    // Anything already queued happened before this and has to reach the
    // server first, so a lone pause call would close the wrong entry.
    if (waiting.length > 0) {
      const { settled } = await this.flush(deviceToken, client);
      return settled ? { ok: true, data: ended } : { ok: true, data: ended, fromCache: true };
    }

    const result = endedAt
      ? await client.stopTimer(deviceToken, endedAt, opId)
      : await client.pauseTimer(deviceToken, opId);
    if (!result.ok) return { ok: true, data: ended, fromCache: true };
    // It landed, so the record written ahead of it has nothing left to do.
    this.save(this.load().filter((op) => op.opId !== opId));
    return result;
  }

  /**
   * Each `queue*` answers `ok` so the click takes effect, and marks it
   * `fromCache` because it did not come from the server — without which
   * main counts a queued action as a reply and resets the clock that
   * decides how stale the cache is.
   */
  private queueStop(at: string, opId = randomUUID()): TrackingResult<TimeEntry> {
    const current = this.running.read();
    if (!current) return { ok: false, message: 'No timer is currently running.' };
    this.save([...this.load(), this.stamp({ type: 'stop', at, opId })]);
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
    const opId = randomUUID();
    const answer = await this.settleFirst(deviceToken, client, () =>
      this.queueStart(projectId, taskId, at, opId),
    );
    if (answer) return answer;
    const result = await client.startTimer(deviceToken, projectId, taskId, startedAt, opId);
    if (result.ok) this.running.write(result.data);
    return serverVerdict(result) === 'undecided'
      ? this.queueStart(projectId, taskId, at, opId)
      : result;
  }

  private queueStart(
    projectId: string | null,
    taskId: string | null,
    at: string,
    opId = randomUUID(),
  ): TrackingResult<TimeEntry> {
    this.save([
      ...this.load(),
      this.stamp({ type: 'start', at, projectId, taskId, opId }),
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
    const answer = await this.settleFirst(deviceToken, client, () =>
      this.queueSwitch(projectId, taskId, at),
    );
    if (answer) return answer;
    const result = await client.switchTimer(deviceToken, projectId, taskId);
    if (result.ok) this.running.write(result.data);
    return serverVerdict(result) === 'undecided'
      ? this.queueSwitch(projectId, taskId, at)
      : result;
  }

  /** An offline switch is a stop and a start at the same instant. */
  private queueSwitch(projectId: string | null, taskId: string | null, at: string): TrackingResult<TimeEntry> {
    if (!this.running.read()) return this.queueStart(projectId, taskId, at);
    this.save([
      ...this.load(),
      this.stamp({ type: 'stop', at, opId: randomUUID() }),
      this.stamp({ type: 'start', at, projectId, taskId, opId: randomUUID() }),
    ]);
    const entry = this.localEntry(projectId, taskId, at);
    this.running.write(entry);
    return { ok: true, data: entry, fromCache: true };
  }
}
