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
    activeMs: raw.active_ms,
    tzOffsetMin: raw.tz_offset_min,
    source: raw.source as UrlSession['source'],
    confidence: raw.confidence as UrlSession['confidence'],
    syncedAt: raw.synced_at,
  };
}

/**
 * The durable local queue for UrlSessions — the offline store described in
 * docs/url-tracking-plan.md Step 5. Every engine output (opened/extended/
 * closed) upserts here, not just closed ones: that gives a queryable "what's
 * happening right now" table, and it means a session that closes, gets
 * synced, then reopens via the session engine's merge window is correctly
 * marked pending again for free (upsert always resets synced_at to NULL;
 * getPendingSync's `ended_at IS NOT NULL` filter keeps an open session out
 * of any sync attempt regardless of that flag).
 */
export class UrlSessionStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db);
  }

  /**
   * Defense in depth for Step 23's core privacy guarantee — session-engine.ts
   * already strips url/host/path before a private session ever reaches here
   * (see its toUrlSession), but this assertion means a regression in that
   * logic fails loudly (an exception, caught nowhere, surfacing immediately)
   * rather than silently persisting a real private-window URL to disk.
   * Deliberately checks the RAW field values, not just "was private true" —
   * a future refactor could set private:true while accidentally leaving
   * url/host populated from an earlier assignment, and this must catch that.
   */
  private assertPrivacyInvariant(session: UrlSession): void {
    if (session.private === true && (session.url !== '' || session.host !== '')) {
      throw new Error(
        `Refusing to store a private session (id=${session.id}) with a non-empty url/host — ` +
          'session-engine.ts must strip these before a private reading reaches the store.',
      );
    }
  }

  upsert(session: UrlSession): void {
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

  getPendingSync(limit: number): UrlSessionRow[] {
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
    if (ids.length === 0) return;
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
    this.db.close();
  }
}
