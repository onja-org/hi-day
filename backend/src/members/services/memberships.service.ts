import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { UpdateMembershipDto } from '../dto/update-membership.dto';

export interface ActiveMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  teamId: string | null;
  status: MembershipStatus;
  joinedAt: Date;
}

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listActiveForOrganisation(
    organisationId: string,
  ): Promise<ActiveMemberSummary[]> {
    const memberships = await this.memberships.find({
      where: { organisationId, status: MembershipStatus.ACTIVE },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      teamId: membership.teamId,
      status: membership.status,
      joinedAt: membership.createdAt,
    }));
  }

  /**
   * Authorization is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an
   * admin/manager of this Organisation.
   */
  async update(
    organisationId: string,
    membershipId: string,
    actorUserId: string,
    dto: UpdateMembershipDto,
  ): Promise<ActiveMemberSummary> {
    const membership = await this.memberships.findOne({
      where: { id: membershipId, organisationId },
      relations: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }

    if (dto.role !== undefined) {
      membership.role = dto.role;
    }

    if (dto.deactivate) {
      membership.status = MembershipStatus.DEACTIVATED;
      membership.deactivatedAt = new Date();
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Membership, membership);

      await this.auditLogService.record(manager, {
        action: 'membership.updated',
        organisationId,
        actorUserId,
        metadata: {
          membershipId,
          role: dto.role,
          deactivated: dto.deactivate ?? false,
        },
      });
    });

    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      teamId: membership.teamId,
      status: membership.status,
      joinedAt: membership.createdAt,
    };
  }
}
