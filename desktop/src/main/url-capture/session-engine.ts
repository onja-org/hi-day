import type { Confidence, Source } from './protocol';
import type {
  EngineClock,
  EngineEvent,
  EngineOutput,
  FocusTarget,
  SessionEngineOptions,
  SessionFlag,
  UrlSession,
} from './session-types';

/** Lower index = higher precedence — apple-events beats everything. */
const SOURCE_PRECEDENCE: Source[] = ['apple-events', 'ax', 'uia', 'atspi', 'title'];

function precedenceRank(source: Source): number {
  return SOURCE_PRECEDENCE.indexOf(source);
}

function sameTarget(a: FocusTarget | null, b: FocusTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.pid === b.pid && a.hwnd === b.hwnd;
}

interface OpenSessionState {
  id: string;
  pid: number;
  hwnd: number;
  url: string;
  host: string;
  path: string | null;
  title: string | null;
  browser: string;
  private: boolean | null;
  source: Source;
  confidence: Confidence;
  /** Wall-clock ms of the session's original open — persists across merges. */
  startedAt: number;
  activeMs: number;
  lastAccountedMonotonicMs: number;
  tzOffsetMin: number;
  /** `activeMs` as of the last published checkpoint — drives the next one. */
  activeMsAtLastCheckpoint: number;
}

interface MergeCandidate {
  session: OpenSessionState;
  closedAtWallClockMs: number;
}

// Five minutes of ACTIVE time. Hubstaff's published model buckets activity
// into fixed 10-minute segments; this is deliberately tighter, since the
// complaint that prompted it was precisely that a long read stayed
// invisible for too long. Worst-case staleness becomes this plus one sync
// interval, instead of unbounded.
const DEFAULT_SEGMENT_FLUSH_MS = 5 * 60_000;
const DEFAULT_MERGE_WINDOW_MS = 30_000;
const DEFAULT_MIN_SESSION_FLOOR_MS = 2_000;

/**
 * Pure state machine — no I/O, no platform calls, no clock of its own. Every
 * event carries its own monotonic/wall-clock time (see session-types.ts);
 * ids come from an injected generator. See docs/url-tracking-plan.md Step 3.
 */
export class SessionEngine {
  private readonly mergeWindowMs: number;
  private readonly minSessionFloorMs: number;
  private readonly nullPrivacyPolicy: 'suppress' | 'capture-with-flag';
  private readonly segmentFlushMs: number;

  private timerRunning = false;
  private idle = false;
  private locked = false;
  private awake = true;
  private focusedTarget: FocusTarget | null = null;
  private open: OpenSessionState | null = null;
  private mergeCandidate: MergeCandidate | null = null;

  constructor(private readonly options: SessionEngineOptions) {
    this.mergeWindowMs = options.mergeWindowMs ?? DEFAULT_MERGE_WINDOW_MS;
    this.minSessionFloorMs = options.minSessionFloorMs ?? DEFAULT_MIN_SESSION_FLOOR_MS;
    this.nullPrivacyPolicy = options.nullPrivacyPolicy ?? 'capture-with-flag';
    this.segmentFlushMs = options.segmentFlushMs ?? DEFAULT_SEGMENT_FLUSH_MS;
  }

  processEvent(event: EngineEvent): EngineOutput[] {
    const outputs: EngineOutput[] = [];

    // Always account for elapsed time under the PRE-event conditions first —
    // a condition flip or URL change is itself a discrete event, so by the
    // time we apply its effect, time up to that exact instant is settled.
    this.accumulate(event, outputs);

    switch (event.type) {
      case 'focusChanged':
        this.handleFocusChanged(event, outputs);
        break;
      case 'urlResolved':
        this.handleUrlResolved(event, outputs);
        break;
      case 'idleChanged':
        this.idle = event.idle;
        if (event.idle) this.closeOpenSession(event, outputs, true);
        break;
      case 'screenLockChanged':
        this.locked = event.locked;
        if (event.locked) {
          this.closeOpenSession(event, outputs, true);
          this.focusedTarget = null; // locking forgets focus, like focus-loss
        }
        break;
      case 'powerStateChanged':
        this.awake = event.awake;
        if (!event.awake) this.closeOpenSession(event, outputs, true);
        break;
      case 'timerStateChanged':
        this.timerRunning = event.running;
        if (!event.running) this.closeOpenSession(event, outputs, true);
        break;
      case 'dayBoundaryCrossed':
        // Never merge-eligible: a cut at the day boundary must never
        // silently reattach across it, or the whole point of cutting there
        // for reporting is defeated.
        this.closeOpenSession(event, outputs, false);
        break;
      case 'heartbeat':
        break; // accounting above is heartbeat's entire job
    }

    // Last, so the event's own semantics settle first: if this event already
    // closed the session there is nothing left to checkpoint.
    this.checkpointIfDue(event, outputs);

    return outputs;
  }

  /**
   * Publishes a still-running session as a complete-so-far record once it
   * has accrued `segmentFlushMs` of active time since the last one.
   *
   * Deliberately does NOT close and reopen the session, which was the
   * obvious alternative: reopening resets `lastAccountedMonotonicMs`, so
   * every flush would silently discard the gap until the next reading
   * arrived — up to one heartbeat interval each time, which over a full day
   * of five-minute segments adds up to minutes of real tracked time thrown
   * away. Emitting a snapshot leaves the in-memory session untouched, so no
   * accounting is lost at all.
   */
  private checkpointIfDue(clock: EngineClock, outputs: EngineOutput[]): void {
    if (!this.open || this.segmentFlushMs <= 0) return;
    if (this.open.activeMs - this.open.activeMsAtLastCheckpoint < this.segmentFlushMs) return;

    this.open.activeMsAtLastCheckpoint = this.open.activeMs;
    outputs.push({
      kind: 'checkpoint',
      session: this.toUrlSession(this.open, clock.wallClockMs),
      flags: this.computeFlags(this.open, clock.wallClockMs),
    });
  }

  private gatingConditionsHold(): boolean {
    return this.timerRunning && !this.idle && this.awake;
  }

  private accumulate(clock: EngineClock, outputs: EngineOutput[]): void {
    if (!this.open) return;
    const conditionsHeld = this.gatingConditionsHold() && this.focusedTarget !== null;
    const delta = clock.monotonicMs - this.open.lastAccountedMonotonicMs;
    this.open.lastAccountedMonotonicMs = clock.monotonicMs;
    if (conditionsHeld && delta > 0) {
      this.open.activeMs += delta;
      outputs.push({
        kind: 'extended',
        session: this.toUrlSession(this.open, null),
        flags: this.computeFlags(this.open, clock.wallClockMs),
      });
    }
  }

  private handleFocusChanged(
    event: Extract<EngineEvent, { type: 'focusChanged' }>,
    outputs: EngineOutput[],
  ): void {
    const changed = !sameTarget(this.focusedTarget, event.target);
    this.focusedTarget = event.target;
    if (changed) {
      this.closeOpenSession(event, outputs, true);
    }
  }

  private handleUrlResolved(
    event: Extract<EngineEvent, { type: 'urlResolved' }>,
    outputs: EngineOutput[],
  ): void {
    if (this.locked) return; // no sane window to attribute this to

    if (!this.focusedTarget || this.focusedTarget.pid !== event.pid || this.focusedTarget.hwnd !== event.hwnd) {
      return; // stale/irrelevant reading for a window that isn't focused
    }

    if (event.private === null && this.nullPrivacyPolicy === 'suppress') {
      // Step 23: this browser's private-mode state can't be detected at
      // all, and the configured policy is to suppress capture for it
      // entirely — treated exactly as if no reading arrived, not merely
      // as a reading to withhold from an otherwise-open session. If a
      // session is already open for this window (e.g. the policy changed
      // mid-session, or a differently-configured resolver briefly
      // reported non-null earlier), it is left to close via the normal
      // focus-loss/idle/etc. paths rather than force-closed here — this
      // is solely a gate on OPENING/EXTENDING from this reading.
      return;
    }

    if (this.open && this.open.pid === event.pid && this.open.hwnd === event.hwnd) {
      if (this.open.url === event.url) {
        if (precedenceRank(event.source) <= precedenceRank(this.open.source)) {
          this.open.source = event.source;
          this.open.confidence = event.confidence;
          this.open.title = event.title;
        }
        return;
      }

      if (precedenceRank(event.source) > precedenceRank(this.open.source)) {
        return; // lower-precedence reading disagreeing with tracked data — ignore
      }

      this.closeOpenSession(event, outputs, true);
      this.openOrMergeSession(event, outputs);
      return;
    }

    if (!this.gatingConditionsHold()) return;
    this.openOrMergeSession(event, outputs);
  }

  private openOrMergeSession(
    event: Extract<EngineEvent, { type: 'urlResolved' }>,
    outputs: EngineOutput[],
  ): void {
    const candidate = this.mergeCandidate;
    this.mergeCandidate = null; // consumed regardless of whether it matches

    if (candidate && candidate.session.url === event.url && event.wallClockMs - candidate.closedAtWallClockMs <= this.mergeWindowMs) {
      const reopened: OpenSessionState = {
        ...candidate.session,
        pid: event.pid,
        hwnd: event.hwnd,
        url: event.url,
        host: event.host,
        path: event.path,
        title: event.title,
        browser: event.browser,
        private: event.private,
        source: event.source,
        confidence: event.confidence,
        lastAccountedMonotonicMs: event.monotonicMs,
      };
      this.open = reopened;
      outputs.push({
        kind: 'extended',
        session: this.toUrlSession(reopened, null),
        flags: this.computeFlags(reopened, event.wallClockMs),
      });
      return;
    }

    const fresh: OpenSessionState = {
      id: this.options.generateId(),
      pid: event.pid,
      hwnd: event.hwnd,
      url: event.url,
      host: event.host,
      path: event.path,
      title: event.title,
      browser: event.browser,
      private: event.private,
      source: event.source,
      confidence: event.confidence,
      startedAt: event.wallClockMs,
      activeMs: 0,
      lastAccountedMonotonicMs: event.monotonicMs,
      tzOffsetMin: event.tzOffsetMin,
      activeMsAtLastCheckpoint: 0,
    };
    this.open = fresh;
    outputs.push({ kind: 'opened', session: this.toUrlSession(fresh, null), flags: [] });
  }

  private closeOpenSession(clock: EngineClock, outputs: EngineOutput[], mergeEligible: boolean): void {
    if (!this.open) return;
    const open = this.open;
    this.open = null;

    if (open.activeMs >= this.minSessionFloorMs) {
      outputs.push({
        kind: 'closed',
        session: this.toUrlSession(open, clock.wallClockMs),
        flags: this.computeFlags(open, clock.wallClockMs),
      });
    }

    this.mergeCandidate = mergeEligible ? { session: open, closedAtWallClockMs: clock.wallClockMs } : null;
  }

  private computeFlags(open: OpenSessionState, wallClockMs: number): SessionFlag[] {
    const wallSpan = wallClockMs - open.startedAt;
    return open.activeMs > wallSpan ? ['active-ms-exceeds-wall-clock'] : [];
  }

  /**
   * Strips url/host/path for a private/incognito session before it ever
   * leaves the engine — per docs/url-tracking-plan.md Step 23's policy
   * ("record the session with the host and path stripped") and the
   * anti-goal pinned in URL_TRACKING_CONTEXT.md ("do not store
   * private-window URLs where private === true"). Only the external
   * UrlSession is stripped; `open` (internal engine state) keeps the real
   * values so merge-window matching in openOrMergeSession still compares
   * real URLs — otherwise every private session would spuriously "match"
   * every other stripped one.
   */
  private toUrlSession(open: OpenSessionState, endedAt: number | null): UrlSession {
    const isPrivate = open.private === true;
    return {
      id: open.id,
      url: isPrivate ? '' : open.url,
      host: isPrivate ? '' : open.host,
      path: isPrivate ? null : open.path,
      title: open.title,
      browser: open.browser,
      private: open.private,
      deviceId: this.options.deviceId,
      startedAt: open.startedAt,
      endedAt,
      // Rounded on the way out, not while accumulating: deltas come from a
      // monotonic clock and are fractional, so a raw sum carries meaningless
      // sub-millisecond precision (2104.5833219999986). The pinned model, the
      // sync DTO's @IsInt, and the backend's `integer` column all treat
      // activeMs as whole milliseconds — leaving it fractional made every
      // sync request fail validation with a 400, so nothing ever uploaded
      // even though capture itself was working.
      activeMs: Math.round(open.activeMs),
      tzOffsetMin: open.tzOffsetMin,
      source: open.source,
      confidence: open.confidence,
    };
  }
}
