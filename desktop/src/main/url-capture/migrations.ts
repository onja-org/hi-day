import type Database from 'better-sqlite3';

export interface Migration {
  id: string;
  up: (db: Database.Database) => void;
}

/**
 * `source` and `confidence` are present from the very first migration —
 * adding them later would be a backfill across every row ever written
 * (see docs/url-tracking-plan.md Step 5 and CLAUDE.md's hard constraint #8).
 */
export const MIGRATIONS: Migration[] = [
  {
    id: '0001_create_url_sessions',
    up: (db) => {
      db.exec(`
        CREATE TABLE url_sessions (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          host TEXT NOT NULL,
          path TEXT,
          title TEXT,
          browser TEXT NOT NULL,
          is_private INTEGER,
          device_id TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          active_ms INTEGER NOT NULL,
          tz_offset_min INTEGER NOT NULL,
          source TEXT NOT NULL,
          confidence TEXT NOT NULL,
          synced_at INTEGER
        );
        CREATE INDEX idx_url_sessions_pending_sync ON url_sessions(ended_at, synced_at);
      `);
    },
  },
];

/**
 * Bootstraps the migrations ledger if needed, then applies whatever isn't
 * recorded there yet, in order, each inside its own transaction.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row) => (row as { id: string }).id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const runInTransaction = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        Date.now(),
      );
    });
    runInTransaction();
  }
}
