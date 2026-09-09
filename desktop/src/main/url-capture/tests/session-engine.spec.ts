import { describe, expect, it } from 'vitest';
import type { Confidence, Source } from '../protocol';
import { SessionEngine } from '../session-engine';
import type { EngineEvent, EngineOutput, FocusTarget, SessionEngineOptions } from '../session-types';

const DEVICE_ID = 'device-1';
const CHROME: FocusTarget = { browser: 'chrome', pid: 100, hwnd: 200 };
const BASE_WALL = 1_700_000_000_000;

function makeEngine(overrides: Partial<SessionEngineOptions> = {}): { engine: SessionEngine; ids: string[] } {
  const ids: string[] = [];
  let counter = 0;
  const generateId = (): string => {
    counter += 1;
    const id = `session-${counter}`;
    ids.push(id);
    return id;
  };
  const engine = new SessionEngine({
    deviceId: DEVICE_ID,
    generateId,
    mergeWindowMs: 30_000,
    minSessionFloorMs: 2_000,
    ...overrides,
  });
  return { engine, ids };
}

interface UrlResolvedOverrides {
  pid?: number;
  hwnd?: number;
  host?: string;
  path?: string | null;
  title?: string | null;
  browser?: string;
  private?: boolean | null;
  source?: Source;
  confidence?: Confidence;
}

function focusChanged(monotonicMs: number, target: FocusTarget | null, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'focusChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, target };
}

function urlResolved(
  monotonicMs: number,
  url: string,
  overrides: UrlResolvedOverrides = {},
  wallClockMs = BASE_WALL + monotonicMs,
): EngineEvent {
  return {
    type: 'urlResolved',
    monotonicMs,
    wallClockMs,
    tzOffsetMin: 0,
    pid: overrides.pid ?? CHROME.pid,
    hwnd: overrides.hwnd ?? CHROME.hwnd,
    url,
    host: overrides.host ?? url,
    path: overrides.path ?? null,
    title: overrides.title ?? url,
    browser: overrides.browser ?? CHROME.browser,
    private: overrides.private ?? false,
    source: overrides.source ?? 'uia',
    confidence: overrides.confidence ?? 'displayed',
  };
}

function idleChanged(monotonicMs: number, idle: boolean, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'idleChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, idle };
}

function screenLockChanged(monotonicMs: number, locked: boolean, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'screenLockChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, locked };
}

function powerStateChanged(monotonicMs: number, awake: boolean, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'powerStateChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, awake };
}

function timerStateChanged(monotonicMs: number, running: boolean, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'timerStateChanged', monotonicMs, wallClockMs, tzOffsetMin: 0, running };
}

function dayBoundaryCrossed(monotonicMs: number, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'dayBoundaryCrossed', monotonicMs, wallClockMs, tzOffsetMin: 0 };
}

function heartbeat(monotonicMs: number, wallClockMs = BASE_WALL + monotonicMs): EngineEvent {
  return { type: 'heartbeat', monotonicMs, wallClockMs, tzOffsetMin: 0 };
}

/** timer on + focus + first resolve, at t=0 — the common starting point for most cases. */
function openBaseline(engine: SessionEngine, url = 'example.com/a'): EngineOutput[] {
  return [
    ...engine.processEvent(timerStateChanged(0, true)),
    ...engine.processEvent(focusChanged(0, CHROME)),
    ...engine.processEvent(urlResolved(0, url)),
  ];
}

function kinds(outputs: EngineOutput[]): string[] {
  return outputs.map((o) => o.kind);
}

describe('SessionEngine — basic lifecycle', () => {
  it('opens on the first resolve, extends on heartbeats, closes on focus loss', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    const opened = openBaseline(engine);
    expect(kinds(opened)).toEqual(['opened']);
    expect(opened[0].session).toMatchObject({ activeMs: 0, endedAt: null, deviceId: DEVICE_ID });

    const tick1 = engine.processEvent(heartbeat(1_000));
    expect(kinds(tick1)).toEqual(['extended']);
    expect(tick1[0].session.activeMs).toBe(1_000);

    const closed = engine.processEvent(focusChanged(1_500, null));
    expect(kinds(closed)).toEqual(['extended', 'closed']);
    const closedOut = closed[closed.length - 1];
    expect(closedOut.session.activeMs).toBe(1_500);
    expect(closedOut.session.endedAt).toBe(BASE_WALL + 1_500);
  });
});

describe('SessionEngine — required scenarios', () => {
  it('suspend mid-session then resume on the same URL merges within the window', () => {
    const { engine, ids } = makeEngine();
    openBaseline(engine);
    engine.processEvent(heartbeat(2_000));

    const suspended = engine.processEvent(powerStateChanged(2_500, false));
    expect(kinds(suspended)).toContain('closed');
    const closedSession = suspended[suspended.length - 1].session;
    expect(closedSession.activeMs).toBe(2_500);

    // Resume shortly after (wall-clock gap well inside the merge window);
    // monotonic time is frozen for the duration of the (simulated) suspend.
    engine.processEvent(powerStateChanged(2_500, true, BASE_WALL + 10_000));
    const reopened = engine.processEvent(urlResolved(2_500, 'example.com/a', {}, BASE_WALL + 10_100));

    expect(kinds(reopened)).toEqual(['extended']);
    expect(reopened[0].session.id).toBe(ids[0]);
    expect(reopened[0].session.endedAt).toBeNull();
  });

  it('drops a urlResolved that arrives while locked, and requires a fresh focus+resolve after unlock', () => {
    const { engine, ids } = makeEngine({ minSessionFloorMs: 0 });
    openBaseline(engine);

    const locked = engine.processEvent(screenLockChanged(1_000, true));
    expect(kinds(locked)).toEqual(['extended', 'closed']);

    const whileLocked = engine.processEvent(urlResolved(1_500, 'example.com/b'));
    expect(whileLocked).toEqual([]);

    engine.processEvent(screenLockChanged(1_500, false));
    const stillNothing = engine.processEvent(urlResolved(1_600, 'example.com/b'));
    // Unlock alone doesn't restore focus — a real focusChanged is required too.
    expect(stillNothing).toEqual([]);

    const freshFocus = engine.processEvent(focusChanged(1_700, CHROME));
    expect(freshFocus).toEqual([]);
    const freshOpen = engine.processEvent(urlResolved(1_800, 'example.com/b'));
    expect(kinds(freshOpen)).toEqual(['opened']);
    expect(freshOpen[0].session.id).not.toBe(ids[0]);
  });

  it('flags a session whose activeMs exceeds the wall-clock span after the clock jumps backward', () => {
    const { engine } = makeEngine();
    openBaseline(engine);
    engine.processEvent(heartbeat(5_000));

    // Wall clock jumps back an hour; monotonic keeps advancing normally.
    const afterJump = engine.processEvent(heartbeat(6_000, BASE_WALL - 3_600_000));
    expect(afterJump[0].session.activeMs).toBe(6_000);
    expect(afterJump[0].flags).toContain('active-ms-exceeds-wall-clock');
  });

  it('handles a URL change immediately followed by idle at the same instant', () => {
    const { engine, ids } = makeEngine({ minSessionFloorMs: 0 });
    openBaseline(engine);

    // Same monotonic/wall timestamp on both events — genuine "same tick".
    const urlChangeOutputs = engine.processEvent(urlResolved(1_000, 'example.com/b'));
    const idleOutputs = engine.processEvent(idleChanged(1_000, true));
    const all = [...urlChangeOutputs, ...idleOutputs];

    // Accounting first (extended), then the old URL's session closes, the new
    // one opens, and idle immediately closes that brand-new session too.
    expect(kinds(all)).toEqual(['extended', 'closed', 'opened', 'closed']);
    expect(all[1].session.id).toBe(ids[0]);
    expect(all[2].session.id).not.toBe(ids[0]);
    expect(all[3].session.id).toBe(all[2].session.id);
    expect(all[3].session.activeMs).toBe(0);
  });

  it('handles idle immediately followed by a URL change at the same instant', () => {
    const { engine, ids } = makeEngine({ minSessionFloorMs: 0 });
    openBaseline(engine);

    const idleOutputs = engine.processEvent(idleChanged(1_000, true));
    const urlChangeOutputs = engine.processEvent(urlResolved(1_000, 'example.com/b'));
    const all = [...idleOutputs, ...urlChangeOutputs];

    // Idle closes the open session; the URL change while idle opens nothing.
    expect(kinds(all)).toEqual(['extended', 'closed']);
    expect(all[1].session.id).toBe(ids[0]);
  });

  it('closes on timer stop, and resuming the timer on the same URL merges within the window', () => {
    const { engine, ids } = makeEngine({ minSessionFloorMs: 0 });
    openBaseline(engine);
    engine.processEvent(heartbeat(1_000));

    const stopped = engine.processEvent(timerStateChanged(1_000, false));
    expect(kinds(stopped)).toEqual(['closed']);

    engine.processEvent(timerStateChanged(1_000, true, BASE_WALL + 5_000));
    const resumed = engine.processEvent(urlResolved(1_000, 'example.com/a', {}, BASE_WALL + 5_050));
    expect(kinds(resumed)).toEqual(['extended']);
    expect(resumed[0].session.id).toBe(ids[0]);
  });

  it('closes on a day boundary and never merges across it, even for the same URL', () => {
    const { engine, ids } = makeEngine({ minSessionFloorMs: 0 });
    openBaseline(engine);
    engine.processEvent(heartbeat(1_000));

    const crossed = engine.processEvent(dayBoundaryCrossed(1_000));
    expect(kinds(crossed)).toEqual(['closed']);

    const reresolved = engine.processEvent(urlResolved(1_001, 'example.com/a', {}, BASE_WALL + 1_001));
    expect(kinds(reresolved)).toEqual(['opened']);
    expect(reresolved[0].session.id).not.toBe(ids[0]);
  });

  it('50 rapid alt-tabs away and back to the same URL collapse into one session', () => {
    // The plan's own motivating case: "an alt-tab-heavy afternoon produces
    // thousands of two-second rows" — every switch is away from and back to
    // the SAME page, each gap well inside the merge window.
    const { engine, ids } = makeEngine({ mergeWindowMs: 2_000 });
    engine.processEvent(timerStateChanged(0, true));

    let t = 0;
    const openedIds = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      engine.processEvent(focusChanged(t, CHROME));
      const outputs = engine.processEvent(urlResolved(t, 'example.com/doc'));
      for (const out of outputs) {
        if (out.kind === 'opened') openedIds.add(out.session.id);
      }
      t += 200; // brief moment on the page
      engine.processEvent(focusChanged(t, null)); // alt-tab away
      t += 400; // brief moment elsewhere
    }

    expect(t).toBeLessThanOrEqual(30_000);
    expect(openedIds.size).toBe(1);
    expect(ids).toHaveLength(1);
  });

  it('a resolver returning the same URL on 20 consecutive heartbeats produces one session, not 20', () => {
    const { engine, ids } = makeEngine();
    const outputs: EngineOutput[] = [...openBaseline(engine)];

    let t = 1_000;
    for (let i = 0; i < 20; i += 1) {
      outputs.push(...engine.processEvent(heartbeat(t)));
      outputs.push(...engine.processEvent(urlResolved(t, 'example.com/a')));
      t += 5_000;
    }

    const openedCount = outputs.filter((o) => o.kind === 'opened').length;
    expect(openedCount).toBe(1);
    for (const out of outputs) {
      expect(out.session.id).toBe(ids[0]);
    }
  });

  it('ignores a lower-precedence reading that arrives after a higher-precedence one for the same window', () => {
    const { engine } = makeEngine();
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    const opened = engine.processEvent(
      urlResolved(0, 'github.com/onja/agent', { source: 'apple-events', confidence: 'exact' }),
    );
    expect(opened[0].session.source).toBe('apple-events');

    // A later, lower-precedence reading disagrees on the URL entirely. Time
    // still accounts normally (hence 'extended') — it's just not believed.
    const stale = engine.processEvent(
      urlResolved(1_000, 'some-other-guessed-host.example', { source: 'title', confidence: 'guess' }),
    );
    expect(kinds(stale)).toEqual(['extended']);
    expect(stale[0].session.url).toBe('github.com/onja/agent');
    expect(stale[0].session.source).toBe('apple-events');

    const closed = engine.processEvent(focusChanged(2_000, null));
    const finalSession = closed[closed.length - 1].session;
    expect(finalSession.url).toBe('github.com/onja/agent');
    expect(finalSession.source).toBe('apple-events');
  });
});

describe('SessionEngine — additional coverage', () => {
  it('an equal-precedence reading for the same window and URL still refreshes metadata', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    openBaseline(engine);
    engine.processEvent(
      urlResolved(1_000, 'example.com/a', { title: 'Updated Title', source: 'uia', confidence: 'displayed' }),
    );

    const closed = engine.processEvent(focusChanged(1_000, null));
    expect(closed[closed.length - 1].session.title).toBe('Updated Title');
  });

  it('never emits closed for a session that never reaches the minimum floor', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 5_000 });
    openBaseline(engine);
    engine.processEvent(heartbeat(1_000));
    const closed = engine.processEvent(focusChanged(1_500, null));
    expect(kinds(closed)).toEqual(['extended']); // no 'closed' — 1500ms < 5000ms floor
  });

  it('carries tzOffsetMin from the opening event through to the emitted session', () => {
    const { engine } = makeEngine();
    const boot = engine.processEvent(timerStateChanged(0, true));
    expect(boot).toEqual([]);
    engine.processEvent(focusChanged(0, CHROME));
    const resolved = engine.processEvent({
      type: 'urlResolved',
      monotonicMs: 0,
      wallClockMs: BASE_WALL,
      tzOffsetMin: -300,
      pid: CHROME.pid,
      hwnd: CHROME.hwnd,
      url: 'example.com/a',
      host: 'example.com',
      path: '/a',
      title: 'A',
      browser: 'chrome',
      private: false,
      source: 'uia',
      confidence: 'displayed',
    });
    expect(resolved[0].session.tzOffsetMin).toBe(-300);
  });
});
