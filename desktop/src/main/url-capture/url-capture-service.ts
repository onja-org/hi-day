import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PowerAdapter, type MinimalPowerMonitor } from './power-adapter';
import { realClock } from './real-clock';
import { SessionEngine } from './session-engine';
import type { EngineEvent } from './session-types';
import { UrlSessionStore } from './store';

export interface UrlCaptureServiceOptions {
  deviceId: string;
  userDataDir: string;
  powerMonitor: MinimalPowerMonitor;
  idleThresholdMs?: number;
  idlePollIntervalMs?: number;
  mergeWindowMs?: number;
  minSessionFloorMs?: number;
  logger?: (line: string) => void;
}

/**
 * Wires the session engine (A.2), the power/idle adapter and local store
 * (A.3) together into one thing `main.ts` can own for a logged-in session.
 *
 * Focus/URL capture (ResolverManager) is NOT owned by this class directly
 * — that's ResolverOrchestrator's job (see main.ts's startUrlCapture),
 * which turns a platform resolver's `focus`/`resolve()` output into
 * EngineEvents and feeds them through `reportEvent`, same as this class's
 * own idle/lock/suspend signals. This class works identically whether or
 * not an orchestrator is attached — on Linux (no resolver yet) or if one
 * is never wired in for some other reason, it still exercises real
 * timer/idle/lock/suspend/shutdown signals flowing into the engine and
 * being persisted; `reportEvent` is public specifically so that stays true
 * without this class needing to know a resolver exists at all.
 */
export class UrlCaptureService {
  private readonly store: UrlSessionStore;
  private readonly engine: SessionEngine;
  private readonly powerAdapter: PowerAdapter;
  private readonly logger: (line: string) => void;

  constructor(options: UrlCaptureServiceOptions) {
    this.logger = options.logger ?? ((): void => undefined);
    this.store = new UrlSessionStore(join(options.userDataDir, 'url-sessions.sqlite'));
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
