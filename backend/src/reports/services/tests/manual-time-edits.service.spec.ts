import { ForbiddenException } from '@nestjs/common';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { ManualTimeEditsService } from '../manual-time-edits.service';

describe('ManualTimeEditsService', () => {
  const from = new Date('2026-10-01T00:00:00Z');
  const to = new Date('2026-10-31T23:59:59Z');
  const at = new Date('2026-10-05T10:00:00Z');

  function log(action: string, metadata: Record<string, unknown>, id = action) {
    return {
      id,
      action,
      metadata,
      createdAt: at,
      actorUser: { name: 'Admin', email: 'admin@example.com' },
    };
  }

  function setup(
    options: {
      role?: MembershipRole;
      logs?: ReturnType<typeof log>[];
      liveEntries?: Record<string, unknown>[];
    } = {},
  ) {
    const caller = {
      id: 'caller',
      role: options.role ?? MembershipRole.ADMIN,
    } as Membership;
    const members = [
      { id: 'caller', user: { name: 'Caller', email: 'c@example.com' } },
      { id: 'other', user: { name: 'Other', email: 'o@example.com' } },
    ];
    const getMany = jest.fn().mockResolvedValue([]);
    const builder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };
    const service = new ManualTimeEditsService(
      {
        find: jest.fn().mockResolvedValue(options.logs ?? []),
        createQueryBuilder: jest.fn().mockReturnValue(builder),
      } as never,
      {
        findOne: jest.fn().mockResolvedValue(caller),
        find: jest.fn().mockResolvedValue(members),
      } as never,
      {
        find: jest.fn().mockResolvedValue([{ id: 'p1', name: 'Website' }]),
      } as never,
      {
        find: jest.fn().mockResolvedValue([{ id: 't1', name: 'Login' }]),
      } as never,
      { find: jest.fn().mockResolvedValue(options.liveEntries ?? []) } as never,
    );
    return { service };
  }

  const added = log('time_entry.created_manually', {
    timeEntryId: 'e1',
    membershipId: 'other',
    projectId: 'p1',
    taskId: 't1',
    startedAt: '2026-10-05T08:00:00.000Z',
    endedAt: '2026-10-05T09:30:00.000Z',
  });

  it('reports an added entry as positive time, naming member, project and task', async () => {
    const { service } = setup({ logs: [added] });

    const [row] = await service.list('org', 'user', 'all', from, to);

    expect(row).toMatchObject({
      action: 'add',
      memberName: 'Other',
      projectName: 'Website',
      taskName: 'Login',
      changeSeconds: 5400,
      changedByName: 'Admin',
    });
  });

  it('reports a deleted entry as negative time and carries its reason', async () => {
    const { service } = setup({
      logs: [
        log('time_entry.deleted', {
          ...added.metadata,
          reason: 'Logged twice',
        }),
      ],
    });

    const [row] = await service.list('org', 'user', 'all', from, to);

    expect(row).toMatchObject({
      action: 'delete',
      changeSeconds: -5400,
      reason: 'Logged twice',
    });
  });

  it('works an edit out as the difference between its own before and after', async () => {
    const { service } = setup({
      logs: [
        log('time_entry.updated', {
          timeEntryId: 'e1',
          changed: {
            endedAt: {
              from: '2026-10-05T09:00:00.000Z',
              to: '2026-10-05T10:00:00.000Z',
            },
          },
        }),
      ],
      liveEntries: [
        {
          id: 'e1',
          membershipId: 'other',
          projectId: 'p1',
          taskId: null,
          startedAt: new Date('2026-10-05T08:00:00Z'),
          endedAt: new Date('2026-10-05T11:00:00Z'),
        },
      ],
    });

    const [row] = await service.list('org', 'user', 'all', from, to);

    expect(row).toMatchObject({
      action: 'edit',
      memberName: 'Other',
      changeSeconds: 3600,
      endedAt: '2026-10-05T10:00:00.000Z',
    });
  });

  it('limits "me" to edits that landed on the caller\'s own timesheet', async () => {
    const mine = log(
      'time_entry.created_manually',
      { ...added.metadata, membershipId: 'caller' },
      'mine',
    );
    const { service } = setup({ logs: [added, mine] });

    const rows = await service.list('org', 'user', 'me', from, to);

    expect(rows.map((row) => row.id)).toEqual(['mine']);
  });

  it('refuses a plain member the organisation-wide view', async () => {
    const { service } = setup({ role: MembershipRole.MEMBER });

    await expect(
      service.list('org', 'user', 'all', from, to),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
