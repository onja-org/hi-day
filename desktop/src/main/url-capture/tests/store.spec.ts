import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UrlSessionStore } from '../store';
import type { UrlSession } from '../session-types';

let dir: string;
let dbPath: string;
let store: UrlSessionStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'url-session-store-'));
  dbPath = join(dir, 'sessions.sqlite');
  store = new UrlSessionStore(dbPath);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function makeSession(overrides: Partial<UrlSession> = {}): UrlSession {
  return {
    id: 'session-1',
    url: 'example.com/a',
    host: 'example.com',
    path: '/a',
    title: 'A',
    browser: 'chrome',
    private: false,
    deviceId: 'device-1',
    startedAt: 1_700_000_000_000,
    endedAt: null,
    activeMs: 0,
    tzOffsetMin: -300,
    source: 'uia',
    confidence: 'displayed',
    ...overrides,
  };
}

describe('UrlSessionStore — migrations', () => {
  it('runs forward cleanly from an empty database', () => {
    const raw = new Database(dbPath);
    const migrationIds = raw
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: string }).id);
    expect(migrationIds).toContain('0001_create_url_sessions');

    const columns = raw
      .prepare("PRAGMA table_info('url_sessions')")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'url', 'host', 'source', 'confidence', 'synced_at']),
    );
    raw.close();
  });

  it('is idempotent — reopening an existing database does not re-run migrations', () => {
    store.close();
    // Reopening should not throw (e.g. from re-creating an existing table).
    expect(() => new UrlSessionStore(dbPath).close()).not.toThrow();
  });
});

describe('UrlSessionStore — upsert and round-trip', () => {
  it('round-trips every field, including source and confidence', () => {
    const session = makeSession({ private: null, path: null, title: null });
    store.upsert(session);
    const row = store.getById('session-1');
    expect(row).toMatchObject(session);
    expect(row?.syncedAt).toBeNull();
  });

  it('upserting the same id again replaces the row and resets synced_at to NULL', () => {
    store.upsert(makeSession());
    store.markSynced(['session-1'], 5_000);
    expect(store.getById('session-1')?.syncedAt).toBe(5_000);

    store.upsert(makeSession({ activeMs: 999, endedAt: 1_700_000_010_000 }));
    const row = store.getById('session-1');
    expect(row?.activeMs).toBe(999);
    expect(row?.syncedAt).toBeNull();
  });
});

describe('UrlSessionStore — pending sync selection', () => {
  it('only selects closed (endedAt not null), unsynced rows', () => {
    store.upsert(makeSession({ id: 'open', endedAt: null }));
    store.upsert(makeSession({ id: 'closed-unsynced', endedAt: 1_700_000_005_000 }));
    store.upsert(makeSession({ id: 'closed-synced', endedAt: 1_700_000_005_000 }));
    store.markSynced(['closed-synced'], 6_000);

    const pending = store.getPendingSync(10);
    expect(pending.map((r) => r.id)).toEqual(['closed-unsynced']);
  });

  it('respects the limit', () => {
    for (let i = 0; i < 5; i += 1) {
      store.upsert(makeSession({ id: `s${i}`, endedAt: 1_700_000_000_000 + i }));
    }
    expect(store.getPendingSync(2)).toHaveLength(2);
  });
});

describe('UrlSessionStore — purge', () => {
  it('deletes closed rows older than the cutoff, never touches an open session', () => {
    store.upsert(makeSession({ id: 'old-closed', endedAt: 1_000 }));
    store.upsert(makeSession({ id: 'recent-closed', endedAt: 9_000 }));
    store.upsert(makeSession({ id: 'ancient-but-open', startedAt: 500, endedAt: null }));

    const deleted = store.purgeOlderThan(5_000);

    expect(deleted).toBe(1);
    expect(store.getById('old-closed')).toBeNull();
    expect(store.getById('recent-closed')).not.toBeNull();
    expect(store.getById('ancient-but-open')).not.toBeNull();
  });
});
