import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PowerAdapter, type MinimalPowerMonitor, type PowerMonitorEventName } from '../power-adapter';
import type { EngineClock, EngineEvent } from '../session-types';

class FakePowerMonitor implements MinimalPowerMonitor {
  private idleSeconds = 0;
  private readonly listeners = new Map<PowerMonitorEventName, Set<() => void>>();

  setIdleSeconds(seconds: number): void {
    this.idleSeconds = seconds;
  }

  getSystemIdleTime(): number {
    return this.idleSeconds;
  }

  on(event: PowerMonitorEventName, listener: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: PowerMonitorEventName, listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  fire(event: PowerMonitorEventName): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }

  listenerCount(event: PowerMonitorEventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

const BASE_CLOCK: EngineClock = { monotonicMs: 0, wallClockMs: 1_700_000_000_000, tzOffsetMin: 0 };

describe('PowerAdapter', () => {
  let powerMonitor: FakePowerMonitor;
  let events: EngineEvent[];
  let adapter: PowerAdapter;

  beforeEach(() => {
    powerMonitor = new FakePowerMonitor();
    events = [];
    adapter = new PowerAdapter(powerMonitor, {
      idleThresholdMs: 10_000,
      clock: () => BASE_CLOCK,
      onEvent: (e) => events.push(e),
    });
  });

  afterEach(() => {
    adapter.stop();
  });

  it('translates suspend/resume into powerStateChanged', () => {
    adapter.start();
    powerMonitor.fire('suspend');
    powerMonitor.fire('resume');
    expect(events).toEqual([
      { type: 'powerStateChanged', awake: false, ...BASE_CLOCK },
      { type: 'powerStateChanged', awake: true, ...BASE_CLOCK },
    ]);
  });

  it('translates lock-screen/unlock-screen into screenLockChanged', () => {
    adapter.start();
    powerMonitor.fire('lock-screen');
    powerMonitor.fire('unlock-screen');
    expect(events).toEqual([
      { type: 'screenLockChanged', locked: true, ...BASE_CLOCK },
      { type: 'screenLockChanged', locked: false, ...BASE_CLOCK },
    ]);
  });

  it('translates shutdown into timerStateChanged(running: false)', () => {
    adapter.start();
    powerMonitor.fire('shutdown');
    expect(events).toEqual([{ type: 'timerStateChanged', running: false, ...BASE_CLOCK }]);
  });

  it('emits idleChanged only on the threshold crossing, not on every poll', () => {
    adapter.start();
    powerMonitor.setIdleSeconds(5);
    adapter.pollIdle(); // below threshold (10s) — no event
    powerMonitor.setIdleSeconds(9);
    adapter.pollIdle(); // still below — no event
    powerMonitor.setIdleSeconds(11);
    adapter.pollIdle(); // crosses — one event
    powerMonitor.setIdleSeconds(12);
    adapter.pollIdle(); // still idle, no new event
    expect(events).toEqual([{ type: 'idleChanged', idle: true, ...BASE_CLOCK }]);
  });

  it('emits idleChanged(false) when real input drops idle-seconds below the previous reading', () => {
    adapter.start();
    powerMonitor.setIdleSeconds(15);
    adapter.pollIdle(); // idle: true
    powerMonitor.setIdleSeconds(0);
    adapter.pollIdle(); // real input happened — idle: false
    expect(events).toEqual([
      { type: 'idleChanged', idle: true, ...BASE_CLOCK },
      { type: 'idleChanged', idle: false, ...BASE_CLOCK },
    ]);
  });

  it('stop() unsubscribes from every powerMonitor event', () => {
    adapter.start();
    expect(powerMonitor.listenerCount('suspend')).toBe(1);
    adapter.stop();
    expect(powerMonitor.listenerCount('suspend')).toBe(0);
    expect(powerMonitor.listenerCount('resume')).toBe(0);
    expect(powerMonitor.listenerCount('lock-screen')).toBe(0);
    expect(powerMonitor.listenerCount('unlock-screen')).toBe(0);
    expect(powerMonitor.listenerCount('shutdown')).toBe(0);

    powerMonitor.fire('suspend');
    expect(events).toEqual([]);
  });

  it('start() actually wires the idle poll interval, not just pollIdle() called manually', () => {
    vi.useFakeTimers();
    try {
      adapter.start();
      powerMonitor.setIdleSeconds(11); // above the 10s threshold configured in beforeEach
      expect(events).toEqual([]); // nothing yet — the interval hasn't fired
      vi.advanceTimersByTime(5_000); // default idlePollIntervalMs
      expect(events).toEqual([{ type: 'idleChanged', idle: true, ...BASE_CLOCK }]);
      adapter.stop(); // tear down the fake-timer-backed interval before switching clocks back
    } finally {
      vi.useRealTimers();
    }
  });
});
