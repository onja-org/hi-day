import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { canViewMembership } from '../../common/membership-visibility.util';
import { Activity } from '../../database/entities/activity.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { CreateActivityDto } from '../dto/create-activity.dto';

export interface ActivityEntry {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activities: Repository<Activity>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Authorization is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an active
   * member of this Organisation.
   */
  async create(
    organisationId: string,
    userId: string,
    dto: CreateActivityDto,
  ): Promise<ActivityEntry> {
    let activity!: Activity;

    await this.dataSource.transaction(async (manager) => {
      activity = manager.create(Activity, {
        organisationId,
        userId,
        content: dto.content,
      });
      await manager.save(Activity, activity);

      await this.auditLogService.record(manager, {
        action: 'activity.created',
        organisationId,
        actorUserId: userId,
        metadata: { activityId: activity.id },
      });
    });

    return this.toEntry(activity);
  }

  async listMine(
    organisationId: string,
    userId: string,
  ): Promise<ActivityEntry[]> {
    const entries = await this.activities.find({
      where: { organisationId, userId },
      order: { createdAt: 'DESC' },
    });

    return entries.map((entry) => this.toEntry(entry));
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or a manager for
   * their own team — peers never see each other's entries. See
   * canViewMembership for the shared rule.
   */
  async listForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
  ): Promise<ActivityEntry[]> {
    const [caller, target] = await Promise.all([
      this.memberships.findOne({
        where: {
          userId: callerUserId,
          organisationId,
          status: MembershipStatus.ACTIVE,
        },
      }),
      this.memberships.findOne({
        where: { id: targetMembershipId, organisationId },
      }),
    ]);

    if (!caller || !target) {
      throw new NotFoundException('Membership not found.');
    }

    if (!canViewMembership(caller, target)) {
      throw new ForbiddenException("You cannot view this member's activity.");
    }

    const entries = await this.activities.find({
      where: { organisationId, userId: target.userId },
      order: { createdAt: 'DESC' },
    });

    return entries.map((entry) => this.toEntry(entry));
  }

  private toEntry(activity: Activity): ActivityEntry {
    return {
      id: activity.id,
      userId: activity.userId,
      content: activity.content,
      createdAt: activity.createdAt,
    };
  }
}
