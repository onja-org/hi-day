import type { Confidence, Source } from './protocol';

/**
 * The pinned core data model from URL_TRACKING_CONTEXT.md — this is what
 * eventually gets synced to the backend. Do not add fields here for
 * engine-internal bookkeeping (see `SessionFlag` for that); this shape stays
 * exactly what a consumer of the engine's output can serialize and ship.
 */
export interface UrlSession {
  id: string;
  url: string;
  host: string;
  path: string | null;
  title: string | null;
  browser: string;
  private: boolean | null;
  deviceId: string;
  startedAt: number;
  endedAt: number | null;
  activeMs: number;
  tzOffsetMin: number;
  source: Source;
  confidence: Confidence;
}

/** Every engine input carries its own time — the engine never reaches for a clock. */
export interface EngineClock {
  monotonicMs: number;
  wallClockMs: number;
  tzOffsetMin: number;
}

export interface FocusTarget {
  browser: string;
  pid: number;
  hwnd: number;
}

export type EngineEvent =
  | ({ type: 'focusChanged'; target: FocusTarget | null } & EngineClock)
  | ({
      type: 'urlResolved';
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
    } & EngineClock)
  | ({ type: 'idleChanged'; idle: boolean } & EngineClock)
  | ({ type: 'screenLockChanged'; locked: boolean } & EngineClock)
  | ({ type: 'powerStateChanged'; awake: boolean } & EngineClock)
  | ({ type: 'timerStateChanged'; running: boolean } & EngineClock)
  | ({ type: 'dayBoundaryCrossed' } & EngineClock)
  | ({ type: 'heartbeat' } & EngineClock);

/** Side-channel diagnostics — never part of the synced `UrlSession` shape. */
export type SessionFlag = 'active-ms-exceeds-wall-clock';

export interface EngineOutput {
  /**
   * `checkpoint` publishes a still-running session as a record so far, so a
   * long read becomes visible before it ends. Its non-null `endedAt` is what
   * makes the sync queue pick it up; the session stays open and later
   * re-upserts the same id, which the API's last-write-wins already covers.
   */
  kind: 'opened' | 'extended' | 'closed' | 'checkpoint';
  session: UrlSession;
  flags: SessionFlag[];
}

export interface SessionEngineOptions {
  deviceId: string;
  /** Injected rather than called internally — the engine never touches crypto/uuid itself. */
  generateId: () => string;
  /** How long (wall-clock ms) after a close the same URL can reopen the same session. */
  mergeWindowMs?: number;
  /** Sessions whose final activeMs never reaches this are never emitted as `closed`. */
  minSessionFloorMs?: number;
  /**
   * Policy for a browser whose private-mode state is undetectable (Safari).
   * Explicit config rather than a default baked into behaviour — see
   * URL_TRACKING_CONTEXT.md for why capture-with-flag wins.
   */
  nullPrivacyPolicy?: 'suppress' | 'capture-with-flag';
  /**
   * How much ACTIVE time may accrue on one open session before it is
   * published as a checkpoint. Measured in active ms, not wall clock, so a
   * session sitting idle never emits a checkpoint that says nothing new.
   * Set to 0 to disable checkpointing entirely.
   */
  segmentFlushMs?: number;
}
