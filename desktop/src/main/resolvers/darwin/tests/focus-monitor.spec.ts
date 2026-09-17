import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusMonitor, parseFrontmostAppOutput, type FocusPollResult, type FocusSource, type FocusTarget } from '../focus-monitor';

const CHROME: FocusTarget = {
  pid: 100,
  bundleId: 'com.google.Chrome',
  appName: 'Google Chrome',
  title: 'Example Page',
  bounds: { x: 0, y: 0, width: 800, height: 600 },
};
const SLACK: FocusTarget = {
  pid: 200,
  bundleId: 'com.tinyspeck.slackmacgap',
  appName: 'Slack',
  title: '#general',
  bounds: { x: 0, y: 0, width: 400, height: 300 },
};

class QueuedFocusSource implements FocusSource {
  constructor(private readonly results: FocusPollResult[]) {}
  private index = 0;

  poll(): Promise<FocusPollResult> {
    const result = this.results[Math.min(this.index, this.results.length - 1)];
    this.index += 1;
    return Promise.resolve(result);
  }
}

describe('parseFrontmostAppOutput', () => {
  it('parses the 8-field tab-separated frontmost-app output', () => {
    const result = parseFrontmostAppOutput('Google Chrome\tcom.google.Chrome\t100\tExample Page\t0\t0\t800\t600\n');
    expect(result).toEqual(CHROME);
  });

  it('returns null for an unexpected field count', () => {
    expect(parseFrontmostAppOutput('not enough fields')).toBeNull();
  });
});

describe('FocusMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits focusChanged only when the frontmost app actually changes', async () => {
    const source = new QueuedFocusSource([
      { status: 'ok', target: CHROME },
      { status: 'ok', target: CHROME }, // same app again — no event expected
      { status: 'ok', target: SLACK },
      { status: 'ok', target: SLACK },
    ]);
    const monitor = new FocusMonitor(source, 100);
    const events: (FocusTarget | null)[] = [];
    monitor.on('focusChanged', (target) => events.push(target));

    monitor.start(); // fires an immediate poll
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    monitor.stop();
    expect(events).toEqual([CHROME, SLACK]);
  });

  it('skips a poll that reports unavailable rather than treating it as focus loss', async () => {
    const source = new QueuedFocusSource([
      { status: 'ok', target: CHROME },
      { status: 'unavailable' }, // e.g. a resolve() call raced this poll
      { status: 'ok', target: CHROME },
    ]);
    const monitor = new FocusMonitor(source, 100);
    const events: (FocusTarget | null)[] = [];
    monitor.on('focusChanged', (target) => events.push(target));

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    monitor.stop();
    // Only the very first poll produced a real (first-ever) transition.
    expect(events).toEqual([CHROME]);
  });

  it('emits null when focus is confirmed lost (no frontmost app)', async () => {
    const source = new QueuedFocusSource([{ status: 'ok', target: CHROME }, { status: 'ok', target: null }]);
    const monitor = new FocusMonitor(source, 100);
    const events: (FocusTarget | null)[] = [];
    monitor.on('focusChanged', (target) => events.push(target));

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);

    monitor.stop();
    expect(events).toEqual([CHROME, null]);
  });
});
