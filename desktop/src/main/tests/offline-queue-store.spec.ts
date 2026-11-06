import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { OfflineQueueStore } from '../offline-queue-store';

describe('OfflineQueueStore', () => {
  let store: OfflineQueueStore;

  beforeEach(async () => {
    // In-memory DB per test — isolated, no disk cleanup needed.
    store = await OfflineQueueStore.create(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('returns an enqueued item once it is due', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', JSON.stringify({ appName: 'Slack' }), null, now, 100);

    const rows = store.takeBatch('app-event', 10, now);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'app-event',
      payload: JSON.stringify({ appName: 'Slack' }),
      blob: null,
      attempts: 0,
    });
  });

  it('keeps a blob alongside the payload', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    const blob = Buffer.from('fake-jpeg-bytes');
    store.enqueue('screenshot', JSON.stringify({ capturedAt: now.toISOString() }), blob, now, 100);

    const [row] = store.takeBatch('screenshot', 10, now);

    expect(row.blob).toEqual(blob);
  });

  it('does not return an item scheduled for a later retry', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', '{}', null, now, 100);
    const [row] = store.takeBatch('app-event', 10, now);
    store.scheduleRetry([{ id: row.id, nextAttemptAt: new Date('2026-09-08T12:05:00.000Z') }]);

    expect(store.takeBatch('app-event', 10, now)).toHaveLength(0);
    expect(store.takeBatch('app-event', 10, new Date('2026-09-08T12:05:00.000Z'))).toHaveLength(1);
  });

  it('increments attempts on retry', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', '{}', null, now, 100);
    const [row] = store.takeBatch('app-event', 10, now);
    store.scheduleRetry([{ id: row.id, nextAttemptAt: now }]);

    const [retried] = store.takeBatch('app-event', 10, now);
    expect(retried.attempts).toBe(1);
  });

  it('removes items once sent', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', '{}', null, now, 100);
    const [row] = store.takeBatch('app-event', 10, now);
    store.remove([row.id]);

    expect(store.takeBatch('app-event', 10, now)).toHaveLength(0);
    expect(store.countPending('app-event')).toBe(0);
  });

  it('returns items oldest-first, respecting the limit', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', 'a', null, now, 100);
    store.enqueue('app-event', 'b', null, now, 100);
    store.enqueue('app-event', 'c', null, now, 100);

    const rows = store.takeBatch('app-event', 2, now);

    expect(rows.map((r) => r.payload)).toEqual(['a', 'b']);
  });

  it('keeps kinds separate', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', 'a', null, now, 100);
    store.enqueue('screenshot', 'b', null, now, 100);

    expect(store.takeBatch('app-event', 10, now)).toHaveLength(1);
    expect(store.takeBatch('screenshot', 10, now)).toHaveLength(1);
  });

  it('trims the oldest items of a kind once it exceeds maxQueuedItems', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');
    store.enqueue('app-event', 'a', null, now, 2);
    store.enqueue('app-event', 'b', null, now, 2);
    store.enqueue('app-event', 'c', null, now, 2);

    const rows = store.takeBatch('app-event', 10, now);

    expect(rows.map((r) => r.payload)).toEqual(['b', 'c']);
  });

  it('survives being reopened at the same path (restart durability)', async () => {
    // Not ':memory:' here — an on-disk file, closed and reopened, is the
    // actual scenario an app restart needs to survive.
    const dir = mkdtempSync(join(tmpdir(), 'offline-queue-store-'));
    const dbPath = join(dir, 'offline-queue.db');

    const first = await OfflineQueueStore.create(dbPath);
    const now = new Date('2026-09-08T12:00:00.000Z');
    first.enqueue('app-event', JSON.stringify({ appName: 'Slack' }), null, now, 100);
    first.close();

    const reopened = await OfflineQueueStore.create(dbPath);
    const rows = reopened.takeBatch('app-event', 10, now);
    reopened.close();

    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toBe(JSON.stringify({ appName: 'Slack' }));
  });

  it('keeps a screenshot blob file on disk across a restart too', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'offline-queue-store-'));
    const dbPath = join(dir, 'offline-queue.db');
    const blob = Buffer.from('fake-jpeg-bytes');

    const first = await OfflineQueueStore.create(dbPath);
    const now = new Date('2026-09-08T12:00:00.000Z');
    first.enqueue('screenshot', JSON.stringify({ capturedAt: now.toISOString() }), blob, now, 100);
    first.close();

    const reopened = await OfflineQueueStore.create(dbPath);
    const [row] = reopened.takeBatch('screenshot', 10, now);
    reopened.close();

    expect(row.blob).toEqual(blob);
  });

  describe('owners', () => {
    const now = new Date('2026-11-04T13:50:00.000Z');

    it("only hands back the owner's own rows", () => {
      store.enqueue('app-event', '"a"', null, now, 100, 'owner-a');
      store.enqueue('app-event', '"b"', null, now, 100, 'owner-b');

      expect(store.takeBatch('app-event', 10, now, 'owner-b').map((r) => r.payload)).toEqual([
        '"b"',
      ]);
      expect(store.countPending('app-event', 'owner-b')).toBe(1);
      expect(store.countPending('app-event')).toBe(2);
    });

    it("discards everyone else's rows, and their images", async () => {
      const dir = mkdtempSync(join(tmpdir(), 'offline-queue-owners-'));
      const dbPath = join(dir, 'queue.db');
      const onDisk = await OfflineQueueStore.create(dbPath);
      onDisk.enqueue('screenshot', '{}', Buffer.from('a-jpeg'), now, 100, 'owner-a');
      onDisk.enqueue('screenshot', '{}', Buffer.from('b-jpeg'), now, 100, 'owner-b');

      expect(onDisk.discardOtherOwners('owner-b')).toBe(1);

      expect(onDisk.countPending('screenshot')).toBe(1);
      expect(readdirSync(`${dbPath}.blobs`)).toHaveLength(1);
      onDisk.close();
    });

    it('adds the owner column to a database written before it existed', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'offline-queue-upgrade-'));
      const dbPath = join(dir, 'queue.db');
      const SQL = await initSqlJs();
      const old = new SQL.Database();
      old.run(`
        CREATE TABLE queued_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          payload TEXT NOT NULL,
          hasBlob INTEGER NOT NULL DEFAULT 0,
          attempts INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          nextAttemptAt TEXT NOT NULL
        );
        INSERT INTO queued_items (kind, payload, createdAt, nextAttemptAt)
          VALUES ('app-event', '"old"', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
      `);
      writeFileSync(dbPath, Buffer.from(old.export()));
      old.close();
      expect(existsSync(dbPath)).toBe(true);

      const upgraded = await OfflineQueueStore.create(dbPath);
      // Recorded before owners existed, so it is nobody's until adopted.
      expect(upgraded.takeBatch('app-event', 10, now, 'owner-a')).toEqual([]);
      upgraded.adoptUnowned('owner-a');
      expect(upgraded.takeBatch('app-event', 10, now, 'owner-a')).toHaveLength(1);
      upgraded.enqueue('app-event', '"new"', null, now, 100, 'owner-a');
      expect(upgraded.countPending('app-event', 'owner-a')).toBe(2);
      upgraded.close();
    });
  });
});
