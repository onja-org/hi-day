import { type DebugSink, NullDebugHarness } from './debug-harness';
import { HeartbeatScheduler } from './heartbeat-scheduler';
import { normalizeAddressBarReading, type NormalizePipelineOptions } from './normalization/normalize';
import { realClock } from './real-clock';
import { ResolverHealthTracker, type ResolverHealthSnapshot } from './resolver-health';
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
 * into EngineEvents — the piece that was deliberately left unbuilt when
 * UrlCaptureService and the darwin/win32 resolvers were each written (see
 * their own "not wired in yet" comments). Not platform-specific itself:
 * main.ts picks the right ResolverSpawnConfig (darwin vs. win32; Linux
 * has no resolver yet) and this class doesn't need to know which.
 *
 * Every `focus` event unconditionally starts the heartbeat and attempts a
 * resolve() — there is no "is this actually a browser" gate here. The
 * resolver's own per-browser registry already decides that (Stage C.2's
 * generic fallback, or a typed no-address-bar error for a non-browser
 * window); duplicating that decision here would just be a second,
 * possibly-inconsistent copy of the same logic. A resolve() failure for a
 * non-browser window is cheap and simply produces no urlResolved event —
 * not a problem to route around.
 */
export class ResolverOrchestrator {
  private readonly manager: ResolverManager;
  private readonly heartbeat: HeartbeatScheduler;
  private readonly reportEvent: (event: EngineEvent) => void;
  private readonly normalizeOptions: NormalizePipelineOptions | undefined;
  private readonly logger: (line: string) => void;
  private readonly health = new ResolverHealthTracker();
  private readonly debugSink: DebugSink;
  private currentFocus: { pid: number; hwnd: number } | null = null;

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
      this.currentFocus = { pid: event.pid, hwnd: event.hwnd };
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

  /** F.1: platform-agnostic resolver health for the coverage screen — never includes a URL or any reading content. */
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
