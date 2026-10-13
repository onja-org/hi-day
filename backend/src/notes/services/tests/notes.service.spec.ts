import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { Note } from '../../../database/entities/note.entity';
import { NotesService } from '../notes.service';

describe('NotesService', () => {
  function makeNotesRepo(overrides: Partial<Repository<Note>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      ...overrides,
    } as unknown as Repository<Note>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeDataSource() {
    const save = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn((_entity: unknown, plain: object) => ({
      id: 'note-1',
      createdAt: new Date('2026-01-01'),
      ...plain,
    }));
    const manager = { save, create } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return { dataSource: { transaction } as unknown, transaction, save };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeService(
    overrides: {
      notesRepo?: Repository<Note>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new NotesService(
      overrides.notesRepo ?? makeNotesRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  describe('create', () => {
    it('saves the note under the caller’s own membership and records an audit log entry', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { dataSource, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        dataSource,
        auditLogService,
      });

      const entry = await service.create('org-1', 'user-1', {
        noteDate: '2026-09-08',
        projectId: 'project-1',
        content: 'Worked on the report.',
      });

      expect(entry).toEqual(
        expect.objectContaining({
          id: 'note-1',
          membershipId: 'membership-1',
          projectId: 'project-1',
          noteDate: '2026-09-08',
          content: 'Worked on the report.',
        }),
      );
      expect(save).toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'note.created' }),
      );
    });

    it('defaults projectId to null when none is given', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
      });

      const entry = await service.create('org-1', 'user-1', {
        noteDate: '2026-09-08',
        content: 'No project today.',
      });

      expect(entry.projectId).toBeNull();
    });
  });

  describe('listMineForDay', () => {
    it("scopes to the caller's own membership and the given day", async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({ find }),
      });

      await service.listMineForDay('org-1', 'user-1', '2026-09-08');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: 'org-1',
            membershipId: 'membership-1',
            noteDate: '2026-09-08',
          },
        }),
      );
    });

    it('narrows to one project when given', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({ find }),
      });

      await service.listMineForDay(
        'org-1',
        'user-1',
        '2026-09-08',
        'project-1',
      );

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-1' }) as unknown,
        }),
      );
    });

    it('defaults to today when no date is given', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({ find }),
      });

      await service.listMineForDay('org-1', 'user-1', undefined);

      const today = new Date().toISOString().slice(0, 10);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: 'org-1',
            membershipId: 'membership-1',
            noteDate: today,
          },
        }),
      );
    });

    it('rejects a malformed date', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
      });

      await expect(
        service.listMineForDay('org-1', 'user-1', 'not-a-date'),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe('listForMembership', () => {
    it('throws when either membership cannot be found', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.listForMembership(
          'org-1',
          'caller-1',
          'membership-1',
          undefined,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies a member viewing a peer', async () => {
      const caller = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        status: MembershipStatus.ACTIVE,
      };
      const target = {
        id: 'membership-2',
        userId: 'user-2',
        role: MembershipRole.MEMBER,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        status: MembershipStatus.ACTIVE,
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
      });

      await expect(
        service.listForMembership('org-1', 'user-1', 'membership-2', undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an admin to view anyone', async () => {
      const caller = {
        id: 'membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
      };
      const target = {
        id: 'membership-2',
        userId: 'user-2',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({ find }),
      });

      await expect(
        service.listForMembership(
          'org-1',
          'admin-1',
          'membership-2',
          '2026-09-08',
        ),
      ).resolves.toEqual([]);

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: 'org-1',
            membershipId: 'membership-2',
            noteDate: '2026-09-08',
          },
        }),
      );
    });
  });

  describe('deleteOwn', () => {
    it('deletes a note the caller authored', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const notesFindOne = jest
        .fn()
        .mockResolvedValue({ id: 'note-1', membershipId: 'membership-1' });
      const deleteFn = jest.fn().mockResolvedValue({ affected: 1 });
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({ findOne: notesFindOne, delete: deleteFn }),
      });

      await service.deleteOwn('org-1', 'user-1', 'note-1');

      expect(deleteFn).toHaveBeenCalledWith({
        id: 'note-1',
        organisationId: 'org-1',
      });
    });

    it('rejects deleting a note authored by someone else', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const notesFindOne = jest
        .fn()
        .mockResolvedValue({ id: 'note-1', membershipId: 'someone-else' });
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({ findOne: notesFindOne }),
      });

      await expect(
        service.deleteOwn('org-1', 'user-1', 'note-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the note does not exist', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        notesRepo: makeNotesRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.deleteOwn('org-1', 'user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
