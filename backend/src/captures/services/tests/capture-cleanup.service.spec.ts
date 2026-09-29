import { EntityManager } from 'typeorm';
import { AppEvent } from '../../../database/entities/app-event.entity';
import { Screenshot } from '../../../database/entities/screenshot.entity';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { UrlSession } from '../../../database/entities/url-session.entity';
import { ScreenshotStorageService } from '../../../screenshots/services/screenshot-storage.service';
import { CaptureCleanupService } from '../capture-cleanup.service';

describe('CaptureCleanupService', () => {
  const WINDOW = {
    from: new Date('2026-01-05T09:00:00Z'),
    to: new Date('2026-01-05T11:00:00Z'),
  };

  function at(time: string): Date {
    return new Date(`2026-01-05T${time}:00Z`);
  }

  /**
   * A fake manager answering `find` per entity, and recording deletes. The
   * service reads four tables, so a single mock return value isn't enough.
   */
  function makeManager(rows: {
    entries?: Partial<TimeEntry>[];
    appEvents?: Partial<AppEvent>[];
    urlSessions?: Partial<UrlSession>[];
    screenshots?: Partial<Screenshot>[];
  }) {
    const deletes: { entity: unknown; ids: string[] }[] = [];
    const find = jest.fn((entity: unknown) => {
      if (entity === TimeEntry) return Promise.resolve(rows.entries ?? []);
      if (entity === AppEvent) return Promise.resolve(rows.appEvents ?? []);
      if (entity === UrlSession) return Promise.resolve(rows.urlSessions ?? []);
      if (entity === Screenshot) return Promise.resolve(rows.screenshots ?? []);
      return Promise.resolve([]);
    });
    const manager = {
      find,
      delete: jest.fn(
        (entity: unknown, criteria: { id: { _value: string[] } }) => {
          deletes.push({ entity, ids: criteria.id._value });
          return Promise.resolve({ affected: criteria.id._value.length });
        },
      ),
    } as unknown as EntityManager;
    return { manager, deletes, find };
  }

  function makeService() {
    const deleteObjects = jest.fn().mockResolvedValue(undefined);
    const service = new CaptureCleanupService({
      deleteObjects,
    } as unknown as ScreenshotStorageService);
    return { service, deleteObjects };
  }

  it('deletes captures no surviving entry covers', async () => {
    const { manager, deletes } = makeManager({
      entries: [],
      appEvents: [{ id: 'ae-1', sampledAt: at('09:30') }],
    });
    const { service } = makeService();

    const pruned = await service.pruneUncovered(manager, 'm-1', WINDOW);

    expect(pruned.appEvents).toBe(1);
    expect(deletes).toEqual([{ entity: AppEvent, ids: ['ae-1'] }]);
  });

  // The point of recomputing coverage rather than deleting the whole window:
  // another entry may still account for part of it.
  it('keeps captures another entry still covers', async () => {
    const { manager, deletes } = makeManager({
      entries: [{ startedAt: at('09:00'), endedAt: at('10:00') }],
      appEvents: [
        { id: 'inside', sampledAt: at('09:30') },
        { id: 'outside', sampledAt: at('10:30') },
      ],
    });
    const { service } = makeService();

    const pruned = await service.pruneUncovered(manager, 'm-1', WINDOW);

    expect(pruned.appEvents).toBe(1);
    expect(deletes).toEqual([{ entity: AppEvent, ids: ['outside'] }]);
  });

  it('treats a running entry as covering the rest of the window', async () => {
    const { manager, deletes } = makeManager({
      entries: [{ startedAt: at('09:00'), endedAt: null }],
      appEvents: [{ id: 'ae-1', sampledAt: at('10:45') }],
    });
    const { service } = makeService();

    await service.pruneUncovered(manager, 'm-1', WINDOW);

    expect(deletes).toEqual([]);
  });

  it('merges overlapping entries rather than double-counting coverage', async () => {
    const { manager, deletes } = makeManager({
      entries: [
        { startedAt: at('09:00'), endedAt: at('10:00') },
        { startedAt: at('09:45'), endedAt: at('11:00') },
      ],
      appEvents: [{ id: 'ae-1', sampledAt: at('10:30') }],
    });
    const { service } = makeService();

    await service.pruneUncovered(manager, 'm-1', WINDOW);

    expect(deletes).toEqual([]);
  });

  // A URL session is a span, so it survives while any of it is covered —
  // deleting it would throw away the part that still belongs to an entry.
  it('keeps a URL session that only partly runs past the coverage', async () => {
    const { manager, deletes } = makeManager({
      entries: [{ startedAt: at('09:00'), endedAt: at('10:00') }],
      urlSessions: [
        { id: 'straddles', startedAt: at('09:50'), endedAt: at('10:20') },
        { id: 'outside', startedAt: at('10:30'), endedAt: at('10:40') },
      ],
    });
    const { service } = makeService();

    const pruned = await service.pruneUncovered(manager, 'm-1', WINDOW);

    expect(pruned.urlSessions).toBe(1);
    expect(deletes).toEqual([{ entity: UrlSession, ids: ['outside'] }]);
  });

  it('returns the storage keys of pruned screenshots without deleting them', async () => {
    const { manager } = makeManager({
      entries: [],
      screenshots: [
        { id: 'sc-1', capturedAt: at('09:30'), storageKey: 'shots/a.jpg' },
      ],
    });
    const { service, deleteObjects } = makeService();

    const pruned = await service.pruneUncovered(manager, 'm-1', WINDOW);

    expect(pruned.screenshots).toBe(1);
    expect(pruned.storageKeys).toEqual(['shots/a.jpg']);
    expect(deleteObjects).not.toHaveBeenCalled();
  });

  it('deletes storage objects only when asked to, after the fact', async () => {
    const { service, deleteObjects } = makeService();

    await service.deleteStoredObjects(['shots/a.jpg']);

    expect(deleteObjects).toHaveBeenCalledWith(['shots/a.jpg']);
  });

  it('does not call storage at all for an empty key list', async () => {
    const { service, deleteObjects } = makeService();

    await service.deleteStoredObjects([]);

    expect(deleteObjects).not.toHaveBeenCalled();
  });

  it('does nothing for an empty or inverted window', async () => {
    const { manager, find } = makeManager({
      appEvents: [{ id: 'ae-1', sampledAt: at('09:30') }],
    });
    const { service } = makeService();

    const pruned = await service.pruneUncovered(manager, 'm-1', {
      from: WINDOW.to,
      to: WINDOW.from,
    });

    expect(pruned).toEqual({
      appEvents: 0,
      urlSessions: 0,
      screenshots: 0,
      storageKeys: [],
    });
    expect(find).not.toHaveBeenCalled();
  });
});
