import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../database/entities/membership.entity';
import { Organisation } from '../../database/entities/organisation.entity';
import { ProjectsEnabledGuard } from './projects-enabled.guard';

describe('ProjectsEnabledGuard', () => {
  function makeContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function makeGuard(
    organisation: unknown,
    membership: unknown = null,
    switchedOn = 0,
  ) {
    const findOne = jest.fn().mockResolvedValue(organisation);
    const guard = new ProjectsEnabledGuard(
      { findOne } as unknown as Repository<Organisation>,
      {
        findOne: jest.fn().mockResolvedValue(membership),
        count: jest.fn().mockResolvedValue(switchedOn),
      } as unknown as Repository<Membership>,
    );
    return { guard, findOne };
  }

  it('lets a request through when the organisation enabled projects', async () => {
    const { guard } = makeGuard({ settings: { projectsEnabled: true } });

    await expect(
      guard.canActivate(makeContext({ params: { id: '100000' } })),
    ).resolves.toBe(true);
  });

  it('refuses when the setting is off or was never set', async () => {
    for (const settings of [{ projectsEnabled: false }, {}]) {
      const { guard } = makeGuard({ settings });

      await expect(
        guard.canActivate(makeContext({ params: { id: '100000' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('finds a web organisation by its public id', async () => {
    const { guard, findOne } = makeGuard({
      settings: { projectsEnabled: true },
    });

    await guard.canActivate(makeContext({ params: { id: '100000' } }));

    expect(findOne).toHaveBeenCalledWith({ where: { publicId: 100000 } });
  });

  it('finds a device organisation by the id its session pins', async () => {
    const { guard, findOne } = makeGuard({
      settings: { projectsEnabled: true },
    });

    await guard.canActivate(
      makeContext({ organisationId: 'org-1', params: {} }),
    );

    expect(findOne).toHaveBeenCalledWith({ where: { id: 'org-1' } });
  });

  it('404s on a malformed public id or an unknown organisation', async () => {
    await expect(
      makeGuard(null).guard.canActivate(makeContext({ params: { id: 'abc' } })),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      makeGuard(null).guard.canActivate(
        makeContext({ params: { id: '100000' } }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('per-member override', () => {
    const request = { userId: 'u1', params: { id: '100000' } };

    it('lets someone through whose override is on while the default is off', async () => {
      const { guard } = makeGuard(
        { id: 'org-1', settings: { projectsEnabled: false } },
        { role: 'member', projectsEnabled: true },
      );

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    });

    it('refuses someone whose override is off while the default is on', async () => {
      const { guard } = makeGuard(
        { id: 'org-1', settings: { projectsEnabled: true } },
        { role: 'member', projectsEnabled: false },
      );

      await expect(
        guard.canActivate(makeContext(request)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin manage Projects once anyone has been switched on', async () => {
      const { guard } = makeGuard(
        { id: 'org-1', settings: { projectsEnabled: false } },
        { role: 'admin', projectsEnabled: null },
        1,
      );

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    });

    it('keeps an admin out when nobody has Projects', async () => {
      const { guard } = makeGuard(
        { id: 'org-1', settings: { projectsEnabled: false } },
        { role: 'admin', projectsEnabled: null },
        0,
      );

      await expect(
        guard.canActivate(makeContext(request)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
