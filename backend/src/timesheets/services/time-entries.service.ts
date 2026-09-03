import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { canViewMembership } from '../../common/membership-visibility.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { CreateTimeEntryDto } from '../dto/create-time-entry.dto';

export interface TimeEntrySummary {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  note: string | null;
  createdAt: Date;
}

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Authorization is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an active
   * member of this Organisation. Manual entry only — no automatic capture.
   */
  async create(
    organisationId: string,
    userId: string,
    dto: CreateTimeEntryDto,
  ): Promise<TimeEntrySummary> {
    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);

    if (endedAt <= startedAt) {
      throw new BadRequestException('End time must be after the start time.');
    }

    let entry!: TimeEntry;

    await this.dataSource.transaction(async (manager) => {
      entry = manager.create(TimeEntry, {
        organisationId,
        userId,
        startedAt,
        endedAt,
        note: dto.note ?? null,
      });
      await manager.save(TimeEntry, entry);

      await this.auditLogService.record(manager, {
        action: 'time_entry.created',
        organisationId,
        actorUserId: userId,
        metadata: { timeEntryId: entry.id },
      });
    });

    return this.toSummary(entry);
  }

  async listMine(
    organisationId: string,
    userId: string,
  ): Promise<TimeEntrySummary[]> {
    const entries = await this.timeEntries.find({
      where: { organisationId, userId },
      order: { startedAt: 'DESC' },
    });

    return entries.map((entry) => this.toSummary(entry));
  }

  /**
   * Same visibility rule as Activity: the member themselves, an admin
   * (anyone), or a manager for their own team — peers never see each
   * other's entries. See canViewMembership.
   */
  async listForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
  ): Promise<TimeEntrySummary[]> {
    const [caller, target] = await Promise.all([
      this.memberships.findOne({
        where: {
          userId: callerUserId,
          organisationId,
          status: MembershipStatus.ACTIVE,
        },
        relations: { teamMemberships: true },
      }),
      this.memberships.findOne({
        where: { id: targetMembershipId, organisationId },
        relations: { teamMemberships: true },
      }),
    ]);

    if (!caller || !target) {
      throw new NotFoundException('Membership not found.');
    }

    if (!canViewMembership(caller, target)) {
      throw new ForbiddenException("You cannot view this member's timesheet.");
    }

    const entries = await this.timeEntries.find({
      where: { organisationId, userId: target.userId },
      order: { startedAt: 'DESC' },
    });

    return entries.map((entry) => this.toSummary(entry));
  }

  private toSummary(entry: TimeEntry): TimeEntrySummary {
    const durationMinutes = Math.round(
      (entry.endedAt.getTime() - entry.startedAt.getTime()) / 60000,
    );

    return {
      id: entry.id,
      userId: entry.userId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationMinutes,
      note: entry.note,
      createdAt: entry.createdAt,
    };
  }
}
