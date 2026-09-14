import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeartbeatScheduler } from '../heartbeat-scheduler';

describe('HeartbeatScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not tick until activated', () => {
    const onTick = vi.fn();
    new HeartbeatScheduler({ intervalMs: 100, onTick });
    vi.advanceTimersByTime(500);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('ticks on the configured interval once active', () => {
    const onTick = vi.fn();
    const scheduler = new HeartbeatScheduler({ intervalMs: 100, onTick });
    scheduler.setActive(true);
    vi.advanceTimersByTime(350);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('stops ticking once deactivated', () => {
    const onTick = vi.fn();
    const scheduler = new HeartbeatScheduler({ intervalMs: 100, onTick });
    scheduler.setActive(true);
    vi.advanceTimersByTime(250);
    scheduler.setActive(false);
    vi.advanceTimersByTime(500);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('setActive(true) while already active does not reset or double the interval', () => {
    const onTick = vi.fn();
    const scheduler = new HeartbeatScheduler({ intervalMs: 100, onTick });
    scheduler.setActive(true);
    vi.advanceTimersByTime(50);
    scheduler.setActive(true); // redundant re-activation
    vi.advanceTimersByTime(50);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('isActive reflects the current state', () => {
    const scheduler = new HeartbeatScheduler({ intervalMs: 100, onTick: () => undefined });
    expect(scheduler.isActive).toBe(false);
    scheduler.setActive(true);
    expect(scheduler.isActive).toBe(true);
    scheduler.stop();
    expect(scheduler.isActive).toBe(false);
  });
});
