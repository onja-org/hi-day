import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Membership } from '../../../database/entities/membership.entity';
import { SavedReport } from '../../../database/entities/saved-report.entity';
import { UpsertSavedReportDto } from '../../dto/upsert-saved-report.dto';
import { SavedReportsService } from '../saved-reports.service';

const dto = {
  name: '  Weekly  ',
  settings: {
    datePreset: 'last_week',
    days: { from: '2026-09-21', to: '2026-09-27' },
    scope: 'me',
    grouping: 'day',
    filters: { memberIds: [], teamIds: [], projectIds: [] },
  },
  schedule: null,
} as UpsertSavedReportDto;

function stored(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: 'r1',
    organisationId: 'org-1',
    membershipId: 'm1',
    name: 'Old',
    reportType: 'time-and-activity',
    settings: dto.settings,
    schedule: null,
    lastSentOn: null,
    lastSentAt: null,
    lastError: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-02T00:00:00Z'),
    ...overrides,
  } as SavedReport;
}

function setup(
  options: { membership?: object | null; owned?: SavedReport | null } = {},
) {
  const membershipsFindOne = jest
    .fn()
    .mockResolvedValue(
      options.membership === undefined ? { id: 'm1' } : options.membership,
    );
  const find = jest.fn().mockResolvedValue([stored()]);
  const findOne = jest
    .fn()
    .mockResolvedValue(options.owned === undefined ? stored() : options.owned);
  const save = jest.fn((_entity: unknown, row: SavedReport) =>
    Promise.resolve({
      ...stored(),
      ...row,
      id: row.id ?? 'new-id',
      updatedAt: new Date('2026-10-01T00:00:00Z'),
    }),
  );
  const create = jest.fn((_entity: unknown, plain: object) => plain);
  const del = jest.fn().mockResolvedValue(undefined);
  const manager = { save, create, delete: del } as unknown as EntityManager;
  const transaction = jest.fn((fn: (m: EntityManager) => Promise<unknown>) =>
    fn(manager),
  );
  const record = jest.fn().mockResolvedValue(undefined);

  const service = new SavedReportsService(
    { find, findOne } as unknown as Repository<SavedReport>,
    { findOne: membershipsFindOne } as unknown as Repository<Membership>,
    { transaction } as never,
    { record },
  );
  return { service, find, findOne, save, create, del, record };
}

describe('SavedReportsService', () => {
  it("lists only the caller's own reports in this organisation", async () => {
    const { service, find } = setup();

    const reports = await service.list('org-1', 'u1');

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: 'org-1', membershipId: 'm1' },
      }),
    );
    expect(reports[0]).toMatchObject({
      id: 'r1',
      modifiedAt: '2026-09-02T00:00:00.000Z',
    });
  });

  it('refuses a caller with no active membership', async () => {
    const { service } = setup({ membership: null });
    await expect(service.list('org-1', 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("creates a report owned by the caller's membership, trimming the name", async () => {
    const { service, create, record } = setup();

    const report = await service.create('org-1', 'u1', dto);

    expect(create).toHaveBeenCalledWith(
      SavedReport,
      expect.objectContaining({
        organisationId: 'org-1',
        membershipId: 'm1',
        name: 'Weekly',
        schedule: null,
      }),
    );
    expect(report.name).toBe('Weekly');
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'saved_report.created' }),
    );
  });

  it('updates name, settings and schedule', async () => {
    const { service, save } = setup();
    const schedule = {
      emails: ['a@example.com'],
      message: 'hi',
      fileType: 'pdf',
      dateRange: 'last_week',
      frequency: 'weekly',
      hour: 9,
      days: [1],
    } as const;

    const report = await service.update('org-1', 'u1', 'r1', {
      ...dto,
      schedule: {
        ...schedule,
        days: [...schedule.days],
        emails: [...schedule.emails],
      },
    });

    expect(save).toHaveBeenCalled();
    expect(report.schedule).toMatchObject({ frequency: 'weekly' });
  });

  it('clears the schedule when saved without one', async () => {
    const owned = stored({
      schedule: {
        emails: ['a@example.com'],
        message: '',
        fileType: 'csv',
        dateRange: 'today',
        frequency: 'daily',
        hour: 8,
        days: [1],
      },
      lastError: 'old failure',
    });
    const { service } = setup({ owned });

    const report = await service.update('org-1', 'u1', 'r1', dto);

    expect(report.schedule).toBeNull();
    expect(report.lastError).toBeNull();
  });

  it("looks a report up by id within the caller's own, so someone else's is not found", async () => {
    const { service, findOne } = setup({ owned: null });

    await expect(service.update('org-1', 'u1', 'r1', dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'r1', organisationId: 'org-1', membershipId: 'm1' },
    });
  });

  it('deletes within the organisation and the owner, and records it', async () => {
    const { service, del, record } = setup();

    await service.remove('org-1', 'u1', 'r1');

    expect(del).toHaveBeenCalledWith(SavedReport, {
      id: 'r1',
      organisationId: 'org-1',
      membershipId: 'm1',
    });
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'saved_report.deleted' }),
    );
  });

  it("will not delete someone else's report", async () => {
    const { service, del } = setup({ owned: null });
    await expect(service.remove('org-1', 'u1', 'r1')).rejects.toThrow(
      NotFoundException,
    );
    expect(del).not.toHaveBeenCalled();
  });
});
