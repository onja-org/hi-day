import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serverVerdict } from './api-client';
import type { TimeEntry, TrackingResult } from './api-client';
import { computeRetryDelayMs } from './offline-queue';
import type { TimerLogFields } from './timer-log';

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

/** `undefined` for an entry invented offline: it names no row the server has. */
function serverEntryId(entry: TimeEntry): string | undefined {
  return entry.id.startsWith('offline-') ? undefined : entry.id;
}

/**
 * A stop ending `current`: by its server id, or — for an entry invented
 * offline, which has none yet — by the local id its queued start carries,
 * swapped for the server's once that start lands (see `flushOnce`).
 */
function stopOf(current: TimeEntry, at: string, opId: string): PendingOp {
  const entryId = serverEntryId(current);
  return entryId
    ? { type: 'stop', at, opId, entryId }
    : { type: 'stop', at, opId, localEntryId: current.id };
}

export type PendingOp =
  | {
      type: 'stop';
      at: string;
      opId?: string;
      owner?: string;
      /** The entry this stop ends — see `StopTimeEntryDto.entryId`. */
      entryId?: string;
      /**
       * The entry this stop ends, when it was started offline and the server
       * has not named it yet: the `localEntryId` of the queued start.
       */
      localEntryId?: string;
    }
  | {
      type: 'start';
      at: string;
      projectId: string | null;
      taskId: string | null;
      opId?: string;
      owner?: string;
      /** So an offline idle Keep still reports its kept stretch on replay. */
      idleSeconds?: number;
      /** The `offline-…` id of the entry this start stands for until it lands. */
      localEntryId?: string;
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
    entryId?: string,
  ): Promise<TrackingResult<TimeEntry>>;
  startTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    startedAt?: string,
    opId?: string,
    idleSeconds?: number,
  ): Promise<TrackingResult<TimeEntry>>;
  switchTimer(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    stopOpId?: string,
    startOpId?: string,
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

  /** The flush under way, which any other caller waits on — see `flush`. */
  private inFlight: Promise<FlushResult> | null = null;
  private refusedListener: ((refused: RefusedOp[]) => void) | null = null;
  private log: (event: string, fields: TimerLogFields) => void = () => undefined;

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

  /** Where each queued action, attempt and verdict is recorded — see `TimerLog`. */
  setLog(log: (event: string, fields: TimerLogFields) => void): void {
    this.log = log;
  }

  /** `undefined` when nobody is logged in; null when no source is set. */
  private currentOwner(): string | null | undefined {
    if (!this.ownerSource) return null;
    return this.ownerSource() ?? undefined;
  }

  private stamp<T extends PendingOp>(op: T): T {
    this.log('queued', {
      type: op.type,
      opAt: op.at,
      opId: op.opId,
      entryId: op.type === 'stop' ? op.entryId : undefined,
      localEntryId: op.localEntryId,
    });
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
   * Who is told about operations the server refused. Set once by main, so
   * a refusal is reported exactly once whichever caller's flush met it —
   * one met on the way to a click used to be dropped in silence, since only
   * the sync loop passed `refused` on.
   */
  onRefused(listener: (refused: RefusedOp[]) => void): void {
    this.refusedListener = listener;
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
   *
   * One at a time: a caller arriving while a flush is under way waits for
   * that one rather than sending the same operations alongside it. Waking
   * offline, the sync loop's flush and the wake restart's own overlapped,
   * and the restart's start was lost — see `flushOnce`.
   */
  async flush(
    deviceToken: string,
    client: PendingTimerClient,
  ): Promise<FlushResult> {
    this.inFlight ??= this.flushOnce(deviceToken, client).finally(() => {
      this.inFlight = null;
    });
    return await this.inFlight;
  }

  /**
   * The queue is read from disk before every step and an operation leaves
   * it by `opId`, never by writing back the copy this started with: an
   * action queued while a send was in flight — the start a wake restart
   * queues while the server is still unreachable — was otherwise erased by
   * that write, and the timer cleared with nobody told.
   */
  private async flushOnce(
    deviceToken: string,
    client: PendingTimerClient,
  ): Promise<FlushResult> {
    const refused: RefusedOp[] = [];
    this.giveEveryOpAnId();
    if (this.load().length === 0) return { settled: true, refused, signedOut: false };
    if (!this.isDue()) return { settled: false, refused, signedOut: false };

    try {
      for (let ops = this.load(); ops.length > 0; ops = this.load()) {
        const op = ops[0];
        const opId = op.opId as string;
        // Its start is no longer queued, so it never reached the server:
        // there is no entry for this to end, and sent bare it would end
        // whatever else this device has running, or be refused.
        if (op.type === 'stop' && op.localEntryId && !op.entryId) {
          this.log('dropped', {
            opId,
            localEntryId: op.localEntryId,
            reason: 'its start never reached the server',
          });
          this.remove([opId]);
          continue;
        }
        const result =
          op.type === 'stop'
            ? await this.sendStop(client, deviceToken, op.at, opId, op.entryId)
            : await this.sendStart(
                client,
                deviceToken,
                op.projectId,
                op.taskId,
                op.at,
                opId,
                op.idleSeconds,
              );
        const verdict = serverVerdict(result);
        this.log('sent', {
          type: op.type,
          opAt: op.at,
          opId,
          entryId: op.type === 'stop' ? op.entryId : undefined,
          localEntryId: op.localEntryId,
          verdict,
          status: result.ok ? undefined : result.status,
          message: result.ok ? undefined : result.message,
        });

        // Not this session's to send any more — but still this person's, and
        // a login brings the token back. `owner` is what stops them reaching
        // the next person to use the machine.
        if (verdict === 'signedOut') {
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
        const settled = [opId];
        if (op.type === 'start' && op.localEntryId) {
          // Its stops can name the entry now. A refused start never made
          // one, so they are settled with it rather than sent to end some
          // other entry — "retrying can't help" holds for them too.
          if (result.ok) {
            this.log('named', { localEntryId: op.localEntryId, entryId: result.data.id });
            this.nameEntry(op.localEntryId, result.data.id);
          } else {
            const stops = this.stopsOf(op.localEntryId);
            for (const stopId of stops) {
              this.log('dropped', { opId: stopId, reason: 'its start was refused' });
            }
            settled.push(...stops);
          }
        } else if (!result.ok && op.type === 'start') {
          // Queued before starts carried a local id: its stop is the next op.
          const next = this.load().find((queued) => queued.opId !== opId);
          if (next?.type === 'stop' && next.opId) settled.push(next.opId);
        }
        this.remove(settled);
      }
    } finally {
      if (refused.length > 0) this.refusedListener?.(refused);
    }
    return { settled: this.load().length === 0, refused, signedOut: false };
  }

  /**
   * Names any operation queued before every one carried an id, so each can
   * leave the queue by its own id. Written once, before anything is sent,
   * so a replay reuses the name rather than minting a fresh one each time.
   */
  private giveEveryOpAnId(): void {
    const all = this.loadAll();
    if (all.every((op) => op.opId)) return;
    this.save(all.map((op) => (op.opId ? op : { ...op, opId: randomUUID() })));
  }

  /** Points every queued stop of an offline-started entry at the server's id for it. */
  private nameEntry(localEntryId: string, entryId: string): void {
    this.save(
      this.load().map((op) =>
        op.type === 'stop' && op.localEntryId === localEntryId
          ? { ...op, entryId, localEntryId: undefined }
          : op,
      ),
    );
  }

  /** The ids of the queued stops ending this offline-started entry. */
  private stopsOf(localEntryId: string): string[] {
    return this.load()
      .filter((op) => op.type === 'stop' && op.localEntryId === localEntryId && op.opId)
      .map((op) => op.opId as string);
  }

  /** Takes these operations out of the queue as it stands on disk now. */
  private remove(opIds: string[]): void {
    this.save(this.load().filter((op) => !op.opId || !opIds.includes(op.opId)));
  }

  /**
   * The backend validates with `forbidNonWhitelisted`, so a field it has
   * never heard of is a 400 — and 400 is in `REJECTION_STATUSES`, so the
   * queue would drop the start and its paired stop and report the hours
   * refused. An agent ahead of its backend would lose a whole idle-Keep
   * restart rather than the annotation on it. So one retry without the
   * field, same `opId` so nothing double-counts; hours matter more than
   * how much of them was idle.
   */
  private async sendStart(
    client: PendingTimerClient,
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    startedAt: string | undefined,
    opId: string,
    idleSeconds: number | undefined,
  ): Promise<TrackingResult<TimeEntry>> {
    const result = await client.startTimer(
      deviceToken,
      projectId,
      taskId,
      startedAt,
      opId,
      idleSeconds,
    );
    if (idleSeconds === undefined || result.ok || result.status !== 400) {
      return result;
    }
    return await client.startTimer(
      deviceToken,
      projectId,
      taskId,
      startedAt,
      opId,
      undefined,
    );
  }

  /**
   * As `sendStart`: a backend that has not heard of `entryId` answers 400,
   * which the queue would read as a refusal and report as lost hours.
   */
  private async sendStop(
    client: PendingTimerClient,
    deviceToken: string,
    at: string | undefined,
    opId: string | undefined,
    entryId: string | undefined,
  ): Promise<TrackingResult<TimeEntry>> {
    const result = await client.stopTimer(deviceToken, at, opId, entryId);
    if (entryId === undefined || result.ok || result.status !== 400) {
      return result;
    }
    return await client.stopTimer(deviceToken, at, opId, undefined);
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
    // Named, as a queued stop is: the server may have closed it already —
    // after the device went quiet, say — and "whatever is running" would
    // then miss it and report the hours as lost.
    const current = this.running.read();
    const entryId = current ? serverEntryId(current) : undefined;
    const result = await this.sendStop(client, deviceToken, endedAt, opId, entryId);
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
    this.save([
      ...waiting,
      this.stamp(stopOf(current, at, opId)),
    ]);
    this.running.write(null);
    const ended: TimeEntry = { ...current, endedAt: at };

    // Anything already queued happened before this and has to reach the
    // server first, so a lone pause call would close the wrong entry.
    if (waiting.length > 0) {
      const { settled } = await this.flush(deviceToken, client);
      return settled ? { ok: true, data: ended } : { ok: true, data: ended, fromCache: true };
    }

    // Named for the same reason as a queued stop: a machine waking from a
    // long sleep finds its entry already closed by the server.
    const result = endedAt
      ? await this.sendStop(client, deviceToken, endedAt, opId, serverEntryId(current))
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
    this.save([
      ...this.load(),
      this.stamp(stopOf(current, at, opId)),
    ]);
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
    idleSeconds?: number,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = startedAt ?? new Date().toISOString();
    const opId = randomUUID();
    const answer = await this.settleFirst(deviceToken, client, () =>
      this.queueStart(projectId, taskId, at, opId, idleSeconds),
    );
    if (answer) return answer;
    const result = await this.sendStart(
      client,
      deviceToken,
      projectId,
      taskId,
      startedAt,
      opId,
      idleSeconds,
    );
    if (result.ok) this.running.write(result.data);
    return serverVerdict(result) === 'undecided'
      ? this.queueStart(projectId, taskId, at, opId, idleSeconds)
      : result;
  }

  private queueStart(
    projectId: string | null,
    taskId: string | null,
    at: string,
    opId = randomUUID(),
    idleSeconds?: number,
  ): TrackingResult<TimeEntry> {
    const entry = this.localEntry(projectId, taskId, at);
    this.save([
      ...this.load(),
      this.stamp({
        type: 'start',
        at,
        projectId,
        taskId,
        opId,
        idleSeconds,
        localEntryId: entry.id,
      }),
    ]);
    this.running.write(entry);
    return { ok: true, data: entry, fromCache: true };
  }

  /**
   * Splits the running entry at this instant on the same Project and Task —
   * `reconcileDayBoundary` already does this at midnight. Through
   * `switchTo`, so the stop and start are one transaction carrying paired
   * operation ids. The server checks a switch against work-time limits like
   * a start, except one that continues the same Project and Task on this
   * Device — exactly what this sends — so a split is never refused and can
   * never leave somebody with no timer.
   * `null` when there is nothing to split; a paused entry is already closed.
   */
  async splitRunning(
    deviceToken: string,
    client: PendingTimerClient,
  ): Promise<TrackingResult<TimeEntry> | null> {
    const current = this.running.read();
    if (!current || current.endedAt || current.pausedAt) return null;
    return await this.switchTo(
      deviceToken,
      current.projectId,
      current.taskId,
      client,
    );
  }

  async switchTo(
    deviceToken: string,
    projectId: string | null,
    taskId: string | null,
    client: PendingTimerClient,
  ): Promise<TrackingResult<TimeEntry>> {
    const at = new Date().toISOString();
    // One id per row the switch writes, minted here so the queued stop and
    // start reuse them. Without that, a switch the server applied but could
    // not answer replayed as two anonymous operations: the stop met the
    // entry the switch had just started and was refused for ending before
    // its own start, and the start met a timer already running. Both were
    // reported to the person as time that could not be saved.
    const stopOpId = randomUUID();
    const startOpId = randomUUID();
    const answer = await this.settleFirst(deviceToken, client, () =>
      this.queueSwitch(projectId, taskId, at, stopOpId, startOpId),
    );
    if (answer) return answer;
    const result = await client.switchTimer(
      deviceToken,
      projectId,
      taskId,
      stopOpId,
      startOpId,
    );
    if (result.ok) this.running.write(result.data);
    return serverVerdict(result) === 'undecided'
      ? this.queueSwitch(projectId, taskId, at, stopOpId, startOpId)
      : result;
  }

  /** An offline switch is a stop and a start at the same instant. */
  private queueSwitch(
    projectId: string | null,
    taskId: string | null,
    at: string,
    stopOpId = randomUUID(),
    startOpId = randomUUID(),
  ): TrackingResult<TimeEntry> {
    const current = this.running.read();
    if (!current) return this.queueStart(projectId, taskId, at, startOpId);
    const entry = this.localEntry(projectId, taskId, at);
    this.save([
      ...this.load(),
      this.stamp(stopOf(current, at, stopOpId)),
      this.stamp({
        type: 'start',
        at,
        projectId,
        taskId,
        opId: startOpId,
        localEntryId: entry.id,
      }),
    ]);
    this.running.write(entry);
    return { ok: true, data: entry, fromCache: true };
  }
}
