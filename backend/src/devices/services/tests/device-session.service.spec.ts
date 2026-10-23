import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { TokenService } from '../../../auth/services/token.service';
import { hashToken } from '../../../common/hash-token.util';
import { AppCaptureStatus } from '../../../database/entities/app-capture-status.enum';
import { Device } from '../../../database/entities/device.entity';
import { DevicePlatform } from '../../../database/entities/device-platform.enum';
import { DeviceSession } from '../../../database/entities/device-session.entity';
import { UrlCaptureStatus } from '../../../database/entities/url-capture-status.enum';
import { DeviceSessionService } from '../device-session.service';

describe('DeviceSessionService', () => {
  function makeDevicesRepo(overrides: Partial<Repository<Device>> = {}) {
    return {
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Repository<Device>;
  }

  function makeDeviceSessionsRepo() {
    return {} as unknown as Repository<DeviceSession>;
  }

  function makeDataSource() {
    return { transaction: jest.fn() } as unknown as never;
  }

  function makeTokenService() {
    return {
      generateToken: jest.fn().mockReturnValue('raw-device-token'),
    } as unknown as TokenService;
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeManager(overrides: Partial<EntityManager> = {}) {
    const findOne = overrides.findOne ?? jest.fn().mockResolvedValue(null);
    const create =
      overrides.create ??
      jest.fn((_entity: unknown, data: Record<string, unknown>) => data);
    const save =
      overrides.save ??
      jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'device-1', ...entity }),
      );
    const update = overrides.update ?? jest.fn().mockResolvedValue(undefined);
    const manager = {
      findOne,
      create,
      save,
      update,
    } as unknown as EntityManager;
    return { manager, findOne, create, save, update };
  }

  function makeService(
    overrides: {
      devicesRepo?: Repository<Device>;
      deviceSessionsRepo?: Repository<DeviceSession>;
      tokenService?: TokenService;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new DeviceSessionService(
      overrides.devicesRepo ?? makeDevicesRepo(),
      overrides.deviceSessionsRepo ?? makeDeviceSessionsRepo(),
      makeDataSource(),
      overrides.tokenService ?? makeTokenService(),
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  const loginInput = {
    userId: 'user-1',
    organisationId: 'org-1',
    deviceFingerprint: 'fingerprint-1',
    platform: DevicePlatform.MACOS,
    hostname: 'janes-macbook',
  };

  describe('upsertOnLogin', () => {
    it('creates a new device and audits device.registered when the fingerprint is unseen', async () => {
      const { manager, create, save } = makeManager();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ auditLogService });

      const result = await service.upsertOnLogin(manager, loginInput);

      expect(create).toHaveBeenCalledWith(
        Device,
        expect.objectContaining({
          deviceFingerprint: 'fingerprint-1',
          userId: 'user-1',
          organisationId: 'org-1',
        }),
      );
      expect(record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'device.registered' }),
      );
      expect(result.deviceId).toBe('device-1');
      expect(result.token).toBe('raw-device-token');
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-1',
          userId: 'user-1',
          tokenHash: hashToken('raw-device-token'),
        }),
      );
    });

    it('reuses the existing device and does not audit device.registered on an ordinary re-login', async () => {
      const { manager, create, update } = makeManager({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'device-1', userId: 'user-1' }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ auditLogService });

      const result = await service.upsertOnLogin(manager, loginInput);

      expect(create).not.toHaveBeenCalledWith(Device, expect.anything());
      expect(update).toHaveBeenCalledWith(
        Device,
        'device-1',
        expect.objectContaining({ userId: 'user-1', organisationId: 'org-1' }),
      );
      expect(record).not.toHaveBeenCalled();
      expect(result.deviceId).toBe('device-1');
    });

    it('revokes prior sessions when the same fingerprint reappears under a different user', async () => {
      const { manager, update } = makeManager({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'device-1', userId: 'previous-user' }),
      });
      const service = makeService();

      await service.upsertOnLogin(manager, loginInput);

      expect(update).toHaveBeenCalledWith(
        DeviceSession,
        expect.objectContaining({ deviceId: 'device-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as unknown }),
      );
      expect(update).toHaveBeenCalledWith(
        Device,
        'device-1',
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('does not revoke prior sessions when the same user re-logs in', async () => {
      const { manager, update } = makeManager({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'device-1', userId: 'user-1' }),
      });
      const service = makeService();

      await service.upsertOnLogin(manager, loginInput);

      expect(update).not.toHaveBeenCalledWith(
        DeviceSession,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('heartbeat', () => {
    it('bumps lastSeenAt and optionally appVersion', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const devicesRepo = makeDevicesRepo({ update });
      const service = makeService({ devicesRepo });

      await service.heartbeat('device-1', { appVersion: '2.0.0' });

      expect(update).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          lastSeenAt: expect.any(Date) as unknown,
          appVersion: '2.0.0',
        }),
      );
    });
    it('stores app-capture health and the display session when reported', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const devicesRepo = makeDevicesRepo({ update });
      const service = makeService({ devicesRepo });

      await service.heartbeat('device-1', {
        appVersion: '2.0.0',
        appCaptureStatus: AppCaptureStatus.UNAVAILABLE,
        appCaptureDetail: 'Could not connect to the X display.',
        displaySession: 'x11 · ubuntu:GNOME',
      });

      expect(update).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          appCaptureStatus: AppCaptureStatus.UNAVAILABLE,
          appCaptureDetail: 'Could not connect to the X display.',
          displaySession: 'x11 · ubuntu:GNOME',
        }),
      );
    });

    it('clears the detail when the status comes back ok', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const devicesRepo = makeDevicesRepo({ update });
      const service = makeService({ devicesRepo });

      await service.heartbeat('device-1', {
        appCaptureStatus: AppCaptureStatus.OK,
      });

      expect(update).toHaveBeenCalledWith(
        'device-1',
        expect.objectContaining({
          appCaptureStatus: AppCaptureStatus.OK,
          appCaptureDetail: null,
        }),
      );
    });

    it('stores URL-capture health alongside app-capture health', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const devicesRepo = makeDevicesRepo({ update });
      const service = makeService({ devicesRepo });

      await service.heartbeat('device-1', {
        urlCaptureStatus: UrlCaptureStatus.DEGRADED,
        urlCaptureDetail: 'Chrome is running without website tracking.',
      });

      const [, patch] = update.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(patch).toMatchObject({
        urlCaptureStatus: UrlCaptureStatus.DEGRADED,
        urlCaptureDetail: 'Chrome is running without website tracking.',
      });
      expect(patch).not.toHaveProperty('appCaptureStatus');
    });

    it('leaves the last report standing when an agent sends none', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const devicesRepo = makeDevicesRepo({ update });
      const service = makeService({ devicesRepo });

      await service.heartbeat('device-1', { appVersion: '2.0.0' });

      const [, patch] = update.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(patch).not.toHaveProperty('appCaptureStatus');
      expect(patch).not.toHaveProperty('appCaptureDetail');
      expect(patch).not.toHaveProperty('displaySession');
      expect(patch).not.toHaveProperty('urlCaptureStatus');
    });
  });

  describe('signOutSession', () => {
    it('revokes only the presented session', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const deviceSessionsRepo = {
        update,
      } as unknown as Repository<DeviceSession>;
      const service = makeService({ deviceSessionsRepo });

      await service.signOutSession('session-1');

      expect(update).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ revokedAt: expect.any(Date) as unknown }),
      );
    });
  });

  describe('revokeAllForUser', () => {
    it("revokes every one of the user's active sessions and returns the distinct organisations", async () => {
      const find = jest.fn().mockResolvedValue([
        { id: 'session-1', organisationId: 'org-1' },
        { id: 'session-2', organisationId: 'org-1' },
        { id: 'session-3', organisationId: 'org-2' },
      ]);
      const update = jest.fn().mockResolvedValue(undefined);
      const deviceSessionsRepo = {
        find,
        update,
      } as unknown as Repository<DeviceSession>;
      const service = makeService({ deviceSessionsRepo });

      const organisationIds = await service.revokeAllForUser('user-1');

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as unknown }),
      );
      expect(organisationIds.sort()).toEqual(['org-1', 'org-2']);
    });

    it('does nothing and returns an empty list when the user has no active sessions', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const update = jest.fn().mockResolvedValue(undefined);
      const deviceSessionsRepo = {
        find,
        update,
      } as unknown as Repository<DeviceSession>;
      const service = makeService({ deviceSessionsRepo });

      const organisationIds = await service.revokeAllForUser('user-1');

      expect(update).not.toHaveBeenCalled();
      expect(organisationIds).toEqual([]);
    });
  });
});
