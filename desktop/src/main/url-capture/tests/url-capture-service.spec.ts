import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MinimalPowerMonitor, PowerMonitorEventName } from '../power-adapter';
import { UrlCaptureService } from '../url-capture-service';
import { UrlSessionStore } from '../store';

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
}

let dir: string;
let powerMonitor: FakePowerMonitor;
let service: UrlCaptureService;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'url-capture-service-'));
  powerMonitor = new FakePowerMonitor();
  service = new UrlCaptureService({
    deviceId: 'device-1',
    userDataDir: dir,
    powerMonitor,
    // Effectively disable the real idle-poll interval for these tests —
    // idle behaviour is PowerAdapter's own responsibility and already
    // covered by power-adapter.spec.ts.
    idlePollIntervalMs: 3_600_000,
  });
});

afterEach(() => {
  service.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe('UrlCaptureService', () => {
  it('creates a working SQLite store under the given userData directory', () => {
    service.start();
    const store = new UrlSessionStore(join(dir, 'url-sessions.sqlite'));
    expect(store.getPendingSync(10)).toEqual([]);
    store.close();
  });

  it('starting the timer alone opens nothing — sessions only open on a real urlResolved', () => {
    service.start();
    service.setTimerRunning(true);
    const store = new UrlSessionStore(join(dir, 'url-sessions.sqlite'));
    expect(store.getPendingSync(10)).toEqual([]);
    store.close();
  });

  it('a full timer + focus + resolve + close cycle persists a row to the real store', () => {
    service.start();
    service.setTimerRunning(true);
    service.reportEvent({
      type: 'focusChanged',
      monotonicMs: 0,
      wallClockMs: Date.now(),
      tzOffsetMin: 0,
      target: { browser: 'chrome', pid: 1, hwnd: 1 },
    });
    service.reportEvent({
      type: 'urlResolved',
      monotonicMs: 0,
      wallClockMs: Date.now(),
      tzOffsetMin: 0,
      pid: 1,
      hwnd: 1,
      url: 'example.com/a',
      host: 'example.com',
      path: '/a',
      title: 'A',
      browser: 'chrome',
      private: false,
      source: 'uia',
      confidence: 'displayed',
    });
    // Force-close by stopping the timer, well past the default 2s floor.
    service.reportEvent({
      type: 'timerStateChanged',
      running: false,
      monotonicMs: 5_000,
      wallClockMs: Date.now() + 5_000,
      tzOffsetMin: 0,
    });

    const store = new UrlSessionStore(join(dir, 'url-sessions.sqlite'));
    const pending = store.getPendingSync(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ url: 'example.com/a', activeMs: 5_000, deviceId: 'device-1' });
    store.close();
  });

  it('runSync uploads pending sessions through the injected upload fn and marks them synced', async () => {
    const syncDir = mkdtempSync(join(tmpdir(), 'url-capture-service-sync-'));
    const acked: string[] = [];
    const upload = vi.fn((batch: { id: string }[]) => {
      const ids = batch.map((session) => session.id);
      acked.push(...ids);
      return Promise.resolve({ acked: ids });
    });
    const syncingService = new UrlCaptureService({
      deviceId: 'device-1',
      userDataDir: syncDir,
      powerMonitor,
      idlePollIntervalMs: 3_600_000,
      upload,
    });
    syncingService.start();
    syncingService.setTimerRunning(true);
    syncingService.reportEvent({
      type: 'focusChanged',
      monotonicMs: 0,
      wallClockMs: Date.now(),
      tzOffsetMin: 0,
      target: { browser: 'chrome', pid: 1, hwnd: 1 },
    });
    syncingService.reportEvent({
      type: 'urlResolved',
      monotonicMs: 0,
      wallClockMs: Date.now(),
      tzOffsetMin: 0,
      pid: 1,
      hwnd: 1,
      url: 'example.com/a',
      host: 'example.com',
      path: '/a',
      title: 'A',
      browser: 'chrome',
      private: false,
      source: 'uia',
      confidence: 'displayed',
    });
    syncingService.reportEvent({
      type: 'timerStateChanged',
      running: false,
      monotonicMs: 5_000,
      wallClockMs: Date.now() + 5_000,
      tzOffsetMin: 0,
    });

    const result = await syncingService.runSync();

    expect(result).toEqual({ uploaded: 1, acked: 1 });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(acked).toHaveLength(1);

    const store = new UrlSessionStore(join(syncDir, 'url-sessions.sqlite'));
    expect(store.getPendingSync(10)).toEqual([]);
    store.close();
    syncingService.stop();
    rmSync(syncDir, { recursive: true, force: true });
  });

  it('translates powerMonitor lock/unlock into the engine without throwing', () => {
    service.start();
    expect(() => {
      powerMonitor.fire('lock-screen');
      powerMonitor.fire('unlock-screen');
      powerMonitor.fire('suspend');
      powerMonitor.fire('resume');
    }).not.toThrow();
  });
});
