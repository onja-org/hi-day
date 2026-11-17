import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { RoleGuard } from '../../common/guards/role.guard';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { InvitationsController } from './invitations.controller';
import { InviteLinksController } from './invite-links.controller';

/**
 * Who joins the organisation, and at what role, is an admin's decision. A
 * manager could once resend any invitation whatever its status — so an
 * admin invite the admin had revoked came back to life, and the invitee
 * could accept it as an admin. The controllers now refuse every manager,
 * team manager or not, on every route that touches an invitation or link.
 *
 * Read through the controllers' own decorators with Nest's own Reflector,
 * so loosening a decorator fails here.
 */
function guardWith(caller: Partial<Membership>) {
  return new RoleGuard(
    new Reflector(),
    {
      findOne: jest.fn().mockResolvedValue(caller),
    } as unknown as Repository<Membership>,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'org-1', publicId: 100000 }),
    } as unknown as Repository<Organisation>,
  );
}

function routeOn(controller: object, handler: string): ExecutionContext {
  const request = { userId: 'user-1', params: { id: '100000' } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () =>
      (controller as { prototype: Record<string, unknown> }).prototype[handler],
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

const manager = { role: MembershipRole.MANAGER, teamMemberships: [] };
const teamManager = {
  role: MembershipRole.MEMBER,
  teamMemberships: [{ teamId: 'team-1', isManager: true }],
};

describe('who may touch invitations', () => {
  const routes: [string, object, string][] = [
    ['resend an invitation', InvitationsController, 'resend'],
    ['revoke an invitation', InvitationsController, 'revoke'],
    ['list invitations', InvitationsController, 'list'],
    ['send invitations', InvitationsController, 'create'],
    ['create an invite link', InviteLinksController, 'create'],
    ['edit an invite link', InviteLinksController, 'update'],
    ['list invite links', InviteLinksController, 'list'],
    ['delete an invite link', InviteLinksController, 'remove'],
  ];

  it.each(routes)(
    'refuses a manager trying to %s',
    async (_, controller, handler) => {
      await expect(
        guardWith(manager).canActivate(routeOn(controller, handler)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each(routes)(
    'refuses someone who manages a team trying to %s',
    async (_, controller, handler) => {
      await expect(
        guardWith(teamManager).canActivate(routeOn(controller, handler)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each(routes)('lets an admin %s', async (_, controller, handler) => {
    await expect(
      guardWith({
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      }).canActivate(routeOn(controller, handler)),
    ).resolves.toBe(true);
  });
});
