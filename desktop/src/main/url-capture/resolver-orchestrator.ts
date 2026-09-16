import { type DebugSink, NullDebugHarness } from './debug-harness';
import { HeartbeatScheduler } from './heartbeat-scheduler';
import { normalizeAddressBarReading, type NormalizePipelineOptions } from './normalization/normalize';
import { realClock } from './real-clock';
import {
  extractResolverErrorCode,
  ResolverHealthTracker,
  type ResolverHealthSnapshot,
} from './resolver-health';
import { ResolverManager, type ResolverSpawnConfig } from './resolver-manager';
import type { EngineEvent } from './session-types';

export interface ResolverOrchestratorOptions {
  spawnConfig: ResolverSpawnConfig;
  /** Typically UrlCaptureService#reportEvent — kept as a plain function so this stays testable without a real service. */
  reportEvent: (event: EngineEvent) => void;
  heartbeatIntervalMs?: number;
  normalizeOptions?: NormalizePipelineOptions;
  logger?: (line: string) => void;
  /**
   * Opt-in raw-reading log (Step 6) — defaults to NullDebugHarness
   * (discards everything). CLAUDE.md's pinned rule ("never log a full URL
   * above debug level") is why this is a SEPARATE sink from `logger`
   * rather than just logging readings there: `logger` is always-on,
   * this is opt-in-only, and the two must never be conflated.
   */
  debugSink?: DebugSink;
}

/**
 * Owns a ResolverManager for one platform's side-car and turns its output
 * into EngineEvents. Not platform-specific: main.ts picks the spawn config.
 *
 * Every `focus` event starts the heartbeat and attempts a resolve, with no
 * "is this a browser" gate — the resolver already decides that, and a
 * failed resolve simply produces no event.
 */
export class ResolverOrchestrator {
  private readonly manager: ResolverManager;
  private readonly heartbeat: HeartbeatScheduler;
  private readonly reportEvent: (event: EngineEvent) => void;
  private readonly normalizeOptions: NormalizePipelineOptions | undefined;
  private readonly logger: (line: string) => void;
  private readonly health = new ResolverHealthTracker();
  private readonly debugSink: DebugSink;
  private currentFocus: { pid: number; hwnd: number; app: string } | null = null;

  constructor(options: ResolverOrchestratorOptions) {
    this.reportEvent = options.reportEvent;
    this.normalizeOptions = options.normalizeOptions;
    this.logger = options.logger ?? ((): void => undefined);
    this.debugSink = options.debugSink ?? new NullDebugHarness();

    this.manager = new ResolverManager(options.spawnConfig, { logger: this.logger });
    this.heartbeat = new HeartbeatScheduler({
      intervalMs: options.heartbeatIntervalMs,
      onTick: () => void this.resolveCurrentFocus(),
    });

    this.manager.on('ready', (event) => {
      this.logger(`[resolver] ready platform=${event.platform} caps=${event.caps.join(',')}`);
      this.health.onReady(realClock().wallClockMs);
    });
    this.manager.on('focus', (event) => {
      this.currentFocus = { pid: event.pid, hwnd: event.hwnd, app: event.app };
      this.reportEvent({
        type: 'focusChanged',
        target: { browser: event.app, pid: event.pid, hwnd: event.hwnd },
        ...realClock(),
      });
      this.heartbeat.setActive(true);
      void this.resolveCurrentFocus();
    });
    this.manager.on('error', (event) => {
      this.logger(`[resolver] error code=${event.code} detail=${event.detail}`);
    });
    this.manager.on('restarting', () => {
      this.health.onRestarting();
    });
    this.manager.on('degraded', (event) => {
      this.logger(`[resolver] degraded: ${event.reason}`);
      this.health.onDegraded();
      this.heartbeat.setActive(false);
    });
  }

  start(): void {
    this.manager.start();
  }

  stop(): void {
    this.heartbeat.stop();
    this.currentFocus = null;
    this.manager.stop();
  }

  /** Platform-agnostic resolver health — never includes a URL or any reading content. */
  healthSnapshot(): ResolverHealthSnapshot {
    return this.health.snapshot();
  }

  private async resolveCurrentFocus(): Promise<void> {
    const focus = this.currentFocus;
    if (!focus) return;

    const outcome = await this.manager.resolve(focus.pid, focus.hwnd);
    if (!outcome.ok) {
      // Not logged as an error at info level — CLAUDE.md's pinned rule
      // ("never log a full URL above debug level") means even a FAILED
      // reading's message could echo back raw address-bar text in some
      // resolver error paths, so this stays out of the normal logger.
      // The health tracker only extracts the leading [code] tag (see
      // extractResolverErrorCode), never the message itself — safe to
      // record unconditionally.
      this.health.onResolveFailure(outcome.message);

      // A failed read used to leave no trace anywhere: not in the logger
      // (the rule above), and not in the debug log either, because the
      // old early return sat in front of debugSink.record(). That made an
      // absent url-capture-debug.jsonl mean either "no resolve was ever
      // sent" or "every resolve failed", with no way to tell which — the
      // exact ambiguity that stalled first-contact Windows debugging.
      //
      // Recording the failure through the same opt-in sink fixes that
      // without weakening the rule: only the leading [code] tag is kept,
      // via the extractor the health tracker already uses and documents as
      // safe to record unconditionally. The message itself — which can
      // echo raw address-bar text back from some resolver error paths —
      // is dropped, and `raw` stays empty precisely because there is no
      // reading to record.
      this.debugSink.record({
        ts: realClock().wallClockMs,
        raw: '',
        source: 'none',
        confidence: 'none',
        latencyMs: 0,
        decision: `resolve-failed:${extractResolverErrorCode(outcome.message)}`,
        app: focus.app,
      });
      return;
    }

    const nowMs = realClock().wallClockMs;
    this.health.onSuccessfulResolve(nowMs);

    // Step 21's pipeline, dropping the reading at the first failure —
    // never reports an unnormalized url as an EngineEvent.
    const normalized = normalizeAddressBarReading(outcome.url, this.normalizeOptions);

    // Opt-in only (NullDebugHarness discards this by default) — the one
    // place both the raw reading and the normalization decision are both
    // in scope together, which is exactly what Step 6's debug record needs.
    this.debugSink.record({
      ts: nowMs,
      raw: outcome.url,
      normalized: normalized.ok ? normalized.url : undefined,
      source: outcome.source,
      confidence: outcome.confidence,
      app: focus.app,
      latencyMs: outcome.ms,
      decision: normalized.ok ? 'accepted' : `rejected:${normalized.reason}`,
    });

    if (!normalized.ok) return;

    this.reportEvent({
      type: 'urlResolved',
      pid: focus.pid,
      hwnd: focus.hwnd,
      url: normalized.url,
      host: normalized.host,
      path: normalized.path,
      title: outcome.title,
      browser: outcome.browser,
      private: outcome.private,
      source: outcome.source,
      confidence: outcome.confidence,
      ...realClock(),
    });
  }
}
