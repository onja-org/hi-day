import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { TimesheetReason } from '../../database/entities/timesheet-reason.entity';
import { UpsertTimesheetReasonDto } from '../dto/upsert-timesheet-reason.dto';
import { MAX_TIMESHEET_REASONS } from '../timesheet-settings';

export interface TimesheetReasonSummary {
  id: string;
  label: string;
}

/**
 * The Organisation's Reasons list — the labels offered when someone adds,
 * edits or deletes time. Reading is open to every active Membership (the
 * pickers need it); changing the list is admin-only, enforced on the routes.
 *
 * Nothing references a Reason: the picked label is copied onto the audit row
 * (ADR-0024), so deleting one is a plain row delete with no history to
 * repair.
 */
@Injectable()
export class TimesheetReasonsService {
  constructor(
    @InjectRepository(TimesheetReason)
    private readonly reasons: Repository<TimesheetReason>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Oldest first, so the seeded defaults stay at the top of the picker. */
  async list(organisationId: string): Promise<TimesheetReasonSummary[]> {
    const rows = await this.reasons.find({
      where: { organisationId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({ id: row.id, label: row.label }));
  }

  async create(
    organisationId: string,
    actorUserId: string,
    dto: UpsertTimesheetReasonDto,
  ): Promise<TimesheetReasonSummary> {
    const count = await this.reasons.countBy({ organisationId });
    if (count >= MAX_TIMESHEET_REASONS) {
      throw new BadRequestException(
        `An organisation can have at most ${MAX_TIMESHEET_REASONS} reasons`,
      );
    }
    await this.assertLabelIsFree(organisationId, dto.label);

    const saved = await this.reasons.save(
      this.reasons.create({ organisationId, label: dto.label }),
    );

    await this.dataSource.transaction((manager) =>
      this.auditLogService.record(manager, {
        action: 'timesheet_reason.created',
        organisationId,
        actorUserId,
        metadata: { timesheetReasonId: saved.id, label: saved.label },
      }),
    );

    return { id: saved.id, label: saved.label };
  }

  async rename(
    organisationId: string,
    actorUserId: string,
    reasonId: string,
    dto: UpsertTimesheetReasonDto,
  ): Promise<TimesheetReasonSummary> {
    const reason = await this.findOwned(organisationId, reasonId);
    if (reason.label === dto.label) {
      return { id: reason.id, label: reason.label };
    }
    await this.assertLabelIsFree(organisationId, dto.label, reasonId);

    const previousLabel = reason.label;
    reason.label = dto.label;
    const saved = await this.reasons.save(reason);

    await this.dataSource.transaction((manager) =>
      this.auditLogService.record(manager, {
        action: 'timesheet_reason.renamed',
        organisationId,
        actorUserId,
        // History already holds the old wording verbatim, so the rename has
        // to say what it was to stay traceable.
        metadata: {
          timesheetReasonId: saved.id,
          from: previousLabel,
          to: saved.label,
        },
      }),
    );

    return { id: saved.id, label: saved.label };
  }

  async remove(
    organisationId: string,
    actorUserId: string,
    reasonId: string,
  ): Promise<void> {
    const reason = await this.findOwned(organisationId, reasonId);
    await this.reasons.remove(reason);

    await this.dataSource.transaction((manager) =>
      this.auditLogService.record(manager, {
        action: 'timesheet_reason.deleted',
        organisationId,
        actorUserId,
        metadata: { timesheetReasonId: reasonId, label: reason.label },
      }),
    );
  }

  private async findOwned(
    organisationId: string,
    reasonId: string,
  ): Promise<TimesheetReason> {
    const reason = await this.reasons.findOneBy({
      id: reasonId,
      organisationId,
    });
    if (!reason) {
      throw new NotFoundException('Reason not found');
    }
    return reason;
  }

  /**
   * The database's unique index is on `LOWER("label")`, so this check has to
   * be case-insensitive too — otherwise a duplicate reaches the insert and
   * surfaces as a 500 rather than a message the admin can act on.
   */
  private async assertLabelIsFree(
    organisationId: string,
    label: string,
    exceptId?: string,
  ): Promise<void> {
    const query = this.reasons
      .createQueryBuilder('reason')
      .where('reason.organisationId = :organisationId', { organisationId })
      .andWhere('LOWER(reason.label) = LOWER(:label)', { label });

    if (exceptId) {
      query.andWhere('reason.id != :exceptId', { exceptId });
    }

    if ((await query.getCount()) > 0) {
      throw new BadRequestException('That reason already exists');
    }
  }
}
