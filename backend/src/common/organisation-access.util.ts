import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FindOptionsRelations, Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { Membership } from '../database/entities/membership.entity';
import { MembershipStatus } from '../database/entities/membership-status.enum';
import { Organisation } from '../database/entities/organisation.entity';

export const SUSPENDED_ORGANISATION_MESSAGE =
  'This organisation has been suspended and is scheduled for deletion.';

/**
 * A suspended Organisation (scheduled for deletion) is closed to everyone,
 * whatever their role. Only routes marked @AllowSuspendedOrganisation, the
 * ones the owner needs to see the state and restore the account, pass
 * `allowSuspended`.
 */
export function assertOrganisationNotSuspended(
  organisation: Organisation,
  allowSuspended = false,
): void {
  if (organisation.suspendedAt && !allowSuspended) {
    throw new ForbiddenException(SUSPENDED_ORGANISATION_MESSAGE);
  }
}

/**
 * The first step every org-scoped web guard runs: finds the Organisation by
 * the public id in `:id`, stores its UUID on the request, refuses a
 * suspended one, then finds the caller's active Membership in it. Each guard
 * then adds its own role, project or team rule on top.
 */
export async function resolveOrganisationAccess(
  request: AuthenticatedRequest,
  repositories: {
    organisations: Repository<Organisation>;
    memberships: Repository<Membership>;
  },
  options: {
    noMembershipMessage: string;
    allowSuspended?: boolean;
    membershipRelations?: FindOptionsRelations<Membership>;
  },
): Promise<{ organisation: Organisation; membership: Membership }> {
  const publicId = Number(request.params.id);

  if (!Number.isInteger(publicId)) {
    throw new NotFoundException('Organisation not found.');
  }

  const organisation = await repositories.organisations.findOne({
    where: { publicId },
  });

  if (!organisation) {
    throw new NotFoundException('Organisation not found.');
  }

  request.organisationId = organisation.id;

  assertOrganisationNotSuspended(organisation, options.allowSuspended);

  const membership = await repositories.memberships.findOne({
    where: {
      userId: request.userId,
      organisationId: organisation.id,
      status: MembershipStatus.ACTIVE,
    },
    ...(options.membershipRelations && {
      relations: options.membershipRelations,
    }),
  });

  if (!membership) {
    throw new ForbiddenException(options.noMembershipMessage);
  }

  return { organisation, membership };
}
