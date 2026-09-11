import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeRetryDelayMs, OfflineQueue } from '../offline-queue';
import { OfflineQueueStore } from '../offline-queue-store';
import type { QueuedItem, QueueSender } from '../offline-queue';

describe('computeRetryDelayMs', () => {
  it('never returns less than the base delay', () => {
    for (let attempts = 1; attempts <= 10; attempts++) {
      expect(computeRetryDelayMs(attempts, 1000, 60_000, () => 0)).toBeGreaterThanOrEqual(1000);
    }
  });

  it('never exceeds the max delay', () => {
    for (let attempts = 1; attempts <= 20; attempts++) {
      expect(computeRetryDelayMs(attempts, 1000, 60_000, () => 1)).toBeLessThanOrEqual(60_000);
    }
  });

  it('grows with attempts (before hitting the cap)', () => {
    // Fix randomness to 0 (always the floor) so growth is only from the exponential ceiling.
    const delay1 = computeRetryDelayMs(1, 1000, 60_000, () => 0);
    const delay3 = computeRetryDelayMs(3, 1000, 60_000, () => 0);
    expect(delay3).toBeGreaterThanOrEqual(delay1);
  });

  it('caps growth once the exponential ceiling exceeds maxDelayMs', () => {
    const delayAt10 = computeRetryDelayMs(10, 1000, 60_000, () => 1);
    const delayAt20 = computeRetryDelayMs(20, 1000, 60_000, () => 1);
    expect(delayAt10).toBe(60_000);
    expect(delayAt20).toBe(60_000);
  });
});

describe('OfflineQueue', () => {
  let store: OfflineQueueStore;

  beforeEach(async () => {
    store = await OfflineQueueStore.create(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  function makeSender(overrides: Partial<QueueSender<{ n: number }>> = {}) {
    const send = vi.fn().mockResolvedValue(true);
    const sender: QueueSender<{ n: number }> = {
      kind: 'test-kind',
      maxBatchSize: 10,
      send,
      ...overrides,
    };
    // `send` here is the default mock above — a test that overrides `send`
    // must declare its own local and pass it via `overrides`, then assert
    // against that same local (see the tests below), not this return
    // value, otherwise it'd be asserting on a mock `sender` never calls.
    return { sender, send };
  }

  it('sends a queued item and removes it once accepted', async () => {
    const { sender, send } = makeSender();
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    await queue.flushKind('test-kind');

    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as QueuedItem[]).map((i) => i.payload)).toEqual([{ n: 1 }]);
    expect(store.countPending('test-kind')).toBe(0);
  });

  it('leaves a failed item queued for a later retry rather than dropping it', async () => {
    const send = vi.fn().mockResolvedValue(false);
    const { sender } = makeSender({ send });
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    await queue.flushKind('test-kind');

    expect(send).toHaveBeenCalledTimes(1);
    expect(store.countPending('test-kind')).toBe(1);
  });

  it('does not resend an item still inside its retry backoff window', async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { sender } = makeSender({ send });
    const queue = new OfflineQueue(store, undefined, () => 1); // random()=1 → max backoff for the failure
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    await queue.flushKind('test-kind'); // fails, schedules a far-future retry
    await queue.flushKind('test-kind'); // called again immediately — should be a no-op

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('treats a thrown send as a failure and keeps the item queued', async () => {
    const { sender } = makeSender({ send: vi.fn().mockRejectedValue(new Error('boom')) });
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    await expect(queue.flushKind('test-kind')).resolves.toBeUndefined();

    expect(store.countPending('test-kind')).toBe(1);
  });

  it('batches up to maxBatchSize and keeps draining full batches in one flush', async () => {
    const send = vi.fn().mockResolvedValue(true);
    const { sender } = makeSender({ maxBatchSize: 2, send });
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    queue.enqueue('test-kind', { n: 2 });
    queue.enqueue('test-kind', { n: 3 });
    await queue.flushKind('test-kind');

    expect(send).toHaveBeenCalledTimes(2);
    expect((send.mock.calls[0][0] as QueuedItem[])).toHaveLength(2);
    expect((send.mock.calls[1][0] as QueuedItem[])).toHaveLength(1);
    expect(store.countPending('test-kind')).toBe(0);
  });

  it('stops draining a kind as soon as one batch fails, without touching other kinds', async () => {
    const failingSend = vi.fn().mockResolvedValue(false);
    const okSend = vi.fn().mockResolvedValue(true);
    const queue = new OfflineQueue(store);
    queue.registerSender({ kind: 'a', maxBatchSize: 10, send: failingSend });
    queue.registerSender({ kind: 'b', maxBatchSize: 10, send: okSend });

    queue.enqueue('a', { n: 1 });
    queue.enqueue('b', { n: 2 });
    await queue.flushAll();

    expect(failingSend).toHaveBeenCalledTimes(1);
    expect(okSend).toHaveBeenCalledTimes(1);
    expect(store.countPending('a')).toBe(1);
    expect(store.countPending('b')).toBe(0);
  });

  it('does nothing for a kind with no registered sender', async () => {
    const queue = new OfflineQueue(store);
    await expect(queue.flushKind('unregistered')).resolves.toBeUndefined();
  });

  it('flushes a kind immediately on enqueue when flushOnEnqueue is set', () => {
    const { sender, send } = makeSender({ flushOnEnqueue: true });
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });

    // flushOnEnqueue fires a fire-and-forget flush — give the microtask queue a tick.
    return Promise.resolve().then(() => {
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  it('does not flush on enqueue by default', async () => {
    const { sender, send } = makeSender();
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    await Promise.resolve();

    expect(send).not.toHaveBeenCalled();
  });

  it('trims a kind past its own maxQueuedItems override rather than the shared default', () => {
    const { sender } = makeSender({ maxQueuedItems: 2 });
    const queue = new OfflineQueue(store);
    queue.registerSender(sender);

    queue.enqueue('test-kind', { n: 1 });
    queue.enqueue('test-kind', { n: 2 });
    queue.enqueue('test-kind', { n: 3 });

    expect(store.countPending('test-kind')).toBe(2);
  });
});

describe('OfflineQueue start/stop', () => {
  let store: OfflineQueueStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    store = await OfflineQueueStore.create(':memory:');
  });

  afterEach(() => {
    vi.useRealTimers();
    store.close();
  });

  it('flushes on its own interval while started, and stops once stopped', async () => {
    const send = vi.fn().mockResolvedValue(true);
    const queue = new OfflineQueue(store, 1_000, () => 0.5); // random()=0.5 → no jitter offset
    queue.registerSender({ kind: 'test-kind', maxBatchSize: 10, send });

    queue.enqueue('test-kind', { n: 1 });
    queue.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(send).toHaveBeenCalledTimes(1);

    queue.stop();
    queue.enqueue('test-kind', { n: 2 });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('calling start twice does not create a second timer', async () => {
    const send = vi.fn().mockResolvedValue(true);
    const queue = new OfflineQueue(store, 1_000, () => 0.5);
    queue.registerSender({ kind: 'test-kind', maxBatchSize: 10, send });

    queue.enqueue('test-kind', { n: 1 });
    queue.start();
    queue.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
