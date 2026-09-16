import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import type { CaptureSettings } from '../../organisations/capture-settings';
import { ConsentDecision } from '../../database/entities/consent-decision.enum';
import { ConsentRecord } from '../../database/entities/consent-record.entity';
import { DisclosureVersion } from '../../database/entities/disclosure-version.entity';
import { DisclosureVersionStatus } from '../../database/entities/disclosure-version-status.enum';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { OrganisationsService } from '../../organisations/services/organisations.service';

/** Postgres' SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as unknown as { code?: string }).code === UNIQUE_VIOLATION
  );
}

export interface DisclosureVersionSummary {
  id: string;
  disclosureRegion: string | null;
  version: number;
  publishedAt: Date;
  publishedByMembershipId: string | null;
}

export interface ConsentStatus {
  /** Whether the desktop agent should show its passive disclosure notice — informational only, never gates capture (see docs/adr/0015-...). */
  required: boolean;
  disclosureVersionId: string | null;
  text: string | null;
}

/** Treats "" the same as "not specified" — a region is either a real jurisdiction code or absent, never an empty string on either side of a comparison. */
function normalizeRegion(region: string | null | undefined): string | null {
  return region ? region : null;
}

@Injectable()
export class DisclosureService {
  constructor(
    @InjectRepository(DisclosureVersion)
    private readonly disclosureVersions: Repository<DisclosureVersion>,
    @InjectRepository(ConsentRecord)
    private readonly consentRecords: Repository<ConsentRecord>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  async resolveActiveMembership(
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

  async getOrCreateDraft(
    organisationId: string,
    disclosureRegion: string | null | undefined,
  ): Promise<DisclosureVersion> {
    const region = normalizeRegion(disclosureRegion);
    const existing = await this.disclosureVersions.findOne({
      where: {
        organisationId,
        disclosureRegion: region ?? IsNull(),
        status: DisclosureVersionStatus.DRAFT,
      },
    });
    if (existing) return existing;

    try {
      return await this.disclosureVersions.save(
        this.disclosureVersions.create({
          organisationId,
          disclosureRegion: region,
          text: '',
          status: DisclosureVersionStatus.DRAFT,
          version: null,
          publishedAt: null,
          publishedByMembershipId: null,
        }),
      );
    } catch (error) {
      // Two concurrent first-time draft requests can both see `existing` as
      // null and race to insert — UQ_disclosure_versions_draft lets only
      // one through. Rather than surface that as a 500, fetch and return
      // whichever row actually won.
      if (isUniqueViolation(error)) {
        const winner = await this.disclosureVersions.findOne({
          where: {
            organisationId,
            disclosureRegion: region ?? IsNull(),
            status: DisclosureVersionStatus.DRAFT,
          },
        });
        if (winner) return winner;
      }
      throw error;
    }
  }

  async updateDraft(
    organisationId: string,
    disclosureRegion: string | null | undefined,
    text: string,
  ): Promise<DisclosureVersion> {
    const draft = await this.getOrCreateDraft(organisationId, disclosureRegion);
    draft.text = text;
    return this.disclosureVersions.save(draft);
  }

  /**
   * Snapshots the current draft's text into a new, immutable published row
   * with the next version number for this `(organisationId,
   * disclosureRegion)` pair. Every affected Device re-consents the next
   * time its poll notices a newer published version exists (see
   * docs/adr/0014-...) — this method itself doesn't push anything to any
   * Device, it just makes `resolveCurrentVersion` start returning the new
   * row.
   */
  async publish(
    organisationId: string,
    disclosureRegion: string | null | undefined,
    actorMembershipId: string,
    actorUserId: string,
  ): Promise<DisclosureVersion> {
    const region = normalizeRegion(disclosureRegion);
    const draft = await this.getOrCreateDraft(organisationId, region);

    if (draft.text.trim().length === 0) {
      throw new BadRequestException(
        'Write the disclosure text before publishing.',
      );
    }

    const { maxVersion } = (await this.disclosureVersions
      .createQueryBuilder('dv')
      .select('MAX(dv.version)', 'maxVersion')
      .where('dv.organisationId = :organisationId', { organisationId })
      .andWhere('dv.disclosureRegion IS NOT DISTINCT FROM :region', {
        region,
      })
      .andWhere('dv.status = :status', {
        status: DisclosureVersionStatus.PUBLISHED,
      })
      .getRawOne<{ maxVersion: number | null }>())!;

    const published = this.disclosureVersions.create({
      organisationId,
      disclosureRegion: region,
      text: draft.text,
      status: DisclosureVersionStatus.PUBLISHED,
      version: (maxVersion ?? 0) + 1,
      publishedAt: new Date(),
      publishedByMembershipId: actorMembershipId,
    });

    try {
      return await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(DisclosureVersion, published);

        await this.auditLogService.record(manager, {
          action: 'disclosure_version.published',
          organisationId,
          actorUserId,
          metadata: {
            disclosureVersionId: saved.id,
            disclosureRegion: region,
            version: saved.version,
          },
        });

        return saved;
      });
    } catch (error) {
      // Two concurrent publishes for the same (organisationId,
      // disclosureRegion) can both read the same maxVersion before either
      // commits — UQ_disclosure_versions_published_version lets only one
      // through. Surface that as a clean conflict rather than an
      // unhandled 500; the caller (an admin re-clicking Publish) can retry.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Another publish for this disclosure text just completed — please retry.',
        );
      }
      throw error;
    }
  }

  async listPublished(
    organisationId: string,
    disclosureRegion: string | null | undefined,
  ): Promise<DisclosureVersionSummary[]> {
    const region = normalizeRegion(disclosureRegion);
    const rows = await this.disclosureVersions.find({
      where: {
        organisationId,
        disclosureRegion: region ?? IsNull(),
        status: DisclosureVersionStatus.PUBLISHED,
      },
      order: { version: 'DESC' },
    });

    return rows.map((row) => ({
      id: row.id,
      disclosureRegion: row.disclosureRegion,
      version: row.version!,
      publishedAt: row.publishedAt!,
      publishedByMembershipId: row.publishedByMembershipId,
    }));
  }

  /**
   * The newest published version matching `disclosureRegion` exactly,
   * falling back to the org's newest region-less published version if none
   * matches — see CONTEXT.md's DisclosureVersion entry.
   */
  async resolveCurrentVersion(
    organisationId: string,
    disclosureRegion: string | null | undefined,
  ): Promise<DisclosureVersion | null> {
    const region = normalizeRegion(disclosureRegion);

    if (region !== null) {
      const regional = await this.disclosureVersions.findOne({
        where: {
          organisationId,
          disclosureRegion: region,
          status: DisclosureVersionStatus.PUBLISHED,
        },
        order: { version: 'DESC' },
      });
      if (regional) return regional;
    }

    return this.disclosureVersions.findOne({
      where: {
        organisationId,
        disclosureRegion: IsNull(),
        status: DisclosureVersionStatus.PUBLISHED,
      },
      order: { version: 'DESC' },
    });
  }

  private async latestDecision(
    organisationId: string,
    deviceId: string,
    disclosureVersionId: string,
  ): Promise<ConsentDecision | null> {
    // Scoped by organisationId even though deviceId/disclosureVersionId are
    // already produced from org-scoped lookups at every current call site —
    // backend/CLAUDE.md requires every query touching organisation-owned
    // data to be scoped explicitly, as defense-in-depth against a future
    // caller passing an id from a less-carefully-scoped source.
    const latest = await this.consentRecords.findOne({
      where: { organisationId, deviceId, disclosureVersionId },
      order: { createdAt: 'DESC' },
    });
    return latest?.decision ?? null;
  }

  /**
   * Used by the desktop agent to decide whether to show the passive
   * disclosure notice — this also checks whether the org has any capture
   * setting enabled at all. An org with nothing enabled never needs to show
   * a notice (see docs/adr/0015-...), even if disclosure text happens to
   * exist for historical reasons. Purely informational: whatever this
   * returns, capture is never blocked on it.
   */
  async getConsentStatus(
    organisationId: string,
    disclosureRegion: string | null | undefined,
    deviceId: string,
    /**
     * Pass this when the caller already fetched CaptureSettings for the
     * same request (e.g. DeviceTrackingController.captureSettings) to
     * avoid re-querying the organisation a second time in one request.
     */
    knownCaptureSettings?: CaptureSettings,
  ): Promise<ConsentStatus> {
    const captureSettings =
      knownCaptureSettings ??
      (await this.organisationsService.getCaptureSettings(organisationId));
    const anyCaptureEnabled =
      captureSettings.windowTrackingEnabled ||
      captureSettings.screenshotsEnabled ||
      captureSettings.activityTrackingEnabled;

    const version = await this.resolveCurrentVersion(
      organisationId,
      disclosureRegion,
    );

    if (!anyCaptureEnabled || !version) {
      return {
        required: false,
        disclosureVersionId: version?.id ?? null,
        text: version?.text ?? null,
      };
    }

    const decision = await this.latestDecision(
      organisationId,
      deviceId,
      version.id,
    );

    return {
      required: decision !== ConsentDecision.GRANTED,
      disclosureVersionId: version.id,
      text: version.text,
    };
  }

  async recordConsent(
    organisationId: string,
    membershipId: string,
    deviceId: string,
    disclosureRegion: string | null | undefined,
    disclosureVersionId: string,
    decision: ConsentDecision,
    actorUserId: string,
  ): Promise<void> {
    const version = await this.disclosureVersions.findOne({
      where: {
        id: disclosureVersionId,
        organisationId,
        status: DisclosureVersionStatus.PUBLISHED,
      },
    });
    if (!version) {
      throw new NotFoundException('Disclosure version not found.');
    }

    // Beyond "is this a real published version of this org", it must also
    // be the version currently resolved for this membership's region — the
    // exact one `GET /device/disclosure` would have shown them. Without
    // this, a device could record acknowledgment against a stale or
    // wrong-region version, producing a ConsentRecord/audit trail that
    // doesn't reflect what the person actually saw.
    const currentVersion = await this.resolveCurrentVersion(
      organisationId,
      disclosureRegion,
    );
    if (currentVersion?.id !== version.id) {
      throw new BadRequestException(
        'This is not the current disclosure text for your region — refresh and try again.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        ConsentRecord,
        manager.create(ConsentRecord, {
          organisationId,
          membershipId,
          deviceId,
          disclosureVersionId: version.id,
          decision,
        }),
      );

      await this.auditLogService.record(manager, {
        action:
          decision === ConsentDecision.GRANTED
            ? 'device_consent.granted'
            : 'device_consent.declined',
        organisationId,
        actorUserId,
        metadata: { deviceId, disclosureVersionId: version.id },
      });
    });
  }
}
