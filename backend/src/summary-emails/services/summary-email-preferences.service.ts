import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { actsAsManager } from '../../common/manager-scope.util';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Membership } from '../../database/entities/membership.entity';
import {
  parseSummaryKind,
  resolveSummaryFrequency,
  frequencyIncludes,
  SUMMARY_EMAIL_KINDS,
  type SummaryEmailKind,
  type SummaryFrequency,
} from '../../organisations/summary-emails';
import { verifyUnsubscribeToken } from '../unsubscribe-token.util';

export interface SummaryEmailPreference {
  kind: SummaryEmailKind;
  /** Whether an admin's settings send it to this person at all. When
   * false, the person can't switch it on themselves. */
  available: boolean;
  /** Whether it actually reaches them: available, and not switched off. */
  enabled: boolean;
}

interface Settings {
  personalSummaryEmails?: SummaryFrequency;
  teamSummaryEmails?: SummaryFrequency;
}

/**
 * Each person's own say over their summary emails. They can switch off
 * anything their admin's settings send them, and switch it back on — but
 * never turn on what an admin left off.
 */
@Injectable()
export class SummaryEmailPreferencesService {
  private readonly secret: string;

  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    configService: ConfigService,
  ) {
    this.secret = configService.getOrThrow<string>('JWT_SECRET');
  }

  async getOwn(
    organisationId: string,
    userId: string,
  ): Promise<SummaryEmailPreference[]> {
    return this.preferencesOf(await this.ownMembership(organisationId, userId));
  }

  async setOwn(
    organisationId: string,
    userId: string,
    kind: SummaryEmailKind,
    enabled: boolean,
  ): Promise<SummaryEmailPreference[]> {
    const membership = await this.ownMembership(organisationId, userId);
    const preference = this.preferencesOf(membership).find(
      (item) => item.kind === kind,
    );
    if (!preference) {
      throw new ForbiddenException('This summary email is not sent to you.');
    }
    if (enabled && !preference.available) {
      throw new BadRequestException(
        'Your organisation has this summary email turned off for you.',
      );
    }
    await this.saveOptOut(membership, kind, !enabled, userId);
    return this.preferencesOf(membership);
  }

  /**
   * The "Turn off this email" link. Works without signing in — the signed
   * token is the proof — and only ever switches off the one email it was
   * made for. Repeating it is harmless.
   */
  async unsubscribe(
    token: string,
  ): Promise<{ kind: SummaryEmailKind; organisationName: string }> {
    const target = verifyUnsubscribeToken(token, this.secret);
    if (!target) {
      throw new BadRequestException('This link is not valid.');
    }
    const membership = await this.memberships.findOne({
      where: { id: target.membershipId },
      relations: { organisation: true },
    });
    if (!membership) {
      throw new BadRequestException('This link no longer works.');
    }
    await this.saveOptOut(membership, target.kind, true, membership.userId);
    return {
      kind: target.kind,
      organisationName: membership.organisation.name,
    };
  }

  private async ownMembership(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { organisationId, userId, status: MembershipStatus.ACTIVE },
      relations: { organisation: true, teamMemberships: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organisation.',
      );
    }
    return membership;
  }

  /** Only the emails this person could ever get: nothing for finance, and
   * team summaries only for admins and team managers. */
  private preferencesOf(membership: Membership): SummaryEmailPreference[] {
    if (membership.role === MembershipRole.FINANCE) return [];
    const oversees =
      membership.role === MembershipRole.ADMIN || actsAsManager(membership);
    const settings = (membership.organisation.settings ?? {}) as Settings;
    const optOuts = membership.summaryEmailOptOuts ?? [];

    return SUMMARY_EMAIL_KINDS.filter(
      (kind) => oversees || parseSummaryKind(kind).audience === 'personal',
    ).map((kind) => {
      const { audience, period } = parseSummaryKind(kind);
      const available = frequencyIncludes(
        resolveSummaryFrequency(
          audience === 'personal'
            ? settings.personalSummaryEmails
            : settings.teamSummaryEmails,
          audience === 'personal'
            ? membership.personalSummaryEmails
            : membership.teamSummaryEmails,
        ),
        period,
      );
      return { kind, available, enabled: available && !optOuts.includes(kind) };
    });
  }

  private async saveOptOut(
    membership: Membership,
    kind: SummaryEmailKind,
    optOut: boolean,
    actorUserId: string,
  ): Promise<void> {
    const current = membership.summaryEmailOptOuts ?? [];
    const next = optOut
      ? [...new Set([...current, kind])]
      : current.filter((item) => item !== kind);
    if (next.length === current.length) return;

    membership.summaryEmailOptOuts = next;
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Membership,
        { id: membership.id },
        { summaryEmailOptOuts: next },
      );
      await this.auditLogService.record(manager, {
        action: optOut ? 'summary_email.turned_off' : 'summary_email.turned_on',
        organisationId: membership.organisationId,
        actorUserId,
        metadata: { membershipId: membership.id, kind },
      });
    });
  }
}
