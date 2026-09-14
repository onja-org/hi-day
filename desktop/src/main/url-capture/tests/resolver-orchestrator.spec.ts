import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DebugRecord } from '../debug-harness';
import { ResolverOrchestrator } from '../resolver-orchestrator';
import type { EngineEvent } from '../session-types';

const mockResolverPath = join(__dirname, 'mock-resolver.mjs');
const fixturesDir = join(__dirname, 'fixtures');

let orchestrator: ResolverOrchestrator | null = null;

afterEach(() => {
  orchestrator?.stop();
  orchestrator = null;
});

function waitFor<T>(check: () => T | undefined, timeoutMs = 2000): Promise<T> {
  return new Promise((resolvePromise, rejectPromise) => {
    const start = Date.now();
    const poll = (): void => {
      const value = check();
      if (value !== undefined) {
        resolvePromise(value);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        rejectPromise(new Error('waitFor timed out'));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

describe('ResolverOrchestrator', () => {
  it('turns a focus event into focusChanged, then a valid resolve into urlResolved', async () => {
    const events: EngineEvent[] = [];
    orchestrator = new ResolverOrchestrator({
      spawnConfig: {
        command: process.execPath,
        args: [mockResolverPath, join(fixturesDir, 'orchestrator-happy-path.json')],
      },
      reportEvent: (event) => events.push(event),
      heartbeatIntervalMs: 10_000, // only the immediate post-focus resolve matters for this test
      logger: () => undefined,
    });
    orchestrator.start();

    const focusChanged = await waitFor(() => events.find((e) => e.type === 'focusChanged'));
    expect(focusChanged.type === 'focusChanged' && focusChanged.target).toEqual({
      browser: 'chrome.exe',
      pid: 111,
      hwnd: 222,
    });

    const urlResolved = await waitFor(() => events.find((e) => e.type === 'urlResolved'));
    if (urlResolved.type !== 'urlResolved') throw new Error('unreachable');
    expect(urlResolved.url).toBe('https://example.com/a');
    expect(urlResolved.host).toBe('example.com');
    expect(urlResolved.pid).toBe(111);
    expect(urlResolved.hwnd).toBe(222);
    expect(urlResolved.browser).toBe('chrome.exe');
  });

  it('drops a reading that fails normalization — no urlResolved event at all', async () => {
    const events: EngineEvent[] = [];
    orchestrator = new ResolverOrchestrator({
      spawnConfig: {
        command: process.execPath,
        args: [mockResolverPath, join(fixturesDir, 'orchestrator-happy-path.json')],
      },
      reportEvent: (event) => events.push(event),
      heartbeatIntervalMs: 30, // fast enough to reach the fixture's 2nd (garbage) resolve rule
      logger: () => undefined,
    });
    orchestrator.start();

    // Wait for the first (valid) urlResolved, then the heartbeat's next
    // tick consumes the fixture's 2nd rule — a raw search-query string —
    // which normalizeAddressBarReading must reject.
    await waitFor(() => events.find((e) => e.type === 'urlResolved'));
    await new Promise((r) => setTimeout(r, 100));

    const urlResolvedEvents = events.filter((e) => e.type === 'urlResolved');
    expect(urlResolvedEvents).toHaveLength(1); // only the valid one — the garbage reading never became an event
  });

  it('records every reading to the debug sink, accepted and rejected alike, when one is provided', async () => {
    const events: EngineEvent[] = [];
    const debugRecords: DebugRecord[] = [];
    orchestrator = new ResolverOrchestrator({
      spawnConfig: {
        command: process.execPath,
        args: [mockResolverPath, join(fixturesDir, 'orchestrator-happy-path.json')],
      },
      reportEvent: (event) => events.push(event),
      heartbeatIntervalMs: 30,
      logger: () => undefined,
      debugSink: { record: (entry) => debugRecords.push(entry) },
    });
    orchestrator.start();

    await waitFor(() => events.find((e) => e.type === 'urlResolved'));
    await waitFor(() => (debugRecords.length >= 2 ? debugRecords : undefined));

    const accepted = debugRecords.find((r) => r.decision === 'accepted');
    const rejected = debugRecords.find((r) => r.decision?.startsWith('rejected:'));
    expect(accepted).toBeDefined();
    expect(accepted?.normalized).toBe('https://example.com/a');
    expect(rejected).toBeDefined();
    expect(rejected?.normalized).toBeUndefined();
    expect(rejected?.raw).toBe('how do I center a div');
  });
});
