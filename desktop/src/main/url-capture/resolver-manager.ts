import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { TypedEmitter } from './typed-emitter';
import {
  isResolveOkResponse,
  isResolverEvent,
  isResolverResponse,
  type FocusEvent,
  type PingOutcome,
  type ReadyEvent,
  type ResolveOutcome,
  type ResolverEvent,
  type ResolverMessage,
  type ResolverRequest,
  type ResolverResponse,
  type ErrorEvent as SidecarErrorEvent,
} from './protocol';

export interface ResolverSpawnConfig {
  /** Never a hardcoded platform path here — Stage B/C/D decide which binary this is. */
  command: string;
  args?: string[];
}

export interface ResolverManagerOptions {
  /** Per-request deadline before a `resolve`/`ping` call fails with a timeout. */
  requestTimeoutMs?: number;
  /** How often the watchdog sends its own `ping`. */
  pingIntervalMs?: number;
  /** Consecutive missed pings before the side-car is killed and respawned. */
  maxMissedPings?: number;
  /** Bytes a buffered, still-incomplete stdout line may grow to before it's discarded. */
  maxLineBytes?: number;
  /** Consecutive failed restarts before the manager gives up and emits `degraded`. */
  maxRestartAttempts?: number;
  /** First backoff delay after a crash; doubles each subsequent attempt. */
  baseBackoffMs?: number;
  /** Backoff delay ceiling. */
  maxBackoffMs?: number;
  /** Sink for the side-car's stderr and the manager's own diagnostic lines. */
  logger?: (line: string) => void;
}

type ResolvedOptions = Required<ResolverManagerOptions>;

const DEFAULT_OPTIONS: ResolvedOptions = {
  requestTimeoutMs: 2000,
  pingIntervalMs: 5000,
  maxMissedPings: 2,
  maxLineBytes: 1_000_000,
  maxRestartAttempts: 5,
  baseBackoffMs: 1000,
  maxBackoffMs: 30_000,
  logger: (line: string) => {
    console.error(line);
  },
};

export type ResolverManagerEvents = {
  ready: ReadyEvent;
  focus: FocusEvent;
  error: SidecarErrorEvent;
  restarting: { attempt: number; delayMs: number };
  degraded: { reason: string };
};

interface PendingEntry {
  onSettle: (response: ResolverResponse | undefined, failureMessage: string | undefined) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Owns a single side-car child process: spawns it, speaks the pinned
 * newline-delimited JSON protocol over its stdio, and keeps it alive via a
 * ping watchdog with backoff. Callers never see a platform path or a
 * platform-specific protocol detail — that's the whole point of the side-car
 * boundary (see docs/url-tracking-plan.md §7.3.1).
 */
export class ResolverManager extends TypedEmitter<ResolverManagerEvents> {
  private readonly options: ResolvedOptions;
  private child: ChildProcessWithoutNullStreams | null = null;
  private state: 'idle' | 'running' | 'degraded' = 'idle';
  private stdoutBuffer = '';
  private readonly pending = new Map<number, PendingEntry>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveMisses = 0;
  private restartAttempts = 0;
  private nextRequestId = 1;
  private intentionalStop = false;

  constructor(
    private readonly spawnConfig: ResolverSpawnConfig,
    options: ResolverManagerOptions = {},
  ) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start(): void {
    if (this.state === 'running') return;
    this.intentionalStop = false;
    this.restartAttempts = 0;
    this.state = 'running';
    this.spawnChild();
  }

  stop(): void {
    this.intentionalStop = true;
    this.state = 'idle';
    this.stopPingWatchdog();
    this.failAllPending('Resolver manager was stopped.');
    const child = this.child;
    this.child = null;
    child?.kill();
  }

  resolve(pid: number, hwnd: number): Promise<ResolveOutcome> {
    return new Promise((settlePromise) => {
      this.send({ id: this.nextId(), op: 'resolve', pid, hwnd }, (response, failureMessage) => {
        if (response === undefined) {
          settlePromise({ ok: false, message: failureMessage ?? 'No response from resolver.' });
          return;
        }
        if (response.ok === false) {
          settlePromise({ ok: false, message: response.message });
          return;
        }
        if (!isResolveOkResponse(response)) {
          settlePromise({
            ok: false,
            message: 'Resolver replied to a resolve request with a non-resolve response.',
          });
          return;
        }
        const { id, ...outcome } = response;
        void id; // manager-internal correlation id — never part of the public result
        settlePromise(outcome);
      });
    });
  }

  private ping(): Promise<PingOutcome> {
    return new Promise((settlePromise) => {
      this.send({ id: this.nextId(), op: 'ping' }, (response, failureMessage) => {
        if (response === undefined) {
          settlePromise({ ok: false, message: failureMessage ?? 'No response from resolver.' });
          return;
        }
        if (response.ok === false) {
          settlePromise({ ok: false, message: response.message });
          return;
        }
        settlePromise({ ok: true });
      });
    });
  }

  private nextId(): number {
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    return id;
  }

  private send(request: ResolverRequest, onSettle: PendingEntry['onSettle']): void {
    if (!this.child) {
      onSettle(undefined, 'Resolver is not running.');
      return;
    }

    const timer = setTimeout(() => {
      this.pending.delete(request.id);
      onSettle(undefined, `Timed out waiting for a response to "${request.op}".`);
    }, this.options.requestTimeoutMs);

    this.pending.set(request.id, { onSettle, timer });

    try {
      this.child.stdin.write(`${JSON.stringify(request)}\n`);
    } catch (err) {
      // A synchronous write failure (e.g. the stream was already destroyed
      // by a child that died between the `!this.child` check above and
      // this call) — settle immediately rather than waiting out the full
      // timeout for something already known to have failed. The far more
      // common case — an asynchronous EPIPE reported via the stream's
      // 'error' event — is handled by the listener attached in
      // spawnChild(); without one, that event becomes an unhandled
      // exception (this is what crashed under CI's tighter watchdog
      // restart-cycle timing).
      const entry = this.pending.get(request.id);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(request.id);
        entry.onSettle(undefined, `Failed to write to resolver: ${(err as Error).message}`);
      }
    }
  }

  private failAllPending(message: string): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.onSettle(undefined, message);
      this.pending.delete(id);
    }
  }

  private spawnChild(): void {
    this.stdoutBuffer = '';
    const child = spawn(this.spawnConfig.command, this.spawnConfig.args ?? []);
    this.child = child;
    let gone = false;

    const onGone = (): void => {
      if (gone) return;
      gone = true;
      if (this.child === child) {
        this.child = null;
      }
      this.stopPingWatchdog();
      this.failAllPending('Resolver process is no longer running.');
      if (this.intentionalStop || this.state === 'degraded') return;
      this.scheduleRestart();
    };

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => this.handleStdoutChunk(chunk));
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (chunk: string) => this.options.logger(chunk));
    // Without this, a write to a child that already died between our own
    // liveness check and the actual write (routine during rapid watchdog
    // restart cycles) emits an async EPIPE on the stream with no listener —
    // an unhandled exception, not a caught error. onGone() here is safe to
    // call even if 'exit' also fires for the same death; it's idempotent.
    child.stdin.on('error', (err) => {
      this.options.logger(`Resolver stdin error: ${err.message}`);
      onGone();
    });
    child.on('exit', onGone);
    child.on('error', (err) => {
      this.options.logger(`Resolver process error: ${err.message}`);
      onGone();
    });

    this.startPingWatchdog();
  }

  private scheduleRestart(): void {
    this.restartAttempts += 1;
    if (this.restartAttempts > this.options.maxRestartAttempts) {
      this.state = 'degraded';
      this.emit('degraded', {
        reason: `Resolver failed to stay running after ${this.options.maxRestartAttempts} restart attempts.`,
      });
      return;
    }

    const delayMs = Math.min(
      this.options.baseBackoffMs * 2 ** (this.restartAttempts - 1),
      this.options.maxBackoffMs,
    );
    this.emit('restarting', { attempt: this.restartAttempts, delayMs });
    setTimeout(() => {
      if (this.intentionalStop || this.state === 'degraded') return;
      this.spawnChild();
    }, delayMs);
  }

  private startPingWatchdog(): void {
    this.consecutiveMisses = 0;
    this.pingTimer = setInterval(() => void this.runWatchdogPing(), this.options.pingIntervalMs);
  }

  private stopPingWatchdog(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private async runWatchdogPing(): Promise<void> {
    const outcome = await this.ping();
    if (outcome.ok) {
      this.consecutiveMisses = 0;
      this.restartAttempts = 0;
      return;
    }
    this.consecutiveMisses += 1;
    if (this.consecutiveMisses >= this.options.maxMissedPings) {
      this.consecutiveMisses = 0;
      this.child?.kill();
    }
  }

  /**
   * Splits stdout into lines, tolerating a line arriving across multiple
   * chunks. A still-incomplete line that grows past `maxLineBytes` is
   * discarded outright — without this, a side-car bug that never terminates
   * a line would grow this buffer forever and eventually wedge the process.
   */
  private handleStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk;

    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line.trim().length > 0) {
        this.handleLine(line);
      }
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }

    if (this.stdoutBuffer.length > this.options.maxLineBytes) {
      this.options.logger(
        `Resolver stdout line exceeded ${this.options.maxLineBytes} bytes without a newline; discarding buffered data.`,
      );
      this.stdoutBuffer = '';
    }
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.options.logger(`Dropped malformed resolver line: ${line.slice(0, 200)}`);
      return;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      this.options.logger(`Dropped non-object resolver line: ${line.slice(0, 200)}`);
      return;
    }

    const message = parsed as ResolverMessage;

    if (isResolverEvent(message)) {
      this.handleEvent(message);
      return;
    }

    if (isResolverResponse(message)) {
      this.handleResponse(message);
      return;
    }

    this.options.logger(`Dropped resolver line matching neither an event nor a response: ${line.slice(0, 200)}`);
  }

  private handleEvent(event: ResolverEvent): void {
    switch (event.ev) {
      case 'focus':
        this.emit('focus', event);
        return;
      case 'ready':
        this.emit('ready', event);
        return;
      case 'error':
        this.emit('error', event);
        return;
    }
  }

  private handleResponse(response: ResolverResponse): void {
    const entry = this.pending.get(response.id);
    if (!entry) {
      this.options.logger(`Dropped response for unknown/stale request id ${response.id}.`);
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(response.id);
    entry.onSettle(response, undefined);
  }
}
