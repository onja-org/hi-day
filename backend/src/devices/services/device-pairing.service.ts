import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { TokenService } from '../../auth/services/token.service';
import { hashToken } from '../../common/hash-token.util';
import { DevicePairingRequest } from '../../database/entities/device-pairing-request.entity';
import { DevicePlatform } from '../../database/entities/device-platform.enum';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { User } from '../../database/entities/user.entity';
import { StartDevicePairingDto } from '../dto/start-device-pairing.dto';
import { DeviceSessionService } from './device-session.service';

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_NOT_FOUND_MESSAGE =
  'This pairing link is invalid or has expired.';

export interface DevicePairingStarted {
  code: string;
  approvalUrl: string;
  expiresAt: Date;
}

export interface DevicePairingSummary {
  platform: DevicePlatform;
  hostname: string | null;
  requestedAt: Date;
}

export type DevicePairingPollResult =
  | { status: 'pending' }
  | {
      status: 'approved';
      deviceId: string;
      deviceToken: string;
      email: string;
      organisationName: string;
    }
  | { status: 'expired' };

/**
 * Backs the desktop app's "log in via the web app" flow (ADR-0009): the
 * desktop never sees a password, it only ever gets a device token once an
 * already-logged-in person approves its pairing request in the browser.
 */
@Injectable()
export class DevicePairingService {
  constructor(
    @InjectRepository(DevicePairingRequest)
    private readonly pairingRequests: Repository<DevicePairingRequest>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly deviceSessionService: DeviceSessionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async start(dto: StartDevicePairingDto): Promise<DevicePairingStarted> {
    const code = this.tokenService.generateToken();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);

    await this.pairingRequests.save(
      this.pairingRequests.create({
        codeHash: hashToken(code),
        deviceFingerprint: dto.deviceFingerprint,
        platform: dto.platform,
        osVersion: dto.osVersion ?? null,
        hostname: dto.hostname ?? null,
        appVersion: dto.appVersion ?? null,
        expiresAt,
      }),
    );

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const approvalUrl = `${frontendUrl}/link-device?code=${encodeURIComponent(code)}`;

    return { code, approvalUrl, expiresAt };
  }

  async getPendingByCode(code: string): Promise<DevicePairingSummary> {
    const request = await this.findPending(code);
    return {
      platform: request.platform,
      hostname: request.hostname,
      requestedAt: request.createdAt,
    };
  }

  async approve(code: string, userId: string): Promise<void> {
    const request = await this.findPending(code);
    const membership = await this.memberships.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
    });

    if (!membership) {
      throw new NotFoundException(PAIRING_NOT_FOUND_MESSAGE);
    }

    await this.pairingRequests.update(request.id, {
      approvedByUserId: userId,
      approvedOrganisationId: membership.organisationId,
      approvedAt: new Date(),
    });

    await this.auditLogService.record(this.dataSource.manager, {
      action: 'device.pairing_approved',
      organisationId: membership.organisationId,
      actorUserId: userId,
      metadata: {
        deviceFingerprint: request.deviceFingerprint,
        platform: request.platform,
      },
    });
  }

  /**
   * The desktop's poll. An approved request is claimed — turned into the
   * real Device/DeviceSession and stamped `claimedAt` — the first time this
   * sees it approved, atomically, so a raw device token never sits at rest
   * in this table and the code can't be claimed twice.
   */
  async pollStatus(code: string): Promise<DevicePairingPollResult> {
    const request = await this.pairingRequests.findOne({
      where: { codeHash: hashToken(code) },
    });

    if (!request || request.expiresAt < new Date() || request.claimedAt) {
      return { status: 'expired' };
    }

    if (
      !request.approvedAt ||
      !request.approvedByUserId ||
      !request.approvedOrganisationId
    ) {
      return { status: 'pending' };
    }

    const issued = await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOne(DevicePairingRequest, {
        where: { id: request.id },
      });

      if (!fresh || fresh.claimedAt) {
        return null;
      }

      const approver = await manager.findOne(User, {
        where: { id: fresh.approvedByUserId! },
      });
      const organisation = await manager.findOne(Organisation, {
        where: { id: fresh.approvedOrganisationId! },
      });

      if (!approver || !organisation) {
        return null;
      }

      const result = await this.deviceSessionService.upsertOnLogin(manager, {
        userId: fresh.approvedByUserId!,
        organisationId: fresh.approvedOrganisationId!,
        deviceFingerprint: fresh.deviceFingerprint,
        platform: fresh.platform,
        osVersion: fresh.osVersion ?? undefined,
        hostname: fresh.hostname ?? undefined,
        appVersion: fresh.appVersion ?? undefined,
      });

      await manager.update(DevicePairingRequest, fresh.id, {
        claimedAt: new Date(),
      });

      return {
        ...result,
        email: approver.email,
        organisationName: organisation.name,
      };
    });

    if (!issued) {
      return { status: 'expired' };
    }

    return {
      status: 'approved',
      deviceId: issued.deviceId,
      deviceToken: issued.token,
      email: issued.email,
      organisationName: issued.organisationName,
    };
  }

  private async findPending(code: string): Promise<DevicePairingRequest> {
    const request = await this.pairingRequests.findOne({
      where: { codeHash: hashToken(code) },
    });

    if (
      !request ||
      request.expiresAt < new Date() ||
      request.approvedAt ||
      request.claimedAt
    ) {
      throw new NotFoundException(PAIRING_NOT_FOUND_MESSAGE);
    }

    return request;
  }
}
