import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CAPTURE_TRUST_WINDOW_MS,
  OfflineCache,
  localDay,
} from '../offline-cache';
import type { TimeEntry, TrackedProject } from '../api-client';

describe('offline cache', () => {
  let userDataDir: string;
  let clock: Date;

  const at = (iso: string): void => {
    clock = new Date(iso);
  };

  function cache(): OfflineCache {
    return new OfflineCache(userDataDir, () => clock);
  }

  const project: TrackedProject = {
    id: 'project-1',
    name: 'Apollo',
    colour: 'blue',
    client: null,
  };

  const entry: TimeEntry = {
    id: 'entry-1',
    projectId: 'project-1',
    taskId: null,
    startedAt: '2026-10-21T09:00:00.000Z',
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
  };

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-offline-cache-'));
    at('2026-10-21T10:00:00.000Z');
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('knows nothing on a fresh install', () => {
    const state = cache().read();

    expect(state.projects).toBeNull();
    expect(state.runningEntry).toBeNull();
    expect(state.lastContactAt).toBeNull();
  });

  it('survives a restart — the whole point of writing it down', () => {
    cache().remember({ projects: [project], projectsEnabled: true });

    expect(cache().read().projects).toEqual([project]);
    expect(cache().read().projectsEnabled).toBe(true);
  });

  it('reads a truncated file as an empty cache rather than throwing', () => {
    writeFileSync(join(userDataDir, 'offline-cache.json'), '{"projects":', 'utf-8');

    // Throwing here would leave the app with no window at all.
    expect(cache().read().projects).toBeNull();
  });

  it('keeps one answer while recording another', () => {
    const subject = cache();
    subject.remember({ projects: [project] });

    subject.remember({ projectsEnabled: false });

    expect(subject.read().projects).toEqual([project]);
  });

  it('holds tasks per project, so remembering one does not forget another', () => {
    const subject = cache();
    subject.rememberTasks('project-1', []);

    subject.rememberTasks('project-2', []);

    expect(Object.keys(subject.read().tasks)).toEqual(['project-1', 'project-2']);
  });

  describe('whose answers these are', () => {
    it('discards a previous device’s cache rather than showing it to the next person', () => {
      const first = cache();
      first.readFor('device-1');
      first.remember({ projects: [project] });

      const state = cache().readFor('device-2');

      expect(state.projects).toBeNull();
      expect(state.deviceId).toBe('device-2');
    });

    it('keeps its own device’s cache across a relaunch', () => {
      const first = cache();
      first.readFor('device-1');
      first.remember({ projects: [project] });

      expect(cache().readFor('device-1').projects).toEqual([project]);
    });
  });

  describe('today’s totals', () => {
    it('gives back what it was told, on the same day', () => {
      const subject = cache();
      subject.rememberToday({
        workedSeconds: 3600,
        deviceSeconds: 3600,
        projects: [{ projectId: 'project-1', seconds: 3600 }],
      });

      expect(subject.todayTotals()?.workedSeconds).toBe(3600);
    });

    it('withholds them the next day — yesterday’s hours are not this morning’s', () => {
      const subject = cache();
      subject.rememberToday({
        workedSeconds: 3600,
        deviceSeconds: 3600,
        projects: [],
      });

      at('2026-10-22T08:00:00.000Z');

      expect(subject.todayTotals()).toBeNull();
    });

    it('stamps the day in local time, not UTC', () => {
      // Late evening in a positive-offset zone is already tomorrow in UTC;
      // the day shown must be the one the person is living in.
      const evening = new Date(2026, 9, 21, 23, 30);

      expect(localDay(evening)).toBe('2026-10-21');
    });
  });

  // Totals only held what the server reported, so an hour worked with no
  // connection came back as though it had never happened.
  describe('work finished with no connection', () => {
    it('is remembered across a restart on the same day', () => {
      const subject = cache();
      subject.rememberToday({
        workedSeconds: 600,
        deviceSeconds: 600,
        projects: [{ projectId: 'project-1', seconds: 600 }],
      });

      subject.addWorkedSeconds('project-1', 300);

      // A fresh instance: the file is all the next launch has.
      expect(cache().todayTotals()?.workedSeconds).toBe(900);
      expect(cache().todayTotals()?.projects).toEqual([
        { projectId: 'project-1', seconds: 900 },
      ]);
    });

    it('starts a project that had no time yet', () => {
      const subject = cache();
      subject.rememberToday({
        workedSeconds: 600,
        deviceSeconds: 600,
        projects: [{ projectId: 'project-1', seconds: 600 }],
      });

      subject.addWorkedSeconds('project-2', 300);

      expect(subject.todayTotals()?.projects).toEqual([
        { projectId: 'project-1', seconds: 600 },
        { projectId: 'project-2', seconds: 300 },
      ]);
    });

    it('counts time for an organisation that tracks no projects', () => {
      const subject = cache();

      subject.addWorkedSeconds(null, 300);

      expect(subject.todayTotals()?.workedSeconds).toBe(300);
      expect(subject.todayTotals()?.projects).toEqual([]);
    });

    it('opens a new day rather than inflating yesterday', () => {
      const subject = cache();
      subject.rememberToday({
        workedSeconds: 3600,
        deviceSeconds: 3600,
        projects: [],
      });

      at('2026-10-22T08:00:00.000Z');
      subject.addWorkedSeconds(null, 300);

      expect(subject.todayTotals()?.workedSeconds).toBe(300);
    });

    it('ignores a stretch with no time in it', () => {
      const subject = cache();

      subject.addWorkedSeconds('project-1', 0);

      expect(subject.todayTotals()).toBeNull();
    });
  });

  describe('the running timer', () => {
    it('remembers it, so a restart with no connection can still stop it', () => {
      const subject = cache();

      subject.rememberRunning(entry);

      expect(cache().read().runningEntry).toEqual(entry);
      expect(cache().read().runningSeenAt).toBe('2026-10-21T10:00:00.000Z');
    });

    // Written only on a server answer, an outage looked exactly like a
    // crash — and an hour of offline work was ended where it dropped.
    describe('keeping the liveness stamp current', () => {
      it('moves the stamp on without being told the entry again', () => {
        const subject = cache();
        subject.rememberRunning(entry);

        at('2026-10-21T10:45:00.000Z');
        subject.touchRunning();

        expect(subject.read().runningSeenAt).toBe('2026-10-21T10:45:00.000Z');
        expect(subject.read().runningEntry).toEqual(entry);
      });

      it('says nothing when no timer is running', () => {
        const subject = cache();

        subject.touchRunning();

        // Stamping one here would resurrect a gap already settled.
        expect(subject.read().runningSeenAt).toBeNull();
      });

      it('does not bring back a stamp cleared by stopping', () => {
        const subject = cache();
        subject.rememberRunning(entry);
        subject.rememberRunning(null);

        at('2026-10-21T11:00:00.000Z');
        subject.touchRunning();

        expect(subject.read().runningSeenAt).toBeNull();
      });
    });

    it('clears the stamp when nothing is running', () => {
      const subject = cache();
      subject.rememberRunning(entry);

      subject.rememberRunning(null);

      expect(subject.read().runningSeenAt).toBeNull();
    });
  });

  describe('how long it has been silent', () => {
    it('is null before the server has ever answered', () => {
      expect(cache().silentForMs()).toBeNull();
    });

    it('measures from the last answer', () => {
      const subject = cache();
      subject.rememberContact();

      at('2026-10-21T10:30:00.000Z');

      expect(subject.silentForMs()).toBe(30 * 60 * 1000);
    });

    it('never reads as fresher than fresh when the clock moves backwards', () => {
      const subject = cache();
      subject.rememberContact();

      at('2026-10-21T09:00:00.000Z');

      expect(subject.silentForMs()).toBe(0);
    });
  });

  describe('how long capture may act on settings it cannot confirm', () => {
    it('trusts them through an ordinary disconnect', () => {
      const subject = cache();
      subject.rememberContact();

      at('2026-10-24T10:00:00.000Z');

      expect(subject.captureTrustExpired()).toBe(false);
    });

    it('stops trusting them past the window', () => {
      const subject = cache();
      subject.rememberContact();

      at(
        new Date(clock.getTime() + CAPTURE_TRUST_WINDOW_MS + 1000).toISOString(),
      );

      expect(subject.captureTrustExpired()).toBe(true);
    });

    it('trusts nothing before the first contact ever', () => {
      // No settings have arrived, so there is nothing to act on — and
      // defaulting to "allowed" would let a never-connected agent capture.
      expect(cache().captureTrustExpired()).toBe(true);
    });
  });

  // Not the same question as whether capture stopped: before the first
  // poll of every launch there has been no contact, so announcing it put
  // "paused until Hi Day can be reached" next to "Synced just now".
  describe('whether a pause is worth announcing', () => {
    it('says nothing before the first contact — that is a startup moment, not an outage', () => {
      const subject = cache();

      expect(subject.captureTrustExpired()).toBe(true);
      expect(subject.captureTrustLapsed()).toBe(false);
    });

    it('says nothing while contact is recent', () => {
      const subject = cache();
      subject.rememberContact();

      at('2026-10-22T10:00:00.000Z');

      expect(subject.captureTrustLapsed()).toBe(false);
    });

    it('says so once settings it had have gone stale', () => {
      const subject = cache();
      subject.rememberContact();

      at(
        new Date(clock.getTime() + CAPTURE_TRUST_WINDOW_MS + 1000).toISOString(),
      );

      expect(subject.captureTrustLapsed()).toBe(true);
    });

    it('stops saying so once the server answers again', () => {
      const subject = cache();
      subject.rememberContact();
      at(
        new Date(clock.getTime() + CAPTURE_TRUST_WINDOW_MS + 1000).toISOString(),
      );
      expect(subject.captureTrustLapsed()).toBe(true);

      subject.rememberContact();

      // Without this the banner stayed up for the rest of the session.
      expect(subject.captureTrustLapsed()).toBe(false);
    });
  });

  describe('the clock it projects with nobody to ask', () => {
    /** Local parts, not a Z string: a UTC fixture lands either side of the
     * person's midnight depending on where they are. */
    const local = (
      year: number,
      month: number,
      day: number,
      hour: number,
      minute = 0,
    ): string => new Date(year, month - 1, day, hour, minute).toISOString();

    it('carries the last figure forward through the day it belongs to', () => {
      at(local(2026, 10, 21, 9));
      const held = cache();
      held.rememberRunning(entry);
      held.remember({
        workedSeconds: 3600,
        workedSecondsAt: local(2026, 10, 21, 9),
      });

      at(local(2026, 10, 21, 9, 30));
      expect(cache().projectedWorkedSeconds(entry)).toBe(3600 + 1800);
    });

    // The server counts open entries from their own starts, so an entry
    // nobody closed made that figure the whole of yesterday evening.
    it('will not carry yesterday\'s figure into a new morning', () => {
      at(local(2026, 11, 9, 21, 41));
      cache().remember({
        workedSeconds: 19 * 3600,
        workedSecondsAt: local(2026, 11, 9, 21, 41),
      });

      at(local(2026, 11, 10, 4, 30));
      const morning: TimeEntry = {
        ...entry,
        startedAt: local(2026, 11, 10, 3, 46),
      };

      // The entry's own share of today, which is what the renderer would
      // have worked out for itself.
      expect(cache().projectedWorkedSeconds(morning)).toBe(44 * 60);
    });

    it('counts from midnight for an entry that began before it', () => {
      at(local(2026, 11, 9, 21, 41));
      cache().remember({
        workedSeconds: 19 * 3600,
        workedSecondsAt: local(2026, 11, 9, 21, 41),
      });

      at(local(2026, 11, 10, 4, 30));
      const overnight: TimeEntry = {
        ...entry,
        startedAt: local(2026, 11, 9, 18, 5),
      };

      expect(cache().projectedWorkedSeconds(overnight)).toBe(4.5 * 3600);
    });

    it('is nothing at all when no timer is running', () => {
      at(local(2026, 11, 10, 4, 30));
      expect(cache().projectedWorkedSeconds(null)).toBe(0);
    });
  });

  /**
   * The server counts every day from the organisation's midnight, so the
   * cache has to stamp and measure from the same one — a machine in
   * another zone was a day out for as many hours as the two differ.
   */
  describe('following the organisation s day, not the machine s', () => {
    const policy = {
      handling: 'flag' as const,
      thresholdMinutes: 5,
      timezone: 'Indian/Antananarivo',
    };

    it('stamps totals with the organisation s day', () => {
      // 01:00 on the 10th in Antananarivo; still the 9th anywhere west of it.
      at('2026-11-09T22:00:00.000Z');
      const held = cache();
      held.remember({ idlePolicy: policy });
      held.rememberToday({ workedSeconds: 60, deviceSeconds: 60, projects: [] });

      expect(held.read().today?.day).toBe('2026-11-10');
    });

    it('withholds totals stamped with the organisation s yesterday', () => {
      at('2026-11-09T20:00:00.000Z'); // 23:00 on the 9th, Antananarivo
      const held = cache();
      held.remember({ idlePolicy: policy });
      held.rememberToday({ workedSeconds: 60, deviceSeconds: 60, projects: [] });
      expect(cache().todayTotals()?.workedSeconds).toBe(60);

      at('2026-11-09T22:00:00.000Z'); // 01:00 on the 10th — a new org day
      expect(cache().todayTotals()).toBeNull();
    });

    it('measures the running entry from the organisation s midnight', () => {
      at('2026-11-09T22:00:00.000Z');
      const held = cache();
      held.remember({ idlePolicy: policy });
      const running: TimeEntry = {
        ...entry,
        startedAt: '2026-11-09T18:00:00.000Z',
      };

      // Org midnight was 21:00Z, so one hour of today, not four.
      expect(held.projectedWorkedSeconds(running)).toBe(3600);
    });

    it('falls back to the machine s day when no zone has been heard', () => {
      at('2026-11-09T22:00:00.000Z');
      const held = cache();
      held.rememberToday({ workedSeconds: 60, deviceSeconds: 60, projects: [] });

      expect(held.read().today?.day).toBe(localDay(new Date('2026-11-09T22:00:00.000Z')));
    });
  });

  it('forgets everything on sign-out', () => {
    const subject = cache();
    subject.readFor('device-1');
    subject.remember({ projects: [project] });

    subject.clear();

    expect(cache().read().projects).toBeNull();
    expect(cache().read().deviceId).toBeNull();
  });
});
