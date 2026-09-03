import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Device } from '../../../database/entities/device.entity';
import { DevicePlatform } from '../../../database/entities/device-platform.enum';
import { DeviceSession } from '../../../database/entities/device-session.entity';
import { DevicesService } from '../devices.service';

describe('DevicesService', () => {
  function makeDevicesRepo(overrides: Partial<Repository<Device>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides,
    } as unknown as Repository<Device>;
  }

  function makeDeviceSessionsRepo(
    overrides: Partial<Repository<DeviceSession>> = {},
  ) {
    return {
      find: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as Repository<DeviceSession>;
  }

  type TransactionFn = (manager: EntityManager) => Promise<unknown>;

  function makeDataSource() {
    const update = jest.fn().mockResolvedValue(undefined);
    const find = jest.fn().mockResolvedValue([]);
    const manager = { update, find } as unknown as EntityManager;
    const transaction = jest.fn((fn: TransactionFn) => fn(manager));
    return {
      dataSource: { transaction } as unknown,
      manager,
      transaction,
      update,
      find,
    };
  }

  function makeConfigService() {
    return {
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService;
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeService(
    overrides: {
      devicesRepo?: Repository<Device>;
      deviceSessionsRepo?: Repository<DeviceSession>;
      dataSource?: unknown;
      configService?: ConfigService;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new DevicesService(
      overrides.devicesRepo ?? makeDevicesRepo(),
      overrides.deviceSessionsRepo ?? makeDeviceSessionsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.configService ?? makeConfigService(),
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  const baseDevice = {
    id: 'device-1',
    organisationId: 'org-1',
    userId: 'user-1',
    user: { email: 'jane@acme.test', name: 'Jane' },
    platform: DevicePlatform.MACOS,
    osVersion: null,
    hostname: null,
    appVersion: null,
    lastSeenAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
  };

  describe('listForOrganisation', () => {
    it('marks devices with no active session as signed_out', async () => {
      const devicesRepo = makeDevicesRepo({
        find: jest.fn().mockResolvedValue([baseDevice]),
      });
      const deviceSessionsRepo = makeDeviceSessionsRepo({
        find: jest.fn().mockResolvedValue([]),
      });
      const service = makeService({ devicesRepo, deviceSessionsRepo });

      const summaries = await service.listForOrganisation('org-1');

      expect(summaries[0].status).toBe('signed_out');
    });

    it('marks devices with an active session as active when seen recently', async () => {
      const devicesRepo = makeDevicesRepo({
        find: jest
          .fn()
          .mockResolvedValue([{ ...baseDevice, lastSeenAt: new Date() }]),
      });
      const deviceSessionsRepo = makeDeviceSessionsRepo({
        find: jest.fn().mockResolvedValue([{ deviceId: 'device-1' }]),
      });
      const service = makeService({ devicesRepo, deviceSessionsRepo });

      const summaries = await service.listForOrganisation('org-1');

      expect(summaries[0].status).toBe('active');
    });

    it('filters by userId when given', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const devicesRepo = makeDevicesRepo({ find });
      const service = makeService({ devicesRepo });

      await service.listForOrganisation('org-1', 'user-2');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', userId: 'user-2' },
        }),
      );
    });
  });

  describe('signOutAsAdmin', () => {
    it('throws when the device does not belong to the organisation', async () => {
      const service = makeService();

      await expect(
        service.signOutAsAdmin('org-1', 'device-1', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revokes all active sessions and records an audit log entry', async () => {
      const devicesRepo = makeDevicesRepo({
        findOne: jest.fn().mockResolvedValue(baseDevice),
      });
      const { dataSource, update } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ devicesRepo, dataSource, auditLogService });

      const result = await service.signOutAsAdmin(
        'org-1',
        'device-1',
        'admin-1',
      );

      expect(update).toHaveBeenCalledWith(
        DeviceSession,
        expect.objectContaining({ deviceId: 'device-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as unknown }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'device.signed_out' }),
      );
      expect(result.status).toBe('signed_out');
    });
  });

  describe('signOutOwnDevice', () => {
    it('throws when the device does not belong to the caller', async () => {
      const service = makeService();

      await expect(
        service.signOutOwnDevice('user-1', 'device-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revokes the device when it belongs to the caller', async () => {
      const devicesRepo = makeDevicesRepo({
        findOne: jest.fn().mockResolvedValue(baseDevice),
      });
      const { dataSource } = makeDataSource();
      const service = makeService({ devicesRepo, dataSource });

      const result = await service.signOutOwnDevice('user-1', 'device-1');

      expect(result.status).toBe('signed_out');
    });
  });

  describe('signOutAllForUser', () => {
    it('revokes every device assigned to the user and audits each one', async () => {
      const { manager, find, update } = makeDataSource();
      find.mockResolvedValue([
        { id: 'device-1', organisationId: 'org-1' },
        { id: 'device-2', organisationId: 'org-1' },
      ]);
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ auditLogService });

      await service.signOutAllForUser(manager, 'org-1', 'user-1', 'admin-1');

      expect(update).toHaveBeenCalledTimes(2);
      expect(record).toHaveBeenCalledTimes(2);
    });
  });
});
