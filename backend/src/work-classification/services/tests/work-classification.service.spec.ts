import type { DataSource, Repository } from 'typeorm';
import type { AppEvent } from '../../../database/entities/app-event.entity';
import type { UrlSession } from '../../../database/entities/url-session.entity';
import type { WorkClassification } from '../../../database/entities/work-classification.entity';
import type { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import { WorkClassificationService } from '../work-classification.service';

function makeService({
  apps = [] as { name: string; seconds: string }[],
  sites = [] as { name: string; seconds: string }[],
  labels = [] as Partial<WorkClassification>[],
  readings = [] as Partial<AppEvent>[],
} = {}) {
  const classifications = {
    find: jest.fn().mockResolvedValue(labels),
    delete: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const query = jest
    .fn()
    .mockResolvedValueOnce(apps)
    .mockResolvedValueOnce(sites);
  const service = new WorkClassificationService(
    classifications as unknown as Repository<WorkClassification>,
    {
      find: jest.fn().mockResolvedValue(readings),
    } as unknown as Repository<AppEvent>,
    {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<UrlSession>,
    { query } as unknown as DataSource,
    {
      // On the timer all of Nov 4.
      listCoveringWindow: jest.fn().mockResolvedValue([
        {
          id: 'entry-1',
          projectId: null,
          startedAt: new Date('2026-11-04T00:00:00.000Z'),
          endedAt: new Date('2026-11-05T00:00:00.000Z'),
        },
      ]),
    } as unknown as TimeEntriesService,
  );
  return { service, classifications, query };
}

describe('WorkClassificationService', () => {
  describe('listUsage', () => {
    it('lists apps and sites by time spent, with their labels', async () => {
      const { service } = makeService({
        apps: [{ name: 'Code', seconds: '3600' }],
        sites: [{ name: 'github.com', seconds: '7200' }],
        labels: [{ kind: 'app', name: 'Code', label: 'core' }],
      });

      await expect(service.listUsage('org-1')).resolves.toEqual([
        {
          kind: 'site',
          name: 'github.com',
          secondsSpent: 7200,
          label: 'unclassified',
        },
        { kind: 'app', name: 'Code', secondsSpent: 3600, label: 'core' },
      ]);
    });

    it('keeps a label whose app was not used lately, so it can be undone', async () => {
      const { service } = makeService({
        labels: [{ kind: 'site', name: 'youtube.com', label: 'non_core' }],
      });

      await expect(service.listUsage('org-1')).resolves.toEqual([
        {
          kind: 'site',
          name: 'youtube.com',
          secondsSpent: 0,
          label: 'non_core',
        },
      ]);
    });

    it('scopes every read to the organisation', async () => {
      const { service, query, classifications } = makeService();

      await service.listUsage('org-1');

      for (const [, params] of query.mock.calls) {
        expect((params as unknown[])[0]).toBe('org-1');
      }
      expect(classifications.find).toHaveBeenCalledWith({
        where: { organisationId: 'org-1' },
      });
    });
  });

  describe('setLabel', () => {
    it('stores core and non-core', async () => {
      const { service, classifications } = makeService();

      await service.setLabel('org-1', {
        kind: 'app',
        name: 'Code',
        label: 'core',
      });

      expect(classifications.upsert).toHaveBeenCalledWith(
        { organisationId: 'org-1', kind: 'app', name: 'Code', label: 'core' },
        ['organisationId', 'kind', 'name'],
      );
    });

    it('removes the label for unclassified', async () => {
      const { service, classifications } = makeService();

      await service.setLabel('org-1', {
        kind: 'site',
        name: 'github.com',
        label: 'unclassified',
      });

      expect(classifications.delete).toHaveBeenCalledWith({
        organisationId: 'org-1',
        kind: 'site',
        name: 'github.com',
      });
      expect(classifications.upsert).not.toHaveBeenCalled();
    });
  });

  describe('splitForMember', () => {
    // A minute of Chrome on a past day: 12 readings, 5 s each.
    const pastMinute = Array.from({ length: 12 }, (_, index) => ({
      appName: 'Google Chrome',
      sampledAt: new Date(
        Date.parse('2026-11-04T09:00:00.000Z') + index * 5000,
      ),
    }));
    const nov4 = [
      new Date('2026-11-04T00:00:00.000Z'),
      new Date('2026-11-05T00:00:00.000Z'),
    ] as const;

    it('re-reads the labels, so a label set later changes past dates', async () => {
      const { service, classifications } = makeService({
        readings: pastMinute,
      });

      await expect(
        service.splitForMember('org-1', 'membership-1', ...nov4),
      ).resolves.toEqual({
        coreSeconds: 0,
        nonCoreSeconds: 0,
        unclassifiedSeconds: 60,
      });

      // The admin labels Chrome core after the day was tracked.
      classifications.find.mockResolvedValue([
        { kind: 'app', name: 'Google Chrome', label: 'core' },
      ]);

      await expect(
        service.splitForMember('org-1', 'membership-1', ...nov4),
      ).resolves.toEqual({
        coreSeconds: 60,
        nonCoreSeconds: 0,
        unclassifiedSeconds: 0,
      });
    });

    it('goes back to unclassified when the label is removed', async () => {
      const { service, classifications } = makeService({
        readings: pastMinute,
        labels: [{ kind: 'app', name: 'Google Chrome', label: 'non_core' }],
      });

      await expect(
        service.splitForMember('org-1', 'membership-1', ...nov4),
      ).resolves.toMatchObject({ nonCoreSeconds: 60 });

      classifications.find.mockResolvedValue([]);

      await expect(
        service.splitForMember('org-1', 'membership-1', ...nov4),
      ).resolves.toEqual({
        coreSeconds: 0,
        nonCoreSeconds: 0,
        unclassifiedSeconds: 60,
      });
    });
  });
});
