import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncQueue } from '../sync-queue';
import { UrlSessionStore } from '../store';
import type { UrlSession } from '../session-types';
import type { UploadFn } from '../sync-contract';

let dir: string;
let store: UrlSessionStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sync-queue-'));
  store = new UrlSessionStore(join(dir, 'sessions.sqlite'));
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function makeSession(id: string, endedAt: number | null = 1_700_000_005_000): UrlSession {
  return {
    id,
    url: 'example.com/a',
    host: 'example.com',
    path: '/a',
    title: 'A',
    browser: 'chrome',
    private: false,
    deviceId: 'device-1',
    startedAt: 1_700_000_000_000,
    endedAt,
    activeMs: 5_000,
    tzOffsetMin: 0,
    source: 'uia',
    confidence: 'displayed',
  };
}

describe('SyncQueue', () => {
  it('does nothing when there is no pending batch', async () => {
    const upload: UploadFn = () => Promise.resolve({ acked: [] });
    const queue = new SyncQueue(store, upload);
    const result = await queue.runOnce();
    expect(result).toEqual({ uploaded: 0, acked: 0 });
  });

  it('marks every row synced when the upload fully acks the batch', async () => {
    store.upsert(makeSession('a'));
    store.upsert(makeSession('b'));

    const upload: UploadFn = (batch) => Promise.resolve({ acked: batch.map((s) => s.id) });
    const queue = new SyncQueue(store, upload);
    const result = await queue.runOnce();

    expect(result).toEqual({ uploaded: 2, acked: 2 });
    expect(store.getPendingSync(10)).toEqual([]);
  });

  it('survives a simulated crash mid-batch: a throwing upload leaves every row pending', async () => {
    store.upsert(makeSession('a'));
    store.upsert(makeSession('b'));

    const upload: UploadFn = () => Promise.reject(new Error('simulated crash mid-upload'));
    const queue = new SyncQueue(store, upload);

    await expect(queue.runOnce()).rejects.toThrow('simulated crash mid-upload');

    // Nothing was marked synced — a later, successful attempt sees the exact same batch.
    expect(store.getPendingSync(10).map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('retry after a partial ack produces no duplicates and only re-sends what is still pending', async () => {
    store.upsert(makeSession('a'));
    store.upsert(makeSession('b'));
    store.upsert(makeSession('c'));

    const uploadedBatches: string[][] = [];
    let callCount = 0;
    const upload: UploadFn = (batch) => {
      callCount += 1;
      uploadedBatches.push(batch.map((s) => s.id));
      // First call: only 'a' is acked, 'b' and 'c' are (simulated) rejected/unprocessed.
      if (callCount === 1) return Promise.resolve({ acked: batch.filter((s) => s.id === 'a').map((s) => s.id) });
      // Second call: everything remaining now succeeds.
      return Promise.resolve({ acked: batch.map((s) => s.id) });
    };
    const queue = new SyncQueue(store, upload);

    const first = await queue.runOnce();
    expect(first).toEqual({ uploaded: 3, acked: 1 });
    expect(store.getPendingSync(10).map((r) => r.id).sort()).toEqual(['b', 'c']);

    const second = await queue.runOnce();
    expect(second).toEqual({ uploaded: 2, acked: 2 });
    expect(store.getPendingSync(10)).toEqual([]);

    // 'a' was only ever sent once — the retry only contained the still-pending ids.
    expect(uploadedBatches).toEqual([
      ['a', 'b', 'c'],
      ['b', 'c'],
    ]);
  });

  it('never uploads an open session', async () => {
    store.upsert(makeSession('open-one', null));
    const upload: UploadFn = (batch) => Promise.resolve({ acked: batch.map((s) => s.id) });
    const queue = new SyncQueue(store, upload);
    const result = await queue.runOnce();
    expect(result).toEqual({ uploaded: 0, acked: 0 });
  });
});
