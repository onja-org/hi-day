import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PowerAdapter, type MinimalPowerMonitor } from './power-adapter';
import { realClock } from './real-clock';
import { SessionEngine } from './session-engine';
import type { EngineEvent } from './session-types';
import { UrlSessionStore } from './store';
import { SyncQueue, type SyncQueueResult } from './sync-queue';
import type { UploadFn } from './sync-contract';

const NOOP_UPLOAD: UploadFn = () => Promise.resolve({ acked: [] });

export interface UrlCaptureServiceOptions {
  deviceId: string;
  userDataDir: string;
  powerMonitor: MinimalPowerMonitor;
  idleThresholdMs?: number;
  idlePollIntervalMs?: number;
  mergeWindowMs?: number;
  minSessionFloorMs?: number;
  logger?: (line: string) => void;
  /** Defaults to a no-op that acks nothing — main.ts supplies a real ApiClient-backed uploader once a device is logged in. */
  upload?: UploadFn;
}

/**
 * Wires the session engine, the power/idle adapter and the local store into
 * one thing main.ts can own for a logged-in session.
 *
 * Focus/URL capture belongs to ResolverOrchestrator, which feeds events
 * through the public `reportEvent`. This class works identically with or
 * without one attached.
 */
export class UrlCaptureService {
  private readonly store: UrlSessionStore;
  private readonly engine: SessionEngine;
  private readonly powerAdapter: PowerAdapter;
  private readonly syncQueue: SyncQueue;
  private readonly logger: (line: string) => void;

  constructor(options: UrlCaptureServiceOptions) {
    this.logger = options.logger ?? ((): void => undefined);
    this.store = new UrlSessionStore(join(options.userDataDir, 'url-sessions.sqlite'));
    this.syncQueue = new SyncQueue(this.store, options.upload ?? NOOP_UPLOAD);
    this.engine = new SessionEngine({
      deviceId: options.deviceId,
      generateId: randomUUID,
      mergeWindowMs: options.mergeWindowMs,
      minSessionFloorMs: options.minSessionFloorMs,
    });
    this.powerAdapter = new PowerAdapter(options.powerMonitor, {
      idleThresholdMs: options.idleThresholdMs,
      idlePollIntervalMs: options.idlePollIntervalMs,
      clock: realClock,
      onEvent: (event) => this.reportEvent(event),
    });
  }

  start(): void {
    this.powerAdapter.start();
  }

  stop(): void {
    this.powerAdapter.stop();
    this.store.close();
  }

  /** The one signal this service can't get from powerMonitor — pushed by the renderer. */
  setTimerRunning(running: boolean): void {
    this.reportEvent({ type: 'timerStateChanged', running, ...realClock() });
  }

  /** Uploads one pending batch — main.ts calls this on its own periodic schedule. */
  async runSync(): Promise<SyncQueueResult> {
    return this.syncQueue.runOnce();
  }

  /**
   * The general entry point — also what a real ResolverManager's `focus`
   * events and resolve() results will feed once Stage B/C/D exist. Exposed
   * publicly now so this class's wiring (engine + store) is fully testable
   * without waiting on a real resolver.
   */
  reportEvent(event: EngineEvent): void {
    const outputs = this.engine.processEvent(event);
    for (const output of outputs) {
      this.store.upsert(output.session);
      const flagsSuffix = output.flags.length > 0 ? ` flags=${output.flags.join(',')}` : '';
      this.logger(
        `[url-capture] ${output.kind} id=${output.session.id} activeMs=${output.session.activeMs}${flagsSuffix}`,
      );
    }
  }
}
