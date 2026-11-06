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

function hasColumn(db: SqlJsDatabase, table: string, column: string): boolean {
  const result = db.exec(`PRAGMA table_info(${table})`);
  const rows = result[0]?.values ?? [];
  // PRAGMA table_info's second column is the column name.
  return rows.some((row) => row[1] === column);
}

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
    // Who captured each row (session-owner.ts). Added after the table
    // shipped, so an existing database gets the column here; its rows stay
    // NULL, which no logged-in owner matches.
    if (!hasColumn(db, 'queued_items', 'owner')) {
      db.run('ALTER TABLE queued_items ADD COLUMN owner TEXT');
    }

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
    owner: string | null = null,
  ): void {
    const nowIso = now.toISOString();
    this.db.run(
      `INSERT INTO queued_items (kind, payload, hasBlob, attempts, createdAt, nextAttemptAt, owner)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [kind, payload, blob ? 1 : 0, nowIso, nowIso, owner],
    );
    if (blob) this.writeBlob(this.lastInsertRowId(), blob);

    const overflowIds = this.selectOverflowIds(kind, maxQueuedItems);
    if (overflowIds.length > 0) this.deleteRows(overflowIds);

    this.persist();
  }

  /**
   * Up to `limit` items of `kind` that are due (`nextAttemptAt <= now`) and
   * belong to `owner`, oldest first. Another owner's rows are never
   * returned, however long they have been waiting.
   */
  takeBatch(kind: string, limit: number, now: Date, owner: string | null = null): QueuedRow[] {
    const stmt = this.db.prepare(
      `SELECT id, kind, payload, hasBlob, attempts, createdAt, nextAttemptAt
       FROM queued_items WHERE kind = :kind AND nextAttemptAt <= :now AND owner IS :owner
       ORDER BY id ASC LIMIT :limit`,
    );
    stmt.bind({ ':kind': kind, ':now': now.toISOString(), ':limit': limit, ':owner': owner });
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

  /**
   * Rows currently queued for `kind` — every owner's when `owner` is left
   * out, or only that owner's (including `null`) when given.
   */
  countPending(kind: string, owner?: string | null): number {
    const stmt =
      owner === undefined
        ? this.db.prepare(`SELECT COUNT(*) as count FROM queued_items WHERE kind = ?`)
        : this.db.prepare(
            `SELECT COUNT(*) as count FROM queued_items WHERE kind = ? AND owner IS ?`,
          );
    stmt.bind(owner === undefined ? [kind] : [kind, owner]);
    stmt.step();
    const count = stmt.get()[0] as number;
    stmt.free();
    return count;
  }

  /**
   * Deletes every row, and its image, not belonging to `owner` — rows from
   * before owners were recorded (NULL) included. Returns how many went.
   */
  discardOtherOwners(owner: string): number {
    return this.discardWhere('owner IS NOT ?', [owner]);
  }

  /** Deletes every row, and its image, of every owner. */
  discardAll(): number {
    return this.discardWhere('1 = 1', []);
  }

  /** Gives rows recorded before owners existed (NULL) to `owner`. */
  adoptUnowned(owner: string): void {
    this.db.run('UPDATE queued_items SET owner = ? WHERE owner IS NULL', [owner]);
    this.persist();
  }

  private discardWhere(condition: string, params: (string | number)[]): number {
    const stmt = this.db.prepare(`SELECT id FROM queued_items WHERE ${condition}`);
    stmt.bind(params);
    const ids: number[] = [];
    while (stmt.step()) ids.push(stmt.get()[0] as number);
    stmt.free();
    if (ids.length === 0) return 0;
    this.deleteRows(ids);
    this.persist();
    return ids.length;
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
