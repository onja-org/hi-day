import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { EmailService } from '../../email/services/email.service';
import { ScreenshotStorageService } from '../../screenshots/services/screenshot-storage.service';

/**
 * Tables that carry an `organisationId` column and are wiped by the purge.
 * `audit_logs` is deliberately absent: its rows outlive the organisation
 * (see `purgeAuditLogs`). A spec asserts every other entity with an
 * `organisationId` is listed here, so adding a new org-owned entity without
 * teaching the purge about it fails CI instead of silently leaving data
 * behind.
 */
export const PURGED_TABLES_BY_ORGANISATION_ID = [
  'consent_records',
  'screenshots',
  'url_sessions',
  'app_events',
  'time_entry_pauses',
  'time_entries',
  'notes',
  'saved_reports',
  'activities',
  'invitations',
  'invite_links',
  'disclosure_versions',
  'device_sessions',
  'devices',
  'projects',
  'teams',
  'memberships',
  'organisation_deletion_requests',
] as const;

/** Tables referencing a device that another organisation may still use. */
const DEVICE_REFERENCING_TABLES = [
  'screenshots',
  'url_sessions',
  'app_events',
  'consent_records',
  'time_entries',
];

/** Audit actions kept after the purge, with the org link nulled. */
const RETAINED_AUDIT_ACTIONS = [
  'organisation.deletion_requested',
  'organisation.deletion_scheduled',
  'organisation.deletion_cancelled',
  'organisation.suspended',
  'organisation.purged',
];

@Injectable()
export class OrganisationPurgeService {
  private readonly logger = new Logger(OrganisationPurgeService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly storage: ScreenshotStorageService,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Irreversibly erases an organisation once its recovery window has closed.
   *
   * Order matters. Screenshot objects go first: after `purgeAt` there is no
   * restore to protect, and object deletion is idempotent, so a crash between
   * the two steps just retries next run instead of orphaning objects whose DB
   * rows (the only record of their keys) are already gone. The database work
   * then runs in a single transaction — it either erases everything or
   * nothing — and verifies inside that transaction that no org-scoped row
   * survives before committing.
   */
  async purge(organisation: Organisation): Promise<void> {
    const organisationId = organisation.id;
    const prefix = `screenshots/${organisationId}/`;

    const members = await this.memberships.find({
      where: { organisationId },
      relations: { user: true },
    });
    const userIds = members.map((member) => member.userId);
    const activeMembers = members.filter(
      (member) => member.status === MembershipStatus.ACTIVE,
    );
    // Captured now: the User rows are erased below, and with them the only
    // record of where to send these.
    const adminEmails = new Set(
      activeMembers
        .filter((member) => member.role === MembershipRole.ADMIN)
        .map((member) => member.user.email),
    );
    const memberEmails = new Set(
      activeMembers
        .map((member) => member.user.email)
        .filter((email) => !adminEmails.has(email)),
    );

    await this.storage.deleteByPrefix(prefix);

    await this.dataSource.transaction(async (manager) => {
      await this.deleteOrganisationData(manager, organisationId);
      await this.purgeAuditLogs(manager, organisationId);
      await manager.query(`DELETE FROM "organisations" WHERE "id" = $1`, [
        organisationId,
      ]);
      await this.deleteOrphanedUsers(manager, userIds);
      await this.assertNothingRemains(manager, organisationId);
      await this.auditLogService.record(manager, {
        action: 'organisation.purged',
        organisationId: null,
        metadata: {
          organisationPublicId: organisation.publicId,
          organisationName: organisation.name,
          purgedAt: new Date().toISOString(),
        },
      });
    });

    // Anything uploaded while the purge was running (a presigned URL still
    // inside its TTL) would otherwise be missed.
    await this.storage.deleteByPrefix(prefix);
    if (await this.storage.hasObjectsWithPrefix(prefix)) {
      throw new Error(
        `Objects still exist under ${prefix} after purge of organisation ${organisation.publicId}`,
      );
    }

    this.logger.log(`Purged organisation ${organisation.publicId}`);

    await Promise.all([
      ...[...adminEmails].map((to) =>
        this.emailService.sendOrganisationDeletionNotice(
          to,
          organisation.name,
          `${organisation.name} and all of its data have been permanently deleted.`,
        ),
      ),
      // Once a purge erases someone's account the app can only drop them at
      // the login page, and can't say why without revealing whether an
      // account exists — so this email is where they learn the cause.
      ...[...memberEmails].map((to) =>
        this.emailService.sendOrganisationDeletionNotice(
          to,
          organisation.name,
          `${organisation.name} was deleted by its owner, so you can no longer sign in to it. Your data in that workspace has been permanently removed. If you belong to other workspaces, they are not affected.`,
        ),
      ),
    ]);
  }

  private async deleteOrganisationData(
    manager: EntityManager,
    organisationId: string,
  ): Promise<void> {
    const byOrg = (table: string) =>
      manager.query(`DELETE FROM "${table}" WHERE "organisationId" = $1`, [
        organisationId,
      ]);
    const projects = `SELECT "id" FROM "projects" WHERE "organisationId" = $1`;
    const teams = `SELECT "id" FROM "teams" WHERE "organisationId" = $1`;

    await byOrg('consent_records');
    await byOrg('screenshots');
    await byOrg('url_sessions');
    await byOrg('app_events');
    await byOrg('time_entry_pauses');
    await byOrg('time_entries');
    await byOrg('notes');
    await byOrg('saved_reports');
    await byOrg('activities');
    await byOrg('invitations');
    await byOrg('invite_links');
    await byOrg('disclosure_versions');
    await manager.query(
      `DELETE FROM "tasks" WHERE "projectId" IN (${projects})`,
      [organisationId],
    );
    await manager.query(
      `DELETE FROM "project_teams" WHERE "projectId" IN (${projects})`,
      [organisationId],
    );
    await manager.query(
      `DELETE FROM "project_memberships" WHERE "projectId" IN (${projects})`,
      [organisationId],
    );
    await manager.query(
      `DELETE FROM "team_memberships" WHERE "teamId" IN (${teams})`,
      [organisationId],
    );
    await manager.query(
      `DELETE FROM "device_pairing_requests" WHERE "approvedOrganisationId" = $1`,
      [organisationId],
    );
    await byOrg('device_sessions');
    // A shared machine's device row can still be referenced by another
    // organisation's captures; leave those rows for that organisation.
    const stillReferenced = DEVICE_REFERENCING_TABLES.map(
      (table) =>
        `NOT EXISTS (SELECT 1 FROM "${table}" t WHERE t."deviceId" = "devices"."id")`,
    ).join(' AND ');
    await manager.query(
      `DELETE FROM "devices" WHERE "organisationId" = $1 AND ${stillReferenced}`,
      [organisationId],
    );
    await byOrg('projects');
    await byOrg('teams');
    await byOrg('memberships');
    await byOrg('organisation_deletion_requests');
    await this.rehomeSharedDevices(manager, 'd."organisationId" = $1', [
      organisationId,
    ]);
  }

  /**
   * A shared machine's Device row records whoever logged in *last*, but
   * other organisations' captures can still reference it. Such a device
   * can't be deleted, so before the org (or an erased user) it points at
   * goes, hand it to the organisation and user behind a capture that
   * survives. Runs after this organisation's own captures and memberships
   * are gone, so every remaining reference belongs to someone else.
   */
  private async rehomeSharedDevices(
    manager: EntityManager,
    devicePredicate: string,
    params: unknown[],
  ): Promise<void> {
    const references = DEVICE_REFERENCING_TABLES.map(
      (table) => `SELECT "deviceId", "membershipId" FROM "${table}"`,
    ).join(' UNION ALL ');
    await manager.query(
      `UPDATE "devices" d SET "organisationId" = x."organisationId", "userId" = x."userId"
       FROM (
         SELECT DISTINCT ON (r."deviceId") r."deviceId", m."organisationId", m."userId"
         FROM (${references}) r JOIN "memberships" m ON m."id" = r."membershipId"
       ) x
       WHERE d."id" = x."deviceId" AND ${devicePredicate}`,
      params,
    );
  }

  /**
   * Every audit row about the organisation goes, except the deletion
   * lifecycle records — those are the proof the erasure happened, and carry
   * no personal content (ids, mode, dates). They lose their org link when the
   * organisation row is deleted (FK is SET NULL).
   */
  private async purgeAuditLogs(
    manager: EntityManager,
    organisationId: string,
  ): Promise<void> {
    await manager.query(
      `DELETE FROM "audit_logs" WHERE "organisationId" = $1 AND NOT ("action" = ANY($2))`,
      [organisationId, RETAINED_AUDIT_ACTIONS],
    );
  }

  /**
   * Erases Users who belonged only to this organisation (right to erasure).
   * Users who also belong to another organisation keep their account.
   */
  private async deleteOrphanedUsers(
    manager: EntityManager,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;
    const orphaned = `SELECT u."id" FROM "users" u WHERE u."id" = ANY($1) AND NOT EXISTS (SELECT 1 FROM "memberships" m WHERE m."userId" = u."id")`;
    await this.rehomeSharedDevices(manager, `d."userId" IN (${orphaned})`, [
      userIds,
    ]);
    await manager.query(
      `DELETE FROM "device_sessions" WHERE "userId" IN (${orphaned})`,
      [userIds],
    );
    await manager.query(
      `DELETE FROM "devices" WHERE "userId" IN (${orphaned})`,
      [userIds],
    );
    await manager.query(
      `DELETE FROM "activities" WHERE "userId" IN (${orphaned})`,
      [userIds],
    );
    await manager.query(`DELETE FROM "users" WHERE "id" IN (${orphaned})`, [
      userIds,
    ]);
  }

  /** Throws (rolling the transaction back) if any org-scoped row survived. */
  private async assertNothingRemains(
    manager: EntityManager,
    organisationId: string,
  ): Promise<void> {
    for (const table of PURGED_TABLES_BY_ORGANISATION_ID) {
      const rows: { count: number }[] = await manager.query(
        `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "organisationId" = $1`,
        [organisationId],
      );
      const count = rows[0]?.count ?? 0;
      if (count > 0) {
        throw new Error(
          `Purge incomplete: ${count} row(s) remain in ${table} for organisation ${organisationId}`,
        );
      }
    }
  }
}
