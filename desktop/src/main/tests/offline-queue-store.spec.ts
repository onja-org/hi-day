import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
