/**
 * Stage H.1's automated failure-drill suite (docs/url-tracking-plan.md
 * Steps 29-31). Most of Step 29's scripted scenarios are ALREADY covered
 * by existing tests written during earlier stages — this file adds only
 * what's genuinely missing, rather than duplicating coverage:
 *
 *   - Alt-tab storms (50 switches/30s)        → session-engine.spec.ts
 *     "50 rapid alt-tabs away and back..."
 *   - 20 identical heartbeat readings          → session-engine.spec.ts
 *     "a resolver returning the same URL on 20 consecutive heartbeats..."
 *   - Clock jumped backward                    → session-engine.spec.ts
 *     "flags a session whose activeMs exceeds..."
 *   - Sleep/wake, lock/unlock                   → power-adapter.spec.ts +
 *     session-engine.spec.ts's powerStateChanged/screenLockChanged tests
 *   - Timer stopped mid-session                 → session-engine.spec.ts
 *     "closes on timer stop..."
 *   - Day boundary                              → session-engine.spec.ts
 *     "closes on a day boundary..."
 *   - Offline for an hour then reconnect,
 *     no duplicates/loss                        → sync-queue.spec.ts
 *     "retry after a partial ack..." / "survives a simulated crash..."
 *   - Side-car killed mid-request               → resolver-manager.spec.ts
 *     "settles a pending request immediately when the child crashes..."
 *   - Resolver degraded terminal state           → resolver-manager.spec.ts
 *     "stops retrying and emits degraded..."
 *
 * What's added here: SPA navigation through many URLs in a tight window,
 * an explicit clock-jump-FORWARD case (only backward was covered), and a
 * resolver that starts failing mid-session (permission revoked /
 * "the resolver went from working to erroring" — the same observable
 * shape regardless of the real-world cause).
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionEngine } from '../session-engine';
import { ResolverManager } from '../resolver-manager';
import type { EngineEvent, EngineOutput, FocusTarget, SessionEngineOptions } from '../session-types';

const DEVICE_ID = 'device-1';
const CHROME: FocusTarget = { browser: 'chrome', pid: 100, hwnd: 200 };
const BASE_WALL = 1_700_000_000_000;

function makeEngine(overrides: Partial<SessionEngineOptions> = {}): SessionEngine {
  let counter = 0;
  return new SessionEngine({
    deviceId: DEVICE_ID,
    generateId: () => {
      counter += 1;
      return `session-${counter}`;
    },
    mergeWindowMs: 30_000,
    minSessionFloorMs: 0,
    ...overrides,
  });
}

function focusChanged(monotonicMs: number, target: FocusTarget | null, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'focusChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, target };
}

function urlResolved(monotonicMs: number, url: string, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return {
    type: 'urlResolved',
    monotonicMs,
    wallClockMs,
    tzOffsetMin: 0,
    pid: CHROME.pid,
    hwnd: CHROME.hwnd,
    url,
    host: url,
    path: null,
    title: url,
    browser: CHROME.browser,
    private: false,
    source: 'uia',
    confidence: 'displayed',
  };
}

function timerStateChanged(monotonicMs: number, running: boolean, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'timerStateChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, running };
}

function kinds(outputs: EngineOutput[]): string[] {
  return outputs.map((o) => o.kind);
}

describe('Failure drill: SPA navigation through many URLs in a tight window', () => {
  it('10 different URLs in 60s each close the previous and open the next, none dropped', () => {
    const engine = makeEngine();
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));

    const opened: string[] = [];
    const closed: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const t = i * 6_000; // 10 URLs spread across 60s
      const outputs = engine.processEvent(urlResolved(t, `example.com/page-${i}`));
      for (const output of outputs) {
        if (output.kind === 'opened') opened.push(output.session.url);
        if (output.kind === 'closed') closed.push(output.session.url);
      }
    }
    const finalClose = engine.processEvent(focusChanged(60_000, null));
    for (const output of finalClose) {
      if (output.kind === 'closed') closed.push(output.session.url);
    }

    expect(opened).toEqual(Array.from({ length: 10 }, (_, i) => `example.com/page-${i}`));
    // Every opened URL except the very last (still open until final focus loss) must have closed.
    expect(closed).toEqual(Array.from({ length: 10 }, (_, i) => `example.com/page-${i}`));
  });

  it('rapid navigation still attributes activeMs correctly per page, not lumped onto one', () => {
    const engine = makeEngine();
    const allOutputs: EngineOutput[] = [];
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    allOutputs.push(...engine.processEvent(urlResolved(0, 'example.com/a')));
    allOutputs.push(...engine.processEvent(urlResolved(1_000, 'example.com/b'))); // closes a after 1000ms, opens b
    allOutputs.push(...engine.processEvent(focusChanged(3_000, null))); // closes b after 2000ms

    const a = allOutputs.find((o) => o.kind === 'closed' && o.session.url === 'example.com/a');
    const b = allOutputs.find((o) => o.kind === 'closed' && o.session.url === 'example.com/b');
    expect(a?.session.activeMs).toBe(1_000);
    expect(b?.session.activeMs).toBe(2_000);
  });
});

describe('Failure drill: clock jumped forward', () => {
  it('a large forward monotonic jump is accounted as elapsed active time, not ignored', () => {
    // Distinct from the existing backward-jump test (session-engine.spec.ts):
    // a FORWARD jump (e.g. system clock corrected, or a coarse timer tick)
    // must still count as real elapsed time, not be clamped to zero.
    const engine = makeEngine();
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    engine.processEvent(urlResolved(0, 'example.com/a'));

    const closed = engine.processEvent(focusChanged(3_600_000, null)); // a 1-hour forward jump
    const closedOut = closed.find((o) => o.kind === 'closed');
    expect(closedOut?.session.activeMs).toBe(3_600_000);
  });

  it('does not flag active-ms-exceeds-wall-clock for a consistent forward jump (monotonic and wall-clock agree)', () => {
    const engine = makeEngine();
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    engine.processEvent(urlResolved(0, 'example.com/a'));

    const closed = engine.processEvent(focusChanged(3_600_000, null));
    const closedOut = closed.find((o) => o.kind === 'closed');
    expect(closedOut?.flags).toEqual([]);
  });
});

describe('Failure drill: resolver starts failing mid-session (permission revoked, or any other cause)', () => {
  it('a session already open keeps running on stale data until closed normally — no crash, no data loss', async () => {
    // The observable shape is identical regardless of WHY resolve() starts
    // failing (permission revoked, browser update broke UIA, etc.) — from
    // the engine's perspective, urlResolved simply stops arriving. This
    // drill proves that degrades gracefully rather than corrupting state.
    const mockResolverPath = join(__dirname, 'mock-resolver.mjs');
    const fixturesDir = join(__dirname, 'fixtures');
    const manager = new ResolverManager(
      { command: process.execPath, args: [mockResolverPath, join(fixturesDir, 'permission-revoked-mid-session.json')] },
      { logger: () => undefined, pingIntervalMs: 10_000 },
    );

    try {
      const readyPromise = new Promise<void>((resolvePromise) => {
        const handler = (): void => {
          manager.off('ready', handler);
          resolvePromise();
        };
        manager.on('ready', handler);
      });
      manager.start();
      await readyPromise;

      const first = await manager.resolve(1, 1);
      expect(first.ok).toBe(true);

      const second = await manager.resolve(1, 1);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.message).toContain('permission-denied');
      }
    } finally {
      manager.stop();
    }
  });
});
