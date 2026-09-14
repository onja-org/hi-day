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
    // Not `?? false`: private is a tri-state (true | false | null), and `??`
    // would treat an explicitly-passed `null` as absent and silently
    // substitute `false` — exactly the distinction the null/unknown test
    // case below needs to exercise.
    private: 'private' in overrides ? (overrides.private as boolean | null) : false,
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

describe('SessionEngine — private-mode URL stripping (docs/url-tracking-plan.md Step 23)', () => {
  it('strips url/host/path from an opened session when private is true, keeping title/browser/duration', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    const opened = engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    const resolved = engine.processEvent(
      urlResolved(0, 'secret.example.com/very-private-path', {
        host: 'secret.example.com',
        path: '/very-private-path',
        title: 'A Private Page',
        private: true,
      }),
    );

    expect(opened).toEqual([]);
    const session = resolved[0].session;
    expect(session.url).toBe('');
    expect(session.host).toBe('');
    expect(session.path).toBeNull();
    // Not stripped: still useful for "time spent privately browsing" without
    // recording what was visited.
    expect(session.title).toBe('A Private Page');
    expect(session.browser).toBe('chrome');
    expect(session.private).toBe(true);
  });

  it('strips a private session on extend and on close, not just on open', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    engine.processEvent(urlResolved(0, 'secret.example.com/a', { private: true }));

    const extended = engine.processEvent(heartbeat(1_000));
    expect(extended[0].session.url).toBe('');

    const closed = engine.processEvent(focusChanged(1_500, null));
    const closedOut = closed[closed.length - 1];
    expect(closedOut.kind).toBe('closed');
    expect(closedOut.session.url).toBe('');
    expect(closedOut.session.host).toBe('');
    expect(closedOut.session.path).toBeNull();
  });

  it('does not strip when private is false', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    const opened = openBaseline(engine, 'example.com/a');

    expect(opened[0].session.url).toBe('example.com/a');
  });

  it('does not strip when private is null (unknown)', () => {
    // Whether an unknown (Safari-style) private state should suppress
    // capture entirely or be disclosed as a known gap is an explicit,
    // separate policy decision per Step 23 ("pick one deliberately") —
    // this only pins today's actual behavior (pass-through), not an
    // endorsement of it.
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    const opened = engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    const resolved = engine.processEvent(urlResolved(0, 'example.com/a', { private: null }));

    expect(opened).toEqual([]);
    expect(resolved[0].session.url).toBe('example.com/a');
    expect(resolved[0].session.private).toBeNull();
  });

  it('keeps internal merge matching against the real URL even though the emitted session is stripped', () => {
    // A regression this specifically guards against: if merge-window
    // matching compared against the already-stripped external session
    // instead of internal engine state, every private session would
    // spuriously match every other one (they'd all have url === '').
    const { engine } = makeEngine({ minSessionFloorMs: 0, mergeWindowMs: 30_000 });
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    engine.processEvent(urlResolved(0, 'secret.example.com/a', { private: true }));
    engine.processEvent(heartbeat(1_000));
    engine.processEvent(focusChanged(1_500, null)); // closes, becomes a merge candidate

    engine.processEvent(focusChanged(2_000, CHROME));
    // A different private URL within the merge window must NOT merge with
    // the closed candidate — internal matching must compare the real
    // (unstripped) URLs, not the stripped '' both would otherwise share.
    const reopened = engine.processEvent(urlResolved(2_000, 'secret.example.com/different-page', { private: true }));

    expect(kinds(reopened)).toEqual(['opened']);
  });
});

describe('SessionEngine — nullPrivacyPolicy for private === null (Step 23)', () => {
  it('defaults to capture-with-flag: a null-private reading opens a session normally', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0 });
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    const resolved = engine.processEvent(urlResolved(0, 'example.com/a', { private: null }));

    expect(kinds(resolved)).toEqual(['opened']);
    expect(resolved[0].session.url).toBe('example.com/a');
    expect(resolved[0].session.private).toBeNull();
  });

  it('suppress: a null-private reading never opens a session at all', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0, nullPrivacyPolicy: 'suppress' });
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    const resolved = engine.processEvent(urlResolved(0, 'example.com/a', { private: null }));

    expect(resolved).toEqual([]);
  });

  it('suppress: does not affect readings where private is true or false', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0, nullPrivacyPolicy: 'suppress' });
    engine.processEvent(timerStateChanged(0, true));
    engine.processEvent(focusChanged(0, CHROME));
    const resolved = engine.processEvent(urlResolved(0, 'example.com/a', { private: false }));

    expect(kinds(resolved)).toEqual(['opened']);
  });

  it('suppress: an already-open session keeps accumulating time but ignores the suppressed reading itself', () => {
    const { engine } = makeEngine({ minSessionFloorMs: 0, nullPrivacyPolicy: 'suppress' });
    openBaseline(engine, 'example.com/a'); // private: false by default — opens normally
    // accumulate() runs unconditionally for every event (even a suppressed
    // one) — this proves the suppression rejects the READING (url/title
    // never update to 'example.com/b'), not that time stops accruing.
    const duringNullReading = engine.processEvent(urlResolved(1_000, 'example.com/b', { private: null }));
    expect(kinds(duringNullReading)).toEqual(['extended']);
    expect(duringNullReading[0].session.url).toBe('example.com/a');

    const closed = engine.processEvent(focusChanged(1_500, null));
    expect(kinds(closed)).toEqual(['extended', 'closed']);
    expect(closed[closed.length - 1].session.url).toBe('example.com/a'); // never updated by the suppressed reading
  });
});

describe('segment checkpoints — long reads become visible before they end', () => {
  it('publishes a syncable snapshot once enough ACTIVE time accrues, without closing the session', () => {
    const { engine, ids } = makeEngine({ segmentFlushMs: 10_000, minSessionFloorMs: 0 });
    openBaseline(engine);

    // Not yet due.
    expect(kinds(engine.processEvent(heartbeat(5_000)))).not.toContain('checkpoint');

    const due = engine.processEvent(heartbeat(10_000));
    expect(kinds(due)).toContain('checkpoint');

    const checkpoint = due.find((o) => o.kind === 'checkpoint');
    // A non-null endedAt is what makes it eligible for upload at all —
    // getPendingSync only ever selects ended sessions.
    expect(checkpoint?.session.endedAt).not.toBeNull();
    expect(checkpoint?.session.id).toBe(ids[0]);

    // Crucially the session is still open: more time keeps accruing on the
    // SAME id rather than starting a new one.
    const later = engine.processEvent(heartbeat(15_000));
    expect(kinds(later)).toContain('extended');
    expect(later[0].session.id).toBe(ids[0]);
    expect(ids).toHaveLength(1);
  });

  it('loses no accounted time across a checkpoint', () => {
    const { engine } = makeEngine({ segmentFlushMs: 10_000, minSessionFloorMs: 0 });
    openBaseline(engine);

    engine.processEvent(heartbeat(10_000)); // checkpoints here
    const after = engine.processEvent(heartbeat(20_000));

    // 20s of wall time elapsed under holding conditions, so 20s must be
    // accounted — a close-and-reopen implementation would have dropped the
    // gap between the flush and the next reading.
    expect(after[0].session.activeMs).toBe(20_000);
  });

  it('re-checkpoints on each further segment, carrying a larger activeMs each time', () => {
    const { engine } = makeEngine({ segmentFlushMs: 10_000, minSessionFloorMs: 0 });
    openBaseline(engine);

    const first = engine.processEvent(heartbeat(10_000)).find((o) => o.kind === 'checkpoint');
    const second = engine.processEvent(heartbeat(20_000)).find((o) => o.kind === 'checkpoint');

    expect(first?.session.activeMs).toBe(10_000);
    expect(second?.session.activeMs).toBe(20_000);
    // Same id both times — the server upserts, last write wins.
    expect(second?.session.id).toBe(first?.session.id);
  });

  it('never checkpoints a session that is not accumulating', () => {
    const { engine } = makeEngine({ segmentFlushMs: 10_000, minSessionFloorMs: 0 });
    openBaseline(engine);
    // Timer off: no active time accrues, so there is nothing new to publish
    // however long the wall clock runs.
    engine.processEvent(timerStateChanged(1_000, false));

    const outputs = engine.processEvent(heartbeat(600_000));
    expect(kinds(outputs)).not.toContain('checkpoint');
  });

  it('can be disabled with segmentFlushMs: 0', () => {
    const { engine } = makeEngine({ segmentFlushMs: 0, minSessionFloorMs: 0 });
    openBaseline(engine);
    expect(kinds(engine.processEvent(heartbeat(600_000)))).not.toContain('checkpoint');
  });
});
