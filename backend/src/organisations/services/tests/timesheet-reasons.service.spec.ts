import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { TimesheetReason } from '../../../database/entities/timesheet-reason.entity';
import { MAX_TIMESHEET_REASONS } from '../../timesheet-settings';
import { TimesheetReasonsService } from '../timesheet-reasons.service';

describe('TimesheetReasonsService', () => {
  /** The duplicate-label check runs through a query builder, so every test
   * needs one; `clashes` is how many rows it claims to have found. */
  function makeQueryBuilder(clashes = 0) {
    const qb = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getCount: jest.fn().mockResolvedValue(clashes),
    };
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
    return qb;
  }

  /**
   * Returns the mocks alongside the service, rather than reaching back
   * through `repo.find` in the assertions — the lint rule rejects asserting
   * on a method plucked off its object.
   */
  function makeService(
    options: {
      rows?: Partial<TimesheetReason>[];
      existing?: Partial<TimesheetReason> | null;
      count?: number;
      clashes?: number;
    } = {},
  ) {
    const find = jest.fn().mockResolvedValue(options.rows ?? []);
    const findOneBy = jest.fn().mockResolvedValue(options.existing ?? null);
    const countBy = jest.fn().mockResolvedValue(options.count ?? 0);
    const create = jest.fn((data: Partial<TimesheetReason>) => data);
    const save = jest.fn((data: Partial<TimesheetReason>) => ({
      id: 'reason-1',
      ...data,
    }));
    const remove = jest.fn().mockResolvedValue(undefined);
    const createQueryBuilder = jest
      .fn()
      .mockReturnValue(makeQueryBuilder(options.clashes ?? 0));
    const record = jest.fn().mockResolvedValue(undefined);

    const repo = {
      find,
      findOneBy,
      countBy,
      create,
      save,
      remove,
      createQueryBuilder,
    } as unknown as Repository<TimesheetReason>;

    const dataSource = {
      transaction: jest.fn((fn: (manager: EntityManager) => Promise<unknown>) =>
        fn({} as EntityManager),
      ),
    } as unknown as DataSource;

    const auditLogService = { record } as unknown as AuditLogService;

    return {
      service: new TimesheetReasonsService(repo, dataSource, auditLogService),
      find,
      save,
      remove,
      record,
    };
  }

  describe('list', () => {
    it('returns the organisation’s reasons oldest-first, as id/label pairs', async () => {
      const { service, find } = makeService({
        rows: [
          { id: 'a', label: 'Forgot to start timer' },
          { id: 'b', label: 'Client meeting' },
        ],
      });

      await expect(service.list('org-1')).resolves.toEqual([
        { id: 'a', label: 'Forgot to start timer' },
        { id: 'b', label: 'Client meeting' },
      ]);
      expect(find).toHaveBeenCalledWith({
        where: { organisationId: 'org-1' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('stores the label and records an audit row', async () => {
      const { service, record } = makeService();

      await expect(
        service.create('org-1', 'user-1', { label: 'Client meeting' }),
      ).resolves.toEqual({ id: 'reason-1', label: 'Client meeting' });
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'timesheet_reason.created' }),
      );
    });

    it('refuses a label that already exists, case-insensitively', async () => {
      const { service, save } = makeService({ clashes: 1 });

      await expect(
        service.create('org-1', 'user-1', { label: 'client meeting' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(save).not.toHaveBeenCalled();
    });

    it('refuses to grow the list past the cap', async () => {
      const { service, save } = makeService({ count: MAX_TIMESHEET_REASONS });

      await expect(
        service.create('org-1', 'user-1', { label: 'One more' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    it('records both the old and the new wording', async () => {
      const { service, record } = makeService({
        existing: { id: 'reason-1', label: 'Old', organisationId: 'org-1' },
      });

      await service.rename('org-1', 'user-1', 'reason-1', { label: 'New' });

      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'timesheet_reason.renamed',
          metadata: { timesheetReasonId: 'reason-1', from: 'Old', to: 'New' },
        }),
      );
    });

    it('is a no-op when the label has not changed', async () => {
      const { service, save, record } = makeService({
        existing: { id: 'reason-1', label: 'Same', organisationId: 'org-1' },
      });

      await expect(
        service.rename('org-1', 'user-1', 'reason-1', { label: 'Same' }),
      ).resolves.toEqual({ id: 'reason-1', label: 'Same' });
      expect(save).not.toHaveBeenCalled();
      expect(record).not.toHaveBeenCalled();
    });

    it('refuses a reason belonging to another organisation', async () => {
      const { service } = makeService({ existing: null });

      await expect(
        service.rename('org-1', 'user-1', 'reason-1', { label: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the row outright, keeping the label on the audit entry', async () => {
      const reason = { id: 'reason-1', label: 'Gone', organisationId: 'org-1' };
      const { service, remove, record } = makeService({ existing: reason });

      await service.remove('org-1', 'user-1', 'reason-1');

      expect(remove).toHaveBeenCalledWith(reason);
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'timesheet_reason.deleted',
          metadata: { timesheetReasonId: 'reason-1', label: 'Gone' },
        }),
      );
    });
  });
});
