import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import {
  ReportScheduleSettings,
  SavedReport,
  SavedReportSettings,
} from '../../database/entities/saved-report.entity';
import { UpsertSavedReportDto } from '../dto/upsert-saved-report.dto';

export interface SavedReportView {
  id: string;
  name: string;
  reportType: string;
  settings: SavedReportSettings;
  schedule: ReportScheduleSettings | null;
  modifiedAt: string;
  lastSentAt: string | null;
  lastError: string | null;
}

function toView(report: SavedReport): SavedReportView {
  return {
    id: report.id,
    name: report.name,
    reportType: report.reportType,
    settings: report.settings,
    schedule: report.schedule,
    modifiedAt: report.updatedAt.toISOString(),
    lastSentAt: report.lastSentAt?.toISOString() ?? null,
    lastError: report.lastError,
  };
}

/** Saved reports are private to the member who saved them, and every query is scoped to that member within the organisation. */
@Injectable()
export class SavedReportsService {
  constructor(
    @InjectRepository(SavedReport)
    private readonly savedReports: Repository<SavedReport>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    organisationId: string,
    userId: string,
  ): Promise<SavedReportView[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const reports = await this.savedReports.find({
      where: { organisationId, membershipId: membership.id },
      order: { updatedAt: 'DESC' },
    });
    return reports.map(toView);
  }

  async create(
    organisationId: string,
    userId: string,
    dto: UpsertSavedReportDto,
  ): Promise<SavedReportView> {
    const membership = await this.getActiveMembership(organisationId, userId);
    let saved!: SavedReport;

    await this.dataSource.transaction(async (manager) => {
      saved = await manager.save(
        SavedReport,
        manager.create(SavedReport, {
          organisationId,
          membershipId: membership.id,
          name: dto.name.trim(),
          ...(dto.reportType && { reportType: dto.reportType }),
          settings: dto.settings,
          schedule: dto.schedule ?? null,
        }),
      );
      await this.auditLogService.record(manager, {
        action: 'saved_report.created',
        organisationId,
        actorUserId: userId,
        metadata: { savedReportId: saved.id, scheduled: !!dto.schedule },
      });
    });

    return toView(saved);
  }

  async update(
    organisationId: string,
    userId: string,
    savedReportId: string,
    dto: UpsertSavedReportDto,
  ): Promise<SavedReportView> {
    const report = await this.getOwned(organisationId, userId, savedReportId);
    const scheduleChanged =
      JSON.stringify(report.schedule) !== JSON.stringify(dto.schedule ?? null);

    report.name = dto.name.trim();
    report.settings = dto.settings;
    report.schedule = dto.schedule ?? null;
    // A changed schedule starts a clean slate for the status column; the
    // last-sent day is kept so editing doesn't re-send what already went out.
    if (scheduleChanged) report.lastError = null;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(SavedReport, report);
      await this.auditLogService.record(manager, {
        action: 'saved_report.updated',
        organisationId,
        actorUserId: userId,
        metadata: {
          savedReportId,
          scheduled: !!report.schedule,
          scheduleChanged,
        },
      });
    });

    return toView(report);
  }

  async remove(
    organisationId: string,
    userId: string,
    savedReportId: string,
  ): Promise<void> {
    const report = await this.getOwned(organisationId, userId, savedReportId);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SavedReport, {
        id: report.id,
        organisationId,
        membershipId: report.membershipId,
      });
      await this.auditLogService.record(manager, {
        action: 'saved_report.deleted',
        organisationId,
        actorUserId: userId,
        metadata: { savedReportId },
      });
    });
  }

  private async getOwned(
    organisationId: string,
    userId: string,
    savedReportId: string,
  ): Promise<SavedReport> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const report = await this.savedReports.findOne({
      where: {
        id: savedReportId,
        organisationId,
        membershipId: membership.id,
      },
    });
    // Someone else's report reads as missing, not forbidden, so ids can't be probed.
    if (!report) throw new NotFoundException('Saved report not found.');
    return report;
  }

  private async getActiveMembership(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }
    return membership;
  }
}
