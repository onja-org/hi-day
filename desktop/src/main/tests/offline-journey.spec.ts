import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry, TrackingResult } from '../api-client';
import { OfflineCache, localDay } from '../offline-cache';
import { PendingTimerOps } from '../pending-timer-ops';
import type { PendingTimerClient } from '../pending-timer-ops';

/**
 * The whole offline round trip over the real modules wired together.
 * Every piece has its own unit tests; what those cannot catch is the
 * seams — the queue, the cache, the day stamping and the replay all
 * agreeing about one stretch of work.
 */
describe('tracking offline and syncing back', () => {
  const unreachable = { ok: false as const, message: 'unreachable' };

  /** A server that can be switched off, and remembers what it accepted. */
  class FakeServer implements PendingTimerClient {
    reachable = true;
    entries: {
      id: string;
      projectId: string | null;
      startedAt: string;
      endedAt: string | null;
      startOpId?: string;
      stopOpId?: string;
      /** Ended by one of the server's own guesses, not by anybody. */
      closedAsAbandoned?: boolean;
    }[] = [];
    private seq = 0;

    private entryFor(row: FakeServer['entries'][number]): TimeEntry {
      return {
        id: row.id,
        projectId: row.projectId,
        taskId: null,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        pausedAt: null,
        pausedSeconds: 0,
      };
    }

    startTimer(
      _token: string,
      projectId: string | null,
      _taskId: string | null,
      startedAt?: string,
      opId?: string,
    ): Promise<TrackingResult<TimeEntry>> {
      if (!this.reachable) return Promise.resolve(unreachable);
      // The real server recognises a replayed operation by its id and
      // returns what it already wrote, rather than writing it twice.
      const replay = opId && this.entries.find((e) => e.startOpId === opId);
      if (replay) return Promise.resolve({ ok: true, data: this.entryFor(replay) });
      if (this.entries.some((e) => e.endedAt === null)) {
        return Promise.resolve({
          ok: false,
          message: 'A timer is already running on this device.',
          status: 409,
        });
      }
      const row = {
        id: `entry-${++this.seq}`,
        projectId,
        startedAt: startedAt ?? new Date().toISOString(),
        endedAt: null,
        startOpId: opId,
      };
      this.entries.push(row);
      return Promise.resolve({ ok: true, data: this.entryFor(row) });
    }

    stopTimer(
      _token: string,
      endedAt?: string,
      opId?: string,
      entryId?: string,
    ): Promise<TrackingResult<TimeEntry>> {
      if (!this.reachable) return Promise.resolve(unreachable);
      const replay = opId && this.entries.find((e) => e.stopOpId === opId);
      if (replay) return Promise.resolve({ ok: true, data: this.entryFor(replay) });

      const named = entryId
        ? this.entries.find((e) => e.id === entryId)
        : undefined;
      // Somebody really ended it; this stop has happened.
      if (named?.endedAt && !named.closedAsAbandoned) {
        return Promise.resolve({ ok: true, data: this.entryFor(named) });
      }
      const target = named ?? this.entries.find((e) => e.endedAt === null);
      if (!target) {
        return Promise.resolve({
          ok: false,
          message: 'No timer is currently running on this device.',
          status: 404,
        });
      }

      const at = endedAt ?? new Date().toISOString();
      if (Date.parse(at) <= Date.parse(target.startedAt)) {
        return Promise.resolve({
          ok: false,
          message: 'End time must be after the start time.',
          status: 409,
        });
      }
      this.dropInventedAfter(target, at);
      target.endedAt = at;
      target.closedAsAbandoned = false;
      target.stopOpId = opId;
      return Promise.resolve({ ok: true, data: this.entryFor(target) });
    }

    /** The hourly job carrying a timer nobody closed into the next day. */
    splitAtMidnight(boundary: string): void {
      const open = this.entries.find((e) => e.endedAt === null);
      if (!open || Date.parse(open.startedAt) >= Date.parse(boundary)) return;
      open.endedAt = boundary;
      open.closedAsAbandoned = true;
      this.entries.push({
        id: `entry-${++this.seq}`,
        projectId: open.projectId,
        startedAt: boundary,
        endedAt: null,
      });
    }

    /** What those splits left describing nothing once the real stop lands. */
    private dropInventedAfter(
      target: FakeServer['entries'][number],
      at: string,
    ): void {
      if (!target.endedAt || Date.parse(at) >= Date.parse(target.endedAt)) return;
      let boundary: string | null = target.endedAt;
      while (boundary) {
        const index = this.entries.findIndex(
          (e) =>
            e.startedAt === boundary &&
            (e.endedAt === null || e.closedAsAbandoned),
        );
        if (index < 0) return;
        boundary = this.entries.splice(index, 1)[0].endedAt;
      }
    }

    pauseTimer(token: string): Promise<TrackingResult<TimeEntry>> {
      return this.stopTimer(token);
    }

    switchTimer(
      token: string,
      projectId: string | null,
      taskId: string | null,
    ): Promise<TrackingResult<TimeEntry>> {
      return this.stopTimer(token).then(() =>
        this.startTimer(token, projectId, taskId),
      );
    }

    /** Seconds the server would report for a day, from what it holds. */
    secondsOn(day: string): number {
      return this.entries
        .filter((e) => e.endedAt && localDay(new Date(e.startedAt)) === day)
        .reduce(
          (total, e) =>
            total +
            Math.round(
              (Date.parse(e.endedAt!) - Date.parse(e.startedAt)) / 1000,
            ),
          0,
        );
    }
  }

  let dir: string;
  let server: FakeServer;

  /**
   * The whole system clock, not one module's: `PendingTimerOps` stamps
   * from `new Date()` directly, so a clock injected into the cache alone
   * would leave the two halves of a journey disagreeing.
   */
  const at = (iso: string): void => {
    vi.setSystemTime(new Date(iso));
  };

  /** A fresh process, sharing only what is on disk. */
  function relaunch(): { cache: OfflineCache; ops: PendingTimerOps } {
    const cache = new OfflineCache(dir);
    const ops = new PendingTimerOps(dir, {
      read: () => cache.read().runningEntry,
      write: (entry) => cache.rememberRunning(entry),
    });
    const running = cache.read().runningEntry;
    if (running) ops.remember(running);
    return { cache, ops };
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'offline-journey-'));
    server = new FakeServer();
    vi.useFakeTimers();
    at('2026-10-21T09:00:00.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Derived, not hardcoded: the rule under test is "the day the person
   * was living in", which is exactly what varies by timezone.
   */
  const dayOf = (iso: string): string => localDay(new Date(iso));

  describe('a morning with no connection', () => {
    it('starts, stops and lands on the server at the times they were pressed', async () => {
      server.reachable = false;
      const { ops } = relaunch();

      at('2026-10-21T09:00:00.000Z');
      await ops.start('t', 'project-1', null, server);
      at('2026-10-21T11:30:00.000Z');
      await ops.pause('t', server);

      // The connection comes back at lunchtime.
      at('2026-10-21T12:00:00.000Z');
      server.reachable = true;
      const { settled, refused } = await ops.flush('t', server);

      expect(settled).toBe(true);
      expect(refused).toEqual([]);
      expect(server.entries).toHaveLength(1);
      expect(server.entries[0]).toMatchObject({
        projectId: 'project-1',
        startedAt: '2026-10-21T09:00:00.000Z',
        endedAt: '2026-10-21T11:30:00.000Z',
      });
      // Not the time it reconnected: two and a half hours, not three.
      expect(server.secondsOn(dayOf('2026-10-21T09:00:00.000Z'))).toBe(
        2.5 * 3600,
      );
    });

    it('can still be stopped after the app has been restarted', async () => {
      server.reachable = false;
      at('2026-10-21T09:00:00.000Z');
      await relaunch().ops.start('t', 'project-1', null, server);

      // The app is quit and opened again, still with no connection.
      at('2026-10-21T10:00:00.000Z');
      const after = relaunch();
      const stopped = await after.ops.pause('t', server);

      // Before the running entry was written down, this answered "no
      // timer is currently running" to somebody watching a ticking clock.
      expect(stopped.ok).toBe(true);
      at('2026-10-21T10:30:00.000Z');
      server.reachable = true;
      await after.ops.flush('t', server);
      expect(server.secondsOn(dayOf('2026-10-21T09:00:00.000Z'))).toBe(3600);
    });

    it('keeps the hours when the process dies before it can reconnect', async () => {
      server.reachable = false;
      at('2026-10-21T09:00:00.000Z');
      const first = relaunch();
      await first.ops.start('t', 'project-1', null, server);
      at('2026-10-21T10:00:00.000Z');
      await first.ops.pause('t', server);

      // Killed. Nothing survives but the files.
      at('2026-10-21T14:00:00.000Z');
      server.reachable = true;
      await relaunch().ops.flush('t', server);

      expect(server.secondsOn(dayOf('2026-10-21T09:00:00.000Z'))).toBe(3600);
    });
  });

  /**
   * Stopped at 21:41 offline, started again at 03:46, both reaching the
   * server at 04:30 — by which time it had carried the evening's entry
   * across midnight itself, so every replay met a row it was never about.
   */
  describe('a night the server guessed its way through', () => {
    it('lands the evening where it was stopped and the morning where it was started', async () => {
      at('2026-11-09T18:05:00.000Z');
      const { ops } = relaunch();
      await ops.start('t', 'project-1', null, server);

      // The connection goes before the stop can be sent.
      at('2026-11-09T21:41:00.000Z');
      server.reachable = false;
      await ops.pause('t', server);

      // Nothing told the server, so it carried the entry into the new day.
      server.splitAtMidnight('2026-11-10T00:00:00.000Z');

      at('2026-11-10T03:46:00.000Z');
      const morning = relaunch();
      await morning.ops.start('t', 'project-1', null, server);

      at('2026-11-10T04:30:00.000Z');
      server.reachable = true;
      const { settled, refused } = await morning.ops.flush('t', server);

      expect(refused).toEqual([]);
      expect(settled).toBe(true);

      const evening = server.entries.find(
        (e) => e.startedAt === '2026-11-09T18:05:00.000Z',
      );
      expect(evening?.endedAt).toBe('2026-11-09T21:41:00.000Z');
      // The span the split invented described nothing once the real stop
      // landed — and left open, the morning's start met a 409.
      expect(
        server.entries.some((e) => e.startedAt === '2026-11-10T00:00:00.000Z'),
      ).toBe(false);

      const running = server.entries.find((e) => e.endedAt === null);
      expect(running?.startedAt).toBe('2026-11-10T03:46:00.000Z');
      // Three hours thirty-six, not the nineteen hours fifty-five somebody
      // woke up to.
      expect(server.secondsOn(dayOf('2026-11-09T18:05:00.000Z'))).toBe(
        3 * 3600 + 36 * 60,
      );
    });

    it('reports nothing as refused, so no hours are announced as lost', async () => {
      at('2026-11-09T18:05:00.000Z');
      const { ops } = relaunch();
      await ops.start('t', 'project-1', null, server);
      at('2026-11-09T21:41:00.000Z');
      server.reachable = false;
      await ops.pause('t', server);
      server.splitAtMidnight('2026-11-10T00:00:00.000Z');

      at('2026-11-10T04:30:00.000Z');
      server.reachable = true;
      const { refused } = await relaunch().ops.flush('t', server);

      expect(refused).toEqual([]);
    });
  });

  describe('replaying without writing the hours twice', () => {
    it('survives a response lost on the way back', async () => {
      server.reachable = false;
      at('2026-10-21T09:00:00.000Z');
      const { ops } = relaunch();
      await ops.start('t', 'project-1', null, server);
      at('2026-10-21T10:00:00.000Z');
      await ops.pause('t', server);

      server.reachable = true;
      // The first replay reaches the server; the answer never comes back,
      // so the agent tries the whole thing again.
      await ops.flush('t', server);
      await ops.flush('t', server);
      await relaunch().ops.flush('t', server);

      expect(server.entries).toHaveLength(1);
      expect(server.secondsOn(dayOf('2026-10-21T09:00:00.000Z'))).toBe(3600);
    });
  });

  describe('each day on its own', () => {
    it('lands unsynced time from a past day on that day, not today', async () => {
      server.reachable = false;
      at('2026-10-20T09:00:00.000Z');
      const { ops } = relaunch();
      await ops.start('t', 'project-1', null, server);
      at('2026-10-20T17:00:00.000Z');
      await ops.pause('t', server);

      // Nobody opened the laptop again until the next morning.
      at('2026-10-21T08:00:00.000Z');
      server.reachable = true;
      await relaunch().ops.flush('t', server);

      expect(server.secondsOn(dayOf('2026-10-20T09:00:00.000Z'))).toBe(
        8 * 3600,
      );
      expect(server.secondsOn(dayOf('2026-10-21T08:00:00.000Z'))).toBe(0);
    });

    it('starts the new day from zero on the device too', () => {
      const { cache } = relaunch();
      cache.rememberToday({
        workedSeconds: 8 * 3600,
        deviceSeconds: 8 * 3600,
        projects: [{ projectId: 'project-1', seconds: 8 * 3600 }],
      });

      at('2026-10-22T08:00:00.000Z');

      // Yesterday's hours shown on a new morning would be worse than
      // showing nothing at all.
      expect(cache.todayTotals()).toBeNull();
    });

    it('keeps the day it already had across a restart', () => {
      const { cache } = relaunch();
      cache.rememberToday({
        workedSeconds: 3600,
        deviceSeconds: 3600,
        projects: [],
      });

      at('2026-10-21T16:00:00.000Z');

      expect(relaunch().cache.todayTotals()?.workedSeconds).toBe(3600);
    });

    it('remembers work finished offline, so a power-off does not erase the day', async () => {
      server.reachable = false;
      const { cache, ops } = relaunch();
      cache.rememberToday({
        workedSeconds: 3600,
        deviceSeconds: 3600,
        projects: [{ projectId: 'project-1', seconds: 3600 }],
      });

      at('2026-10-21T13:00:00.000Z');
      await ops.start('t', 'project-1', null, server);
      at('2026-10-21T14:00:00.000Z');
      const stopped = await ops.pause('t', server);
      // What main does with a stretch that ended with no connection.
      const seconds = Math.round(
        (Date.parse(stopped.ok ? stopped.data.endedAt! : '') -
          Date.parse(stopped.ok ? stopped.data.startedAt : '')) /
          1000,
      );
      cache.addWorkedSeconds('project-1', seconds);

      // The machine is switched off and turned on again.
      expect(relaunch().cache.todayTotals()?.workedSeconds).toBe(2 * 3600);
    });
  });

  describe('what is still waiting to go up', () => {
    it('counts the queued operations while there is no connection', async () => {
      server.reachable = false;
      at('2026-10-21T09:00:00.000Z');
      const { ops } = relaunch();

      await ops.start('t', 'project-1', null, server);
      at('2026-10-21T10:00:00.000Z');
      await ops.pause('t', server);

      // What the quit dialog and the backlog warning both count.
      expect(ops.load()).toHaveLength(2);
    });

    it('is empty again once everything has landed', async () => {
      server.reachable = false;
      const { ops } = relaunch();
      await ops.start('t', 'project-1', null, server);
      at('2026-10-21T10:00:00.000Z');
      await ops.pause('t', server);

      server.reachable = true;
      await ops.flush('t', server);

      expect(ops.load()).toEqual([]);
    });

    it('reports hours the server refuses rather than dropping them', async () => {
      server.reachable = false;
      const { ops } = relaunch();
      await ops.start('t', 'archived-project', null, server);
      at('2026-10-21T10:00:00.000Z');
      await ops.pause('t', server);

      server.reachable = true;
      // The project was archived while the laptop was away.
      server.startTimer = () =>
        Promise.resolve({
          ok: false,
          message: 'That project is archived.',
          status: 409,
        });
      const { refused } = await ops.flush('t', server);

      expect(refused).toHaveLength(1);
      expect(refused[0].message).toBe('That project is archived.');
    });
  });

  describe('switching projects with no connection', () => {
    it('lands both stretches, back to back, on the right projects', async () => {
      server.reachable = false;
      at('2026-10-21T09:00:00.000Z');
      const { ops } = relaunch();
      await ops.start('t', 'project-1', null, server);
      at('2026-10-21T10:00:00.000Z');
      await ops.switchTo('t', 'project-2', null, server);
      at('2026-10-21T11:00:00.000Z');
      await ops.pause('t', server);

      server.reachable = true;
      await ops.flush('t', server);

      expect(server.entries).toHaveLength(2);
      expect(server.entries[0]).toMatchObject({
        projectId: 'project-1',
        startedAt: '2026-10-21T09:00:00.000Z',
        endedAt: '2026-10-21T10:00:00.000Z',
      });
      expect(server.entries[1]).toMatchObject({
        projectId: 'project-2',
        startedAt: '2026-10-21T10:00:00.000Z',
        endedAt: '2026-10-21T11:00:00.000Z',
      });
      // No gap and no overlap at the seam: the switch is one instant.
      expect(server.entries[0].endedAt).toBe(server.entries[1].startedAt);
      expect(server.secondsOn(dayOf('2026-10-21T09:00:00.000Z'))).toBe(
        2 * 3600,
      );
    });
  });
});
