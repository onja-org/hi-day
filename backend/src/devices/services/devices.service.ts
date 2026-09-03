import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { recordAnalyticsEvent } from '../../common/analytics';
import { Device } from '../../database/entities/device.entity';
import { DevicePlatform } from '../../database/entities/device-platform.enum';
import { DeviceSession } from '../../database/entities/device-session.entity';
import {
  computeDeviceStatus,
  DEFAULT_DEVICE_HEARTBEAT_WINDOW_MINUTES,
  DeviceStatus,
} from '../device-status';

export interface DeviceSummary {
  id: string;
  status: DeviceStatus;
  platform: DevicePlatform;
  osVersion: string | null;
  hostname: string | null;
  appVersion: string | null;
  userId: string;
  userEmail: string;
  userName: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    @InjectRepository(DeviceSession)
    private readonly deviceSessions: Repository<DeviceSession>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Authorization is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an
   * admin/manager of this Organisation.
   */
  async listForOrganisation(
    organisationId: string,
    userId?: string,
  ): Promise<DeviceSummary[]> {
    const devices = await this.devices.find({
      where: { organisationId, ...(userId ? { userId } : {}) },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    return this.toSummaries(devices);
  }

  async listForUser(userId: string): Promise<DeviceSummary[]> {
    const devices = await this.devices.find({
      where: { userId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    return this.toSummaries(devices);
  }

  async signOutAsAdmin(
    organisationId: string,
    deviceId: string,
    actorUserId: string,
  ): Promise<DeviceSummary> {
    const device = await this.devices.findOne({
      where: { id: deviceId, organisationId },
      relations: { user: true },
    });

    if (!device) {
      throw new NotFoundException('Device not found.');
    }

    return this.signOut(device, actorUserId);
  }

  async signOutOwnDevice(
    userId: string,
    deviceId: string,
  ): Promise<DeviceSummary> {
    const device = await this.devices.findOne({
      where: { id: deviceId, userId },
      relations: { user: true },
    });

    if (!device) {
      throw new NotFoundException('Device not found.');
    }

    return this.signOut(device, userId);
  }

  /**
   * Called when a Membership deactivates — a Device's sessions can't
   * outlive the person they're assigned to (see CONTEXT.md's Remote
   * sign-out entry).
   */
  async signOutAllForUser(
    manager: EntityManager,
    organisationId: string,
    userId: string,
    actorUserId: string,
  ): Promise<void> {
    const devices = await manager.find(Device, {
      where: { organisationId, userId },
    });

    for (const device of devices) {
      await manager.update(
        DeviceSession,
        { deviceId: device.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      await this.auditLogService.record(manager, {
        action: 'device.signed_out',
        organisationId,
        actorUserId,
        metadata: { deviceId: device.id },
      });
      recordAnalyticsEvent('device_signed_out', {
        deviceId: device.id,
        organisationId,
      });
    }
  }

  private async signOut(
    device: Device,
    actorUserId: string,
  ): Promise<DeviceSummary> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        DeviceSession,
        { deviceId: device.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      await this.auditLogService.record(manager, {
        action: 'device.signed_out',
        organisationId: device.organisationId,
        actorUserId,
        metadata: { deviceId: device.id },
      });
    });

    recordAnalyticsEvent('device_signed_out', {
      deviceId: device.id,
      organisationId: device.organisationId,
    });

    const [summary] = await this.toSummaries([device]);
    return summary;
  }

  private async toSummaries(devices: Device[]): Promise<DeviceSummary[]> {
    if (devices.length === 0) {
      return [];
    }

    const activeSessions = await this.deviceSessions.find({
      where: { deviceId: In(devices.map((d) => d.id)), revokedAt: IsNull() },
    });
    const devicesWithActiveSessions = new Set(
      activeSessions.map((s) => s.deviceId),
    );

    const heartbeatWindowMinutes = Number(
      this.configService.get(
        'DEVICE_HEARTBEAT_WINDOW_MINUTES',
        DEFAULT_DEVICE_HEARTBEAT_WINDOW_MINUTES,
      ),
    );
    const now = new Date();

    return devices.map((device) => ({
      id: device.id,
      status: computeDeviceStatus(
        device,
        devicesWithActiveSessions.has(device.id),
        heartbeatWindowMinutes,
        now,
      ),
      platform: device.platform,
      osVersion: device.osVersion,
      hostname: device.hostname,
      appVersion: device.appVersion,
      userId: device.userId,
      userEmail: device.user.email,
      userName: device.user.name,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    }));
  }
}
