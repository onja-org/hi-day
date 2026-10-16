import { Injectable } from '@nestjs/common';
import {
  Between,
  EntityManager,
  In,
  IsNull,
  LessThan,
  MoreThan,
} from 'typeorm';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Screenshot } from '../../database/entities/screenshot.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { ScreenshotStorageService } from '../../screenshots/services/screenshot-storage.service';

export interface CaptureWindow {
  from: Date;
  to: Date;
}

export interface PrunedCaptures {
  appEvents: number;
  urlSessions: number;
  screenshots: number;
  /** Objects to remove from storage once the transaction has committed. */
  storageKeys: string[];
}

interface Interval {
  from: number;
  to: number;
}

const NOTHING_PRUNED: PrunedCaptures = {
  appEvents: 0,
  urlSessions: 0,
  screenshots: 0,
  storageKeys: [],
};

/**
 * Removes captured activity — app events, URL sessions, screenshots — that
 * no Time entry covers any more.
 *
 * Capture only runs while a timer is running, so these rows exist *because*
 * of an entry, but nothing in the schema links them to one: they're
 * attributed to a Membership and a moment, and the read side works out which
 * entry covered them. Delete or shorten an entry and the captures it caused
 * survive, stripped of the context that gave them meaning — the Activity
 * views then label them "No project".
 *
 * Coverage is recomputed from whatever entries remain, so a capture inside
 * another, overlapping entry is kept. That's what makes this safe to run
 * after shortening an entry as well as after deleting one.
 */
@Injectable()
export class CaptureCleanupService {
  constructor(private readonly storage: ScreenshotStorageService) {}

  /**
   * Deletes this Membership's captures inside `window` that no surviving
   * Time entry covers.
   *
   * Runs on the caller's transaction so the entry change and the pruning
   * commit together — coverage is therefore read *after* that change.
   * Screenshot rows go here but their stored objects don't: the returned
   * `storageKeys` are for the caller to delete once committed, since object
   * storage can't take part in a rollback. Leaving an object behind is the
   * safe direction, and the retention job already tolerates it.
   */
  async pruneUncovered(
    manager: EntityManager,
    membershipId: string,
    window: CaptureWindow,
  ): Promise<PrunedCaptures> {
    if (window.to.getTime() <= window.from.getTime()) {
      return NOTHING_PRUNED;
    }

    const covered = await this.coveredIntervals(manager, membershipId, window);

    const [appEvents, urlSessions, screenshots] = await Promise.all([
      this.pruneAppEvents(manager, membershipId, window, covered),
      this.pruneUrlSessions(manager, membershipId, window, covered),
      this.pruneScreenshots(manager, membershipId, window, covered),
    ]);

    return {
      appEvents,
      urlSessions,
      screenshots: screenshots.count,
      storageKeys: screenshots.storageKeys,
    };
  }

  /**
   * Removes the stored objects behind pruned screenshots. Separate from
   * `pruneUncovered` so the caller runs it *after* committing — an object
   * deleted inside a transaction that then rolls back is gone for good,
   * whereas one left behind is merely stale.
   */
  async deleteStoredObjects(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;
    await this.storage.deleteObjects(storageKeys);
  }

  /** The stretches of `window` still covered by a Time entry, merged. */
  private async coveredIntervals(
    manager: EntityManager,
    membershipId: string,
    window: CaptureWindow,
  ): Promise<Interval[]> {
    const entries = await manager.find(TimeEntry, {
      where: [
        {
          membershipId,
          startedAt: LessThan(window.to),
          endedAt: MoreThan(window.from),
        },
        // A running entry has no end, so it covers everything from its start.
        { membershipId, startedAt: LessThan(window.to), endedAt: IsNull() },
      ],
    });

    const clipped = entries
      .map((entry) => ({
        from: Math.max(entry.startedAt.getTime(), window.from.getTime()),
        to: Math.min(
          entry.endedAt?.getTime() ?? window.to.getTime(),
          window.to.getTime(),
        ),
      }))
      .filter((interval) => interval.to > interval.from)
      .sort((a, b) => a.from - b.from);

    const merged: Interval[] = [];
    for (const interval of clipped) {
      const last = merged[merged.length - 1];
      if (last && interval.from <= last.to) {
        last.to = Math.max(last.to, interval.to);
      } else {
        merged.push({ ...interval });
      }
    }
    return merged;
  }

  /** Whether an instant falls inside any covered stretch. */
  private isCovered(covered: Interval[], at: Date): boolean {
    const ms = at.getTime();
    return covered.some((interval) => ms >= interval.from && ms < interval.to);
  }

  /**
   * Whether a span keeps any covered part. Spans are judged by overlap
   * rather than by their start alone, so a URL session that runs past the
   * end of an entry isn't deleted for the part that is still covered.
   */
  private overlapsCovered(covered: Interval[], from: Date, to: Date): boolean {
    return covered.some(
      (interval) =>
        from.getTime() < interval.to && to.getTime() > interval.from,
    );
  }

  private async deleteByIds(
    manager: EntityManager,
    entity: typeof AppEvent | typeof UrlSession | typeof Screenshot,
    ids: string[],
  ): Promise<number> {
    if (ids.length === 0) return 0;
    await manager.delete(entity, { id: In(ids) });
    return ids.length;
  }

  private async pruneAppEvents(
    manager: EntityManager,
    membershipId: string,
    window: CaptureWindow,
    covered: Interval[],
  ): Promise<number> {
    const rows = await manager.find(AppEvent, {
      where: { membershipId, sampledAt: Between(window.from, window.to) },
    });
    const ids = rows
      .filter((row) => !this.isCovered(covered, row.sampledAt))
      .map((row) => row.id);
    return await this.deleteByIds(manager, AppEvent, ids);
  }

  private async pruneUrlSessions(
    manager: EntityManager,
    membershipId: string,
    window: CaptureWindow,
    covered: Interval[],
  ): Promise<number> {
    const rows = await manager.find(UrlSession, {
      where: { membershipId, startedAt: Between(window.from, window.to) },
    });
    const ids = rows
      .filter(
        (row) => !this.overlapsCovered(covered, row.startedAt, row.endedAt),
      )
      .map((row) => row.id);
    return await this.deleteByIds(manager, UrlSession, ids);
  }

  private async pruneScreenshots(
    manager: EntityManager,
    membershipId: string,
    window: CaptureWindow,
    covered: Interval[],
  ): Promise<{ count: number; storageKeys: string[] }> {
    const rows = await manager.find(Screenshot, {
      where: { membershipId, capturedAt: Between(window.from, window.to) },
    });
    const doomed = rows.filter(
      (row) => !this.isCovered(covered, row.capturedAt),
    );
    const count = await this.deleteByIds(
      manager,
      Screenshot,
      doomed.map((row) => row.id),
    );
    return { count, storageKeys: doomed.map((row) => row.storageKey) };
  }
}
