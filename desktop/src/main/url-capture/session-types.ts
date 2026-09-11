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
   * `checkpoint` is a still-running session published as a complete record
   * *so far*, so long reads become visible without waiting for them to end.
   * It carries a non-null `endedAt` (the checkpoint instant) precisely so
   * the sync queue will pick it up — only ended sessions are ever uploaded.
   * The session stays open and keeps accumulating; the next checkpoint, and
   * the eventual real `closed`, re-upsert the SAME id with a larger
   * `activeMs` and later `endedAt`. That is the last-write-wins upsert
   * docs/url-tracking-api.md already specifies, not a new contract.
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
   * Step 23's policy for a browser whose private-mode state can't be
   * detected at all (private resolves to null — Safari today): either
   * suppress URL capture for it entirely, or capture normally (the
   * existing `private: null` field on the stored session already serves
   * as the "indistinguishable" flag downstream). Explicit config, never
   * an implicit default baked into behavior — see
   * URL_TRACKING_CONTEXT.md's "Decided: private === null policy" for why
   * "capture-with-flag" is the default here, not "suppress".
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
