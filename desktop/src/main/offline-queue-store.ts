import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';

export interface QueuedRow {
  id: number;
  kind: string;
  payload: string;
  blob: Buffer | null;
  attempts: number;
  createdAt: string;
  nextAttemptAt: string;
}

export interface RetryEntry {
  id: number;
  nextAttemptAt: Date;
}

const IN_MEMORY = ':memory:';

/**
 * The offline queue's persistence — one SQLite table (via `sql.js`, a WASM
 * build of SQLite) shared by every capture kind (app-events, screenshots,
 * and whatever registers next), so a captured item survives an app crash
 * or restart between being captured and successfully uploaded (see
 * docs/TECH_DESIGN.md §4's "Offline queue"). `OfflineQueue`
 * (offline-queue.ts) owns the batching/retry policy; this class only knows
 * how to store and retrieve rows.
 *
 * **`sql.js`, not a native binding (e.g. `better-sqlite3`)**: a native
 * addon statically linking its own SQLite reliably segfaults inside
 * Electron's process in this codebase's own testing — Electron/Chromium
 * already embeds its own SQLite internally, and the two collide.
 * Reproduced with `better-sqlite3` both via its shipped prebuilt binary
 * *and* a from-source build compiled directly against Electron's own
 * headers (same crash either way — see the desktop-electron-builder-gotchas
 * lesson this generalizes: not every native-module problem is a rebuild/
 * ABI issue `npmRebuild`/`asarUnpack` can fix). `sql.js` runs as WASM in
 * its own linear memory, immune to that class of native-symbol collision,
 * and needs no per-platform native build or `asarUnpack` entry at all.
 *
 * **The trade-off**: `sql.js` has no incremental journal — persisting
 * means re-exporting and rewriting the *entire* database file. A
 * screenshot's image bytes are therefore never stored inline in the
 * database; they're written to their own file under `<db path>.blobs/<row
 * id>` next to the database file instead, keeping every row in the
 * database itself small (a JSON payload string plus bookkeeping columns)
 * so a full rewrite on every mutation stays cheap no matter how many
 * screenshots are queued.
 */
export class OfflineQueueStore {
  private readonly persistent: boolean;
  private readonly blobsDir: string;
  /** Backs blob storage for an in-memory store (tests) — there's no `blobsDir` on disk to use. */
  private readonly memoryBlobs = new Map<number, Buffer>();

  private constructor(
    private readonly db: SqlJsDatabase,
    private readonly dbPath: string,
  ) {
    this.persistent = dbPath !== IN_MEMORY;
    this.blobsDir = `${dbPath}.blobs`;
  }

  static async create(dbPath: string): Promise<OfflineQueueStore> {
    const SQL = await initSqlJs();
    const existing =
      dbPath !== IN_MEMORY && existsSync(dbPath) ? readFileSync(dbPath) : undefined;
    const db = new SQL.Database(existing);
    db.run(`
      CREATE TABLE IF NOT EXISTS queued_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        hasBlob INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        nextAttemptAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_queued_items_kind_next
        ON queued_items (kind, nextAttemptAt, id);
    `);

    const store = new OfflineQueueStore(db, dbPath);
    if (store.persistent) {
      mkdirSync(store.blobsDir, { recursive: true });
      store.persist();
    }
    return store;
  }

  /**
   * Inserts one item, immediately eligible for sending (`nextAttemptAt` =
   * `now`), then trims this `kind` down to `maxQueuedItems` by dropping its
   * oldest rows if needed — a safety valve against unbounded disk growth
   * during a very long offline stretch, favouring recent data over old.
   */
  enqueue(
    kind: string,
    payload: string,
    blob: Buffer | null,
    now: Date,
    maxQueuedItems: number,
  ): void {
    const nowIso = now.toISOString();
    this.db.run(
      `INSERT INTO queued_items (kind, payload, hasBlob, attempts, createdAt, nextAttemptAt)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [kind, payload, blob ? 1 : 0, nowIso, nowIso],
    );
    if (blob) this.writeBlob(this.lastInsertRowId(), blob);

    const overflowIds = this.selectOverflowIds(kind, maxQueuedItems);
    if (overflowIds.length > 0) this.deleteRows(overflowIds);

    this.persist();
  }

  /** Up to `limit` items of `kind` that are due (`nextAttemptAt <= now`), oldest first. */
  takeBatch(kind: string, limit: number, now: Date): QueuedRow[] {
    const stmt = this.db.prepare(
      `SELECT id, kind, payload, hasBlob, attempts, createdAt, nextAttemptAt
       FROM queued_items WHERE kind = :kind AND nextAttemptAt <= :now
       ORDER BY id ASC LIMIT :limit`,
    );
    stmt.bind({ ':kind': kind, ':now': now.toISOString(), ':limit': limit });
    const rows: QueuedRow[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as {
        id: number;
        kind: string;
        payload: string;
        hasBlob: number;
        attempts: number;
        createdAt: string;
        nextAttemptAt: string;
      };
      rows.push({
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        blob: row.hasBlob ? this.readBlob(row.id) : null,
        attempts: row.attempts,
        createdAt: row.createdAt,
        nextAttemptAt: row.nextAttemptAt,
      });
    }
    stmt.free();
    return rows;
  }

  /** Removes items that were successfully sent. */
  remove(ids: number[]): void {
    if (ids.length === 0) return;
    this.deleteRows(ids);
    this.persist();
  }

  /** Bumps `attempts` and sets a new `nextAttemptAt` for items that failed to send. */
  scheduleRetry(entries: RetryEntry[]): void {
    if (entries.length === 0) return;
    for (const entry of entries) {
      this.db.run(
        `UPDATE queued_items SET attempts = attempts + 1, nextAttemptAt = ? WHERE id = ?`,
        [entry.nextAttemptAt.toISOString(), entry.id],
      );
    }
    this.persist();
  }

  /** Total rows currently queued for `kind` — diagnostics/tests, not used on the send path. */
  countPending(kind: string): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM queued_items WHERE kind = ?`);
    stmt.bind([kind]);
    stmt.step();
    const count = stmt.get()[0] as number;
    stmt.free();
    return count;
  }

  close(): void {
    this.db.close();
  }

  private lastInsertRowId(): number {
    const stmt = this.db.prepare('SELECT last_insert_rowid() AS id');
    stmt.step();
    const id = stmt.get()[0] as number;
    stmt.free();
    return id;
  }

  private selectOverflowIds(kind: string, maxQueuedItems: number): number[] {
    const stmt = this.db.prepare(
      `SELECT id FROM queued_items WHERE kind = :kind ORDER BY id ASC
       LIMIT MAX(0, (SELECT COUNT(*) FROM queued_items WHERE kind = :kind) - :max)`,
    );
    stmt.bind({ ':kind': kind, ':max': maxQueuedItems });
    const ids: number[] = [];
    while (stmt.step()) ids.push(stmt.get()[0] as number);
    stmt.free();
    return ids;
  }

  private deleteRows(ids: number[]): void {
    if (ids.length === 0) return;
    for (const id of ids) this.removeBlob(id);
    const placeholders = ids.map(() => '?').join(',');
    this.db.run(`DELETE FROM queued_items WHERE id IN (${placeholders})`, ids);
  }

  private blobPath(id: number): string {
    return join(this.blobsDir, String(id));
  }

  private writeBlob(id: number, blob: Buffer): void {
    if (!this.persistent) {
      this.memoryBlobs.set(id, blob);
      return;
    }
    writeFileSync(this.blobPath(id), blob);
  }

  private readBlob(id: number): Buffer | null {
    if (!this.persistent) return this.memoryBlobs.get(id) ?? null;
    const path = this.blobPath(id);
    return existsSync(path) ? readFileSync(path) : null;
  }

  private removeBlob(id: number): void {
    if (!this.persistent) {
      this.memoryBlobs.delete(id);
      return;
    }
    const path = this.blobPath(id);
    if (existsSync(path)) rmSync(path);
  }

  /** Re-exports and rewrites the whole database file — see the class doc's trade-off note. Writes to a temp file and renames over the real path, so a crash mid-write never leaves a torn file behind. */
  private persist(): void {
    if (!this.persistent) return;
    const data = this.db.export();
    const tmpPath = `${this.dbPath}.tmp`;
    writeFileSync(tmpPath, Buffer.from(data));
    renameSync(tmpPath, this.dbPath);
  }
}
