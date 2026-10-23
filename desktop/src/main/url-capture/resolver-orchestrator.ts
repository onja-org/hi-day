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
import type { Source } from './protocol';
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
  /**
   * Which browser a focus event's `app` names, or null for anything else.
   * Without it a failed read is simply dropped, as it always was; with it,
   * a browser window whose URL cannot be read is kept as "URL unknown".
   */
  identifyBrowser?: (app: string) => string | null;
  /** The reading method this platform's side-car uses — the source of an unknown-URL session. */
  platformSource?: Source;
}

/**
 * Failures meaning the address bar cannot be read at all, as opposed to
 * one not worth reading right now (the person is typing in it, or it is a
 * new tab) or a read that went wrong once. `no-address-bar` is what a
 * Linux browser started without its accessibility tree gives; the other
 * two are macOS's Automation permission being refused and a browser its
 * resolver has no route into.
 */
const UNREADABLE_CODES = new Set(['no-address-bar', 'consent-denied', 'unsupported-browser']);

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
  private readonly identifyBrowser: ((app: string) => string | null) | null;
  private readonly platformSource: Source | null;
  private currentFocus: { pid: number; hwnd: number; app: string } | null = null;

  constructor(options: ResolverOrchestratorOptions) {
    this.reportEvent = options.reportEvent;
    this.normalizeOptions = options.normalizeOptions;
    this.logger = options.logger ?? ((): void => undefined);
    this.debugSink = options.debugSink ?? new NullDebugHarness();
    this.identifyBrowser = options.identifyBrowser ?? null;
    this.platformSource = options.platformSource ?? null;

    this.manager = new ResolverManager(options.spawnConfig, { logger: this.logger });
    this.heartbeat = new HeartbeatScheduler({
      intervalMs: options.heartbeatIntervalMs,
      onTick: () => void this.resolveCurrentFocus(),
    });

    this.manager.on('ready', (event) => {
      this.logger(`[resolver] ready platform=${event.platform} caps=${event.caps.join(',')}`);
      this.health.onReady(realClock().wallClockMs, event.caps);
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
      this.health.onSideCarError(event.detail);
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

      // Recorded through the same opt-in sink as successes, so an absent
      // debug log means "no resolve was sent" rather than "every resolve
      // failed". Only the [code] tag is kept — the message can echo raw
      // address-bar text — and `raw` stays empty because there is no reading.
      this.debugSink.record({
        ts: realClock().wallClockMs,
        raw: '',
        source: 'none',
        confidence: 'none',
        latencyMs: 0,
        decision: `resolve-failed:${extractResolverErrorCode(outcome.message)}`,
        app: focus.app,
      });
      this.reportUnreadableBrowser(focus, extractResolverErrorCode(outcome.message));
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

  /** Browser time that would otherwise vanish, kept as "URL unknown" — see UNREADABLE_CODES. */
  private reportUnreadableBrowser(
    focus: { pid: number; hwnd: number; app: string },
    code: string,
  ): void {
    if (!this.identifyBrowser || !this.platformSource) return;
    if (!UNREADABLE_CODES.has(code)) return;
    const browser = this.identifyBrowser(focus.app);
    if (!browser) return;

    this.reportEvent({
      type: 'urlUnreadable',
      pid: focus.pid,
      hwnd: focus.hwnd,
      browser,
      source: this.platformSource,
      ...realClock(),
    });
  }
}
