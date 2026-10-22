import Database from 'better-sqlite3';
import { runMigrations } from './migrations';
import type { UrlSession } from './session-types';

export interface UrlSessionRow extends UrlSession {
  syncedAt: number | null;
}

interface UrlSessionRawRow {
  id: string;
  url: string;
  host: string;
  path: string | null;
  title: string | null;
  browser: string;
  is_private: number | null;
  device_id: string;
  started_at: number;
  ended_at: number | null;
  active_ms: number;
  tz_offset_min: number;
  source: string;
  confidence: string;
  synced_at: number | null;
}

function toBooleanOrNull(value: number | null): boolean | null {
  return value === null ? null : value === 1;
}

function fromBooleanOrNull(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0;
}

function toRow(raw: UrlSessionRawRow): UrlSessionRow {
  return {
    id: raw.id,
    url: raw.url,
    host: raw.host,
    path: raw.path,
    title: raw.title,
    browser: raw.browser,
    private: toBooleanOrNull(raw.is_private),
    deviceId: raw.device_id,
    startedAt: raw.started_at,
    endedAt: raw.ended_at,
    // Also rounded here, not just at emit time: rows persisted before
    // activeMs was rounded still hold fractional values, and they must not
    // keep failing sync forever once the emit-side fix is in.
    activeMs: Math.round(raw.active_ms),
    tzOffsetMin: raw.tz_offset_min,
    source: raw.source as UrlSession['source'],
    confidence: raw.confidence as UrlSession['confidence'],
    syncedAt: raw.synced_at,
  };
}

/**
 * The durable local queue for UrlSessions. Every engine output upserts here,
 * not just closed ones, so a reopened session is marked pending again for
 * free — upsert resets synced_at, and getPendingSync's `ended_at IS NOT
 * NULL` filter keeps open sessions out of any sync.
 */
export class UrlSessionStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db);
  }

  /**
   * Defence in depth: the engine already strips private sessions, but a
   * regression there must fail loudly rather than persist a real
   * private-window URL. Checks the raw field values, not just the flag.
   */
  private assertPrivacyInvariant(session: UrlSession): void {
    if (session.private === true && (session.url !== '' || session.host !== '')) {
      throw new Error(
        `Refusing to store a private session (id=${session.id}) with a non-empty url/host — ` +
          'session-engine.ts must strip these before a private reading reaches the store.',
      );
    }
  }

  /**
   * Whether the database is still usable. URL capture can be switched off
   * (closing this) while a sync is still awaiting its upload; what lands
   * afterwards is dropped rather than thrown — an unacked session is simply
   * sent again next time, and the server's upsert absorbs the repeat.
   */
  private get isOpen(): boolean {
    return this.db.open;
  }

  upsert(session: UrlSession): void {
    if (!this.isOpen) return;
    this.assertPrivacyInvariant(session);
    this.db
      .prepare(
        `INSERT INTO url_sessions
           (id, url, host, path, title, browser, is_private, device_id,
            started_at, ended_at, active_ms, tz_offset_min, source, confidence, synced_at)
         VALUES (@id, @url, @host, @path, @title, @browser, @is_private, @device_id,
                 @started_at, @ended_at, @active_ms, @tz_offset_min, @source, @confidence, NULL)
         ON CONFLICT(id) DO UPDATE SET
           url = excluded.url,
           host = excluded.host,
           path = excluded.path,
           title = excluded.title,
           browser = excluded.browser,
           is_private = excluded.is_private,
           device_id = excluded.device_id,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           active_ms = excluded.active_ms,
           tz_offset_min = excluded.tz_offset_min,
           source = excluded.source,
           confidence = excluded.confidence,
           synced_at = NULL`,
      )
      .run({
        id: session.id,
        url: session.url,
        host: session.host,
        path: session.path,
        title: session.title,
        browser: session.browser,
        is_private: fromBooleanOrNull(session.private),
        device_id: session.deviceId,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        active_ms: session.activeMs,
        tz_offset_min: session.tzOffsetMin,
        source: session.source,
        confidence: session.confidence,
      });
  }

  /**
   * How many closed sessions are still waiting to be uploaded. Counted in
   * SQL rather than by fetching rows: this is asked repeatedly while the
   * quit dialog counts down, and the rows themselves are not wanted.
   */
  countPendingSync(): number {
    if (!this.isOpen) return 0;
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM url_sessions
         WHERE ended_at IS NOT NULL AND synced_at IS NULL`,
      )
      .get() as { count: number };
    return row.count;
  }

  getPendingSync(limit: number): UrlSessionRow[] {
    if (!this.isOpen) return [];
    const rows = this.db
      .prepare(
        `SELECT * FROM url_sessions
         WHERE ended_at IS NOT NULL AND synced_at IS NULL
         ORDER BY ended_at ASC
         LIMIT ?`,
      )
      .all(limit) as UrlSessionRawRow[];
    return rows.map(toRow);
  }

  markSynced(ids: string[], syncedAtMs: number): void {
    if (ids.length === 0 || !this.isOpen) return;
    const placeholders = ids.map(() => '?').join(', ');
    this.db
      .prepare(`UPDATE url_sessions SET synced_at = ? WHERE id IN (${placeholders})`)
      .run(syncedAtMs, ...ids);
  }

  /** Never touches an open session (endedAt null), regardless of age. */
  purgeOlderThan(cutoffWallClockMs: number): number {
    const result = this.db
      .prepare('DELETE FROM url_sessions WHERE ended_at IS NOT NULL AND ended_at < ?')
      .run(cutoffWallClockMs);
    return result.changes;
  }

  getById(id: string): UrlSessionRow | null {
    const row = this.db.prepare('SELECT * FROM url_sessions WHERE id = ?').get(id) as
      | UrlSessionRawRow
      | undefined;
    return row ? toRow(row) : null;
  }

  close(): void {
    if (this.isOpen) this.db.close();
  }
}
