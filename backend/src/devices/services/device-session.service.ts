import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { recordAnalyticsEvent } from '../../common/analytics';
import { hashToken } from '../../common/hash-token.util';
import { TokenService } from '../../auth/services/token.service';
import { Device } from '../../database/entities/device.entity';
import { DevicePlatform } from '../../database/entities/device-platform.enum';
import { DeviceSession } from '../../database/entities/device-session.entity';
import { HeartbeatDto } from '../dto/heartbeat.dto';

export interface LoginDeviceInput {
  userId: string;
  organisationId: string;
  deviceFingerprint: string;
  platform: DevicePlatform;
  osVersion?: string;
  hostname?: string;
  appVersion?: string;
}

export interface DeviceSessionIssued {
  deviceId: string;
  token: string;
}

@Injectable()
export class DeviceSessionService {
  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    @InjectRepository(DeviceSession)
    private readonly deviceSessions: Repository<DeviceSession>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tokenService: TokenService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Called from AuthService.login when the login carries a device
   * fingerprint. Upserts the Device by fingerprint (never duplicating a
   * machine across logins) and always issues a fresh DeviceSession — the
   * one thing that changes when this fingerprint belongs to a *different*
   * user than last time is that its old sessions get revoked first, so a
   * reassigned device can't be driven by two people's tokens at once (see
   * CONTEXT.md's Device entry).
   */
  async upsertOnLogin(
    manager: EntityManager,
    input: LoginDeviceInput,
  ): Promise<DeviceSessionIssued> {
    const now = new Date();
    let device = await manager.findOne(Device, {
      where: { deviceFingerprint: input.deviceFingerprint },
    });

    if (!device) {
      device = await manager.save(
        manager.create(Device, {
          deviceFingerprint: input.deviceFingerprint,
          organisationId: input.organisationId,
          userId: input.userId,
          platform: input.platform,
          osVersion: input.osVersion ?? null,
          hostname: input.hostname ?? null,
          appVersion: input.appVersion ?? null,
          lastSeenAt: now,
        }),
      );

      await this.auditLogService.record(manager, {
        action: 'device.registered',
        organisationId: input.organisationId,
        actorUserId: input.userId,
        metadata: { deviceId: device.id, platform: input.platform },
      });
      recordAnalyticsEvent('device_registered', {
        deviceId: device.id,
        organisationId: input.organisationId,
        platform: input.platform,
      });
    } else {
      if (device.userId !== input.userId) {
        await this.revokeAllSessions(manager, device.id);
      }

      await manager.update(Device, device.id, {
        userId: input.userId,
        organisationId: input.organisationId,
        platform: input.platform,
        osVersion: input.osVersion ?? null,
        hostname: input.hostname ?? null,
        appVersion: input.appVersion ?? null,
        lastSeenAt: now,
      });
    }

    const token = this.tokenService.generateToken();
    await manager.save(
      manager.create(DeviceSession, {
        deviceId: device.id,
        userId: input.userId,
        organisationId: input.organisationId,
        tokenHash: hashToken(token),
      }),
    );

    return { deviceId: device.id, token };
  }

  async heartbeat(deviceId: string, dto: HeartbeatDto): Promise<void> {
    await this.devices.update(deviceId, {
      lastSeenAt: new Date(),
      ...(dto.appVersion !== undefined ? { appVersion: dto.appVersion } : {}),
      // An agent that sends no status — an older one, or a newer one whose
      // window sources are still starting — leaves the last report standing.
      ...(dto.appCaptureStatus !== undefined
        ? {
            appCaptureStatus: dto.appCaptureStatus,
            appCaptureDetail: dto.appCaptureDetail ?? null,
          }
        : {}),
      ...(dto.displaySession !== undefined
        ? { displaySession: dto.displaySession }
        : {}),
    });
  }

  /**
   * The device's own logout — revokes only the one session presented,
   * mirroring the effect of an admin's remote sign-out for that session
   * (see CONTEXT.md's Remote sign-out entry).
   */
  async signOutSession(deviceSessionId: string): Promise<void> {
    await this.deviceSessions.update(deviceSessionId, {
      revokedAt: new Date(),
    });
  }

  /**
   * Called from AuthService on an explicit sign-out-everywhere action
   * (logout, password reset) — see ADR-0009. Returns the distinct
   * organisations any revoked session belonged to, so the caller can also
   * stop whatever running timer each one left behind.
   */
  async revokeAllForUser(userId: string): Promise<string[]> {
    const activeSessions = await this.deviceSessions.find({
      where: { userId, revokedAt: IsNull() },
    });

    if (activeSessions.length === 0) {
      return [];
    }

    await this.deviceSessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    return [
      ...new Set(activeSessions.map((session) => session.organisationId)),
    ];
  }

  private async revokeAllSessions(
    manager: EntityManager,
    deviceId: string,
  ): Promise<void> {
    await manager.update(
      DeviceSession,
      { deviceId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
