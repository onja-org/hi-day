import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ResolverManager,
  type ResolverManagerEvents,
  type ResolverManagerOptions,
  type ResolverSpawnConfig,
} from '../resolver-manager';

const mockResolverPath = join(__dirname, 'mock-resolver.mjs');
const fixturesDir = join(__dirname, 'fixtures');

function spawnConfigFor(fixtureName: string): ResolverSpawnConfig {
  return { command: process.execPath, args: [mockResolverPath, join(fixturesDir, fixtureName)] };
}

// A silent logger by default — tests that care about logged lines pass their
// own. Without this, every deliberately-triggered failure path in these
// tests would spam stderr via the real default logger.
const silentOptions: ResolverManagerOptions = { logger: () => undefined };

/** Effectively disables the watchdog for tests that aren't exercising it. */
const NO_WATCHDOG_INTERFERENCE = { pingIntervalMs: 10_000 };

// Matches the "respond" rule shared by malformed-json.json, partial-line.json,
// and oversized-line.json's fixtures — kept exact (toEqual, not toMatchObject)
// so a leaked internal field (like the `id` bug this caught once already)
// can't silently slip back in.
const EXAMPLE_COM_RESPONSE = {
  ok: true,
  url: 'example.com',
  title: 't',
  browser: 'chrome',
  private: false,
  source: 'uia',
  confidence: 'displayed',
  ms: 3,
};

function waitForEvent<K extends keyof ResolverManagerEvents>(
  manager: ResolverManager,
  event: K,
): Promise<ResolverManagerEvents[K]> {
  return new Promise((resolvePromise) => {
    const handler = (payload: ResolverManagerEvents[K]): void => {
      manager.off(event, handler);
      resolvePromise(payload);
    };
    manager.on(event, handler);
  });
}

let manager: ResolverManager | null = null;

afterEach(() => {
  manager?.stop();
  manager = null;
});

describe('ResolverManager', () => {
  it('drives a full resolve round trip against a scripted mock resolver', async () => {
    manager = new ResolverManager(spawnConfigFor('happy-path.json'), {
      ...silentOptions,
      ...NO_WATCHDOG_INTERFERENCE,
    });
    const readyPromise = waitForEvent(manager, 'ready');
    manager.start();

    const ready = await readyPromise;
    expect(ready.platform).toBe('mock');

    const first = await manager.resolve(111, 222);
    // toEqual, not toMatchObject: the internal request `id` must NOT leak into
    // the public outcome — a partial matcher here previously hid that bug.
    expect(first).toEqual({
      ok: true,
      url: 'github.com/onja/agent/issues/42',
      title: 'Issue #42',
      browser: 'chrome',
      private: false,
      source: 'uia',
      confidence: 'displayed',
      ms: 5,
    });

    const second = await manager.resolve(111, 222);
    expect(second).toEqual({
      ok: true,
      url: 'example.com',
      title: 'Example',
      browser: 'chrome',
      private: false,
      source: 'uia',
      confidence: 'displayed',
      ms: 4,
    });
  });

  it('fails a request that never gets a response within the timeout', async () => {
    manager = new ResolverManager(spawnConfigFor('timeout.json'), {
      ...silentOptions,
      ...NO_WATCHDOG_INTERFERENCE,
      requestTimeoutMs: 100,
    });
    manager.start();

    const outcome = await manager.resolve(1, 1);
    expect(outcome).toEqual({ ok: false, message: 'Timed out waiting for a response to "resolve".' });
  });

  it('drops a malformed JSON line and keeps handling subsequent requests', async () => {
    manager = new ResolverManager(spawnConfigFor('malformed-json.json'), {
      ...silentOptions,
      ...NO_WATCHDOG_INTERFERENCE,
      // The first call must genuinely time out, then the second must
      // complete a real child-process round trip within its own window —
      // 100ms was too tight for a loaded/slow CI runner (spawn overhead
      // alone can exceed that) and flaked in CI while always passing
      // locally. 2000ms is generous enough that only an actual hang
      // (which is what this test would be exposing) trips it.
      requestTimeoutMs: 2000,
    });
    manager.start();

    const first = await manager.resolve(1, 1);
    expect(first.ok).toBe(false);

    const second = await manager.resolve(1, 1);
    expect(second).toEqual(EXAMPLE_COM_RESPONSE);
  });

  it('reassembles a response split across chunks separated in time', async () => {
    manager = new ResolverManager(spawnConfigFor('partial-line.json'), {
      ...silentOptions,
      ...NO_WATCHDOG_INTERFERENCE,
      requestTimeoutMs: 1000,
    });
    manager.start();

    const outcome = await manager.resolve(1, 1);
    expect(outcome).toEqual(EXAMPLE_COM_RESPONSE);
  });

  it('discards an oversized unterminated line without deadlocking, and recovers', async () => {
    manager = new ResolverManager(spawnConfigFor('oversized-line.json'), {
      ...silentOptions,
      ...NO_WATCHDOG_INTERFERENCE,
      // Same shape (and same CI-flakiness risk) as the malformed-JSON test
      // above: first call times out, second must complete a real round
      // trip in its own window. Widened for the same reason.
      requestTimeoutMs: 2000,
      maxLineBytes: 5_000,
    });
    manager.start();

    const first = await manager.resolve(1, 1);
    expect(first.ok).toBe(false);

    const second = await manager.resolve(1, 1);
    expect(second).toEqual(EXAMPLE_COM_RESPONSE);
  });

  it('settles a pending request immediately when the child crashes mid-request, and starts a restart', async () => {
    manager = new ResolverManager(spawnConfigFor('crash-mid-request.json'), {
      ...silentOptions,
      ...NO_WATCHDOG_INTERFERENCE,
      requestTimeoutMs: 5000,
    });
    const restartingPromise = waitForEvent(manager, 'restarting');
    manager.start();

    const outcome = await manager.resolve(1, 1);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.message).not.toMatch(/timed out/i);
    }

    const restarting = await restartingPromise;
    expect(restarting.attempt).toBe(1);
  });

  it('kills and respawns after two consecutive missed pings', async () => {
    manager = new ResolverManager(spawnConfigFor('watchdog-always-hangs.json'), {
      ...silentOptions,
      pingIntervalMs: 20,
      requestTimeoutMs: 20,
      maxMissedPings: 2,
      baseBackoffMs: 20,
      maxBackoffMs: 100,
      maxRestartAttempts: 5,
    });
    const restartingPromise = waitForEvent(manager, 'restarting');
    manager.start();

    const restarting = await restartingPromise;
    expect(restarting.attempt).toBe(1);
  });

  it('applies exponential backoff across repeated restart attempts', async () => {
    manager = new ResolverManager(spawnConfigFor('watchdog-always-hangs.json'), {
      ...silentOptions,
      pingIntervalMs: 20,
      requestTimeoutMs: 20,
      maxMissedPings: 2,
      baseBackoffMs: 20,
      maxBackoffMs: 100,
      maxRestartAttempts: 5,
    });

    const delays: number[] = [];
    manager.on('restarting', (event) => delays.push(event.delayMs));
    manager.start();

    await new Promise<void>((resolvePromise) => {
      const check = (): void => {
        if (delays.length >= 3) {
          resolvePromise();
          return;
        }
        setTimeout(check, 20);
      };
      check();
    });

    expect(delays.slice(0, 3)).toEqual([20, 40, 80]);
  });

  it('stops retrying and emits degraded after maxRestartAttempts consecutive failures', async () => {
    manager = new ResolverManager(spawnConfigFor('watchdog-always-hangs.json'), {
      ...silentOptions,
      pingIntervalMs: 20,
      requestTimeoutMs: 20,
      maxMissedPings: 2,
      baseBackoffMs: 5,
      maxBackoffMs: 20,
      maxRestartAttempts: 3,
    });

    let restartingCount = 0;
    manager.on('restarting', () => {
      restartingCount += 1;
    });
    const degradedPromise = waitForEvent(manager, 'degraded');
    manager.start();

    const degraded = await degradedPromise;
    expect(restartingCount).toBe(3);
    expect(degraded.reason).toContain('3 restart attempts');

    // Give the manager a further beat to prove it really stopped trying —
    // no additional 'restarting' event should show up after 'degraded'.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    expect(restartingCount).toBe(3);
  });
});
