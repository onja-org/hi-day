import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry, TrackingResult } from '../api-client';
import { AppEventUploader } from '../app-event-uploader';
import type { AppEventUploaderClient } from '../app-event-uploader';
import { OfflineQueue } from '../offline-queue';
import { OfflineQueueStore } from '../offline-queue-store';
import { PendingTimerOps } from '../pending-timer-ops';
import type { PendingTimerClient } from '../pending-timer-ops';
import { sessionOwner } from '../session-owner';
import { UrlSessionStore } from '../url-capture/store';
import type { UrlSession } from '../url-capture/session-types';

/**
 * One machine, two people. The backend reuses the same Device for whoever
 * logs in on it, so the only thing that can keep A's captures out of B's
 * timesheet is the desktop refusing to send them under B's token
 * (pre-launch audit, 2026-11-02).
 */
describe('a machine shared by two people', () => {
  const personA = {
    userId: 'user-a',
    organisationId: 'org-a',
    email: 'a@example.com',
    organisationName: 'A Ltd',
    deviceToken: 'token-a',
  };
  const personB = {
    userId: 'user-b',
    organisationId: 'org-b',
    email: 'b@example.com',
    organisationName: 'B Ltd',
    deviceToken: 'token-b',
  };

  let loggedIn: typeof personA | null;
  const session = { load: () => loggedIn };
  const currentOwner = (): string | null => (loggedIn ? sessionOwner(loggedIn) : null);

  beforeEach(() => {
    loggedIn = null;
  });

  describe('window samples, screenshots and activity (offline queue)', () => {
    let store: OfflineQueueStore;
    let queue: OfflineQueue;
    let postAppEvents: ReturnType<typeof vi.fn>;
    let uploader: AppEventUploader;

    beforeEach(async () => {
      store = await OfflineQueueStore.create(':memory:');
      queue = new OfflineQueue(store);
      queue.setOwnerSource(currentOwner);
      postAppEvents = vi.fn().mockResolvedValue({ ok: true, data: undefined });
      uploader = new AppEventUploader(
        session,
        { postAppEvents } as unknown as AppEventUploaderClient,
        queue,
      );
      queue.registerSender(uploader);
    });

    afterEach(() => store.close());

    function captureWindow(title: string): void {
      uploader.enqueue({
        appName: 'Firefox',
        title,
        titleUnavailableReason: null,
        sampledAt: '2026-11-04T13:50:00.000Z',
      });
    }

    it("never sends A's samples with B's token", async () => {
      loggedIn = personA;
      captureWindow("A's payslip");
      loggedIn = null; // signed out, or signed out remotely, while offline
      loggedIn = personB;

      await queue.flushAll();

      expect(postAppEvents).not.toHaveBeenCalled();
    });

    it('deletes every queued capture on logout or remote sign-out', async () => {
      loggedIn = personA;
      captureWindow("A's payslip");

      expect(queue.discardAll()).toBe(1);
      await queue.flushAll();

      expect(postAppEvents).not.toHaveBeenCalled();
    });

    it("drops A's samples once B logs in", async () => {
      loggedIn = personA;
      captureWindow("A's payslip");
      loggedIn = personB;

      queue.discardOtherOwners(sessionOwner(personB));
      loggedIn = personA;
      await queue.flushAll();

      expect(postAppEvents).not.toHaveBeenCalled();
      expect(queue.pendingCount()).toBe(0);
    });

    it("still sends A's samples when A is the one who logs back in", async () => {
      loggedIn = personA;
      captureWindow("A's payslip");
      loggedIn = null;
      loggedIn = { ...personA, deviceToken: 'token-a-2' };

      await queue.flushAll();

      expect(postAppEvents).toHaveBeenCalledTimes(1);
      expect(postAppEvents.mock.calls[0][0]).toBe('token-a-2');
    });

    it('records nothing while nobody is logged in', async () => {
      captureWindow('no one here');
      loggedIn = personB;

      await queue.flushAll();

      expect(postAppEvents).not.toHaveBeenCalled();
    });

    it("only counts the current person's backlog as waiting", () => {
      loggedIn = personA;
      captureWindow("A's payslip");
      loggedIn = personB;

      expect(queue.pendingCount()).toBe(0);
    });
  });

  describe('timer actions taken offline', () => {
    let dir: string;
    let ops: PendingTimerOps;
    const unreachable = { ok: false as const, message: 'unreachable' };
    const entry: TimeEntry = {
      id: 'entry-a',
      projectId: null,
      taskId: null,
      startedAt: '2026-11-04T13:40:00.000Z',
      endedAt: null,
      pausedAt: null,
      pausedSeconds: 0,
    };

    function offlineClient(): PendingTimerClient {
      const fail = (): Promise<TrackingResult<TimeEntry>> => Promise.resolve(unreachable);
      return { pauseTimer: fail, stopTimer: fail, startTimer: fail, switchTimer: fail };
    }

    function recordingClient() {
      const ok = (): Promise<TrackingResult<TimeEntry>> =>
        Promise.resolve({ ok: true, data: { ...entry, endedAt: '2026-11-04T13:56:00.000Z' } });
      return {
        pauseTimer: vi.fn<PendingTimerClient['pauseTimer']>(ok),
        stopTimer: vi.fn<PendingTimerClient['stopTimer']>(ok),
        startTimer: vi.fn<PendingTimerClient['startTimer']>(ok),
        switchTimer: vi.fn<PendingTimerClient['switchTimer']>(ok),
      };
    }

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'cross-user-ops-'));
      ops = new PendingTimerOps(dir);
      ops.setOwnerSource(currentOwner);
    });

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("never replays A's offline start and stop on B's timesheet", async () => {
      loggedIn = personA;
      await ops.start(personA.deviceToken, null, null, offlineClient());
      await ops.stopAt(personA.deviceToken, offlineClient());
      expect(ops.hasPending()).toBe(true);

      loggedIn = personB;
      const client = recordingClient();
      const result = await ops.flush(personB.deviceToken, client);

      expect(client.startTimer).not.toHaveBeenCalled();
      expect(client.stopTimer).not.toHaveBeenCalled();
      expect(result.settled).toBe(true);
      expect(ops.hasPending()).toBe(false);
    });

    it("replays A's own offline stop under A's new token", async () => {
      loggedIn = personA;
      ops.remember(entry);
      await ops.stopAt(personA.deviceToken, offlineClient());

      loggedIn = null;
      expect(ops.hasPending()).toBe(false); // nobody here to replay it for

      // The same person in the same Organisation, with a fresh token.
      loggedIn = { ...personA, deviceToken: 'token-a-2' };
      const client = recordingClient();
      await ops.flush('token-a-2', client);

      expect(client.stopTimer).toHaveBeenCalledTimes(1);
      expect(client.stopTimer.mock.calls[0][0]).toBe('token-a-2');
    });

    it('deletes every queued action on logout or remote sign-out', async () => {
      loggedIn = personA;
      await ops.start(personA.deviceToken, null, null, offlineClient());
      await ops.stopAt(personA.deviceToken, offlineClient());

      expect(ops.discardAll()).toBe(2);

      loggedIn = personA;
      expect(ops.hasPending()).toBe(false);
    });
  });

  describe('visited URLs', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'cross-user-urls-'));
    });

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    function closedSession(id: string): UrlSession {
      return {
        id,
        url: 'https://bank.example/statements',
        host: 'bank.example',
        path: '/statements',
        title: null,
        browser: 'firefox',
        private: false,
        deviceId: 'shared-device',
        startedAt: 1_000,
        endedAt: 2_000,
        activeMs: 1_000,
        tzOffsetMin: 180,
        source: 'atspi',
        confidence: 'exact',
      };
    }

    it("never offers A's URLs up for B's sync", () => {
      const path = join(dir, 'url-sessions.sqlite');
      const asA = new UrlSessionStore(path, sessionOwner(personA));
      asA.upsert(closedSession('a-1'));
      asA.close();

      const asB = new UrlSessionStore(path, sessionOwner(personB));
      expect(asB.getPendingSync(100)).toEqual([]);
      expect(asB.countPendingSync()).toBe(0);
      asB.close();
    });

    it("drops A's URLs once B starts capturing", () => {
      const path = join(dir, 'url-sessions.sqlite');
      const asA = new UrlSessionStore(path, sessionOwner(personA));
      asA.upsert(closedSession('a-1'));
      asA.close();

      const asB = new UrlSessionStore(path, sessionOwner(personB));
      asB.discardOtherOwners();
      asB.close();

      const asAAgain = new UrlSessionStore(path, sessionOwner(personA));
      expect(asAAgain.getPendingSync(100)).toEqual([]);
      asAAgain.close();
    });

    it('can be emptied on logout without capture running', () => {
      const path = join(dir, 'url-sessions.sqlite');
      const asA = new UrlSessionStore(path, sessionOwner(personA));
      asA.upsert(closedSession('a-1'));
      asA.close();

      UrlSessionStore.discardAllAt(path);

      const asAAgain = new UrlSessionStore(path, sessionOwner(personA));
      expect(asAAgain.getPendingSync(100)).toEqual([]);
      asAAgain.close();
    });
  });
});
