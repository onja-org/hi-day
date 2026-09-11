import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { TokenService } from '../../../auth/services/token.service';
import { hashToken } from '../../../common/hash-token.util';
import { DevicePairingRequest } from '../../../database/entities/device-pairing-request.entity';
import { DevicePlatform } from '../../../database/entities/device-platform.enum';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { Organisation } from '../../../database/entities/organisation.entity';
import { User } from '../../../database/entities/user.entity';
import { DevicePairingService } from '../device-pairing.service';
import { DeviceSessionService } from '../device-session.service';

describe('DevicePairingService', () => {
  function makePairingRequestsRepo(
    overrides: Partial<Repository<DevicePairingRequest>> = {},
  ) {
    return {
      create: jest.fn((data: Partial<DevicePairingRequest>) => data),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Repository<DevicePairingRequest>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn().mockResolvedValue({ organisationId: 'org-1' }),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeDataSource(manager: EntityManager) {
    return {
      manager,
      transaction: jest.fn((fn: (manager: EntityManager) => Promise<unknown>) =>
        fn(manager),
      ),
    } as unknown as never;
  }

  function makeConfigService() {
    return {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as ConfigService;
  }

  function makeTokenService() {
    return {
      generateToken: jest.fn().mockReturnValue('raw-code'),
    } as unknown as TokenService;
  }

  function makeDeviceSessionService() {
    const upsertOnLogin = jest
      .fn()
      .mockResolvedValue({ deviceId: 'device-1', token: 'device-token' });
    return {
      deviceSessionService: {
        upsertOnLogin,
      } as unknown as DeviceSessionService,
      upsertOnLogin,
    };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeManager(overrides: Partial<EntityManager> = {}) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as EntityManager;
  }

  // The service's transaction looks up the DevicePairingRequest and,
  // separately, the approving User and Organisation, all via the same
  // manager — this discriminates by entity class so each lookup returns
  // the right fixture.
  function makeApprovedFlowManager(
    request: DevicePairingRequest,
    user: { id: string; email: string },
    organisation: { id: string; name: string },
    updateMock: jest.Mock,
  ) {
    return makeManager({
      findOne: jest.fn((entity: unknown) => {
        if (entity === User) return Promise.resolve(user);
        if (entity === Organisation) return Promise.resolve(organisation);
        return Promise.resolve(request);
      }),
      update: updateMock,
    });
  }

  function makeService(overrides: {
    pairingRequestsRepo?: Repository<DevicePairingRequest>;
    membershipsRepo?: Repository<Membership>;
    manager?: EntityManager;
    configService?: ConfigService;
    tokenService?: TokenService;
    deviceSessionService?: DeviceSessionService;
    auditLogService?: AuditLogService;
  }) {
    return new DevicePairingService(
      overrides.pairingRequestsRepo ?? makePairingRequestsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      makeDataSource(overrides.manager ?? makeManager()),
      overrides.configService ?? makeConfigService(),
      overrides.tokenService ?? makeTokenService(),
      overrides.deviceSessionService ??
        makeDeviceSessionService().deviceSessionService,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  const pendingRequest = {
    id: 'pairing-1',
    codeHash: hashToken('raw-code'),
    deviceFingerprint: 'fingerprint-1',
    platform: DevicePlatform.LINUX,
    osVersion: null,
    hostname: 'jane-laptop',
    appVersion: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date(Date.now() + 60_000),
    approvedByUserId: null,
    approvedOrganisationId: null,
    approvedAt: null,
    claimedAt: null,
  };

  describe('start', () => {
    it('stores a hashed code and returns the approval URL built from FRONTEND_URL', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const pairingRequestsRepo = makePairingRequestsRepo({ save });
      const service = makeService({ pairingRequestsRepo });

      const result = await service.start({
        deviceFingerprint: 'fingerprint-1',
        platform: DevicePlatform.LINUX,
      });

      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          codeHash: hashToken('raw-code'),
          deviceFingerprint: 'fingerprint-1',
        }),
      );
      expect(result.code).toBe('raw-code');
      expect(result.approvalUrl).toBe(
        'http://localhost:3000/link-device?code=raw-code',
      );
    });
  });

  describe('getPendingByCode', () => {
    it('returns the device summary for a pending request', async () => {
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue(pendingRequest),
      });
      const service = makeService({ pairingRequestsRepo });

      const summary = await service.getPendingByCode('raw-code');

      expect(summary).toEqual({
        platform: DevicePlatform.LINUX,
        hostname: 'jane-laptop',
        requestedAt: pendingRequest.createdAt,
      });
    });

    it('throws for an unknown code', async () => {
      const service = makeService({});

      await expect(service.getPendingByCode('unknown')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws for an expired code', async () => {
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue({
          ...pendingRequest,
          expiresAt: new Date(Date.now() - 1000),
        }),
      });
      const service = makeService({ pairingRequestsRepo });

      await expect(service.getPendingByCode('raw-code')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws for an already-approved code', async () => {
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...pendingRequest, approvedAt: new Date() }),
      });
      const service = makeService({ pairingRequestsRepo });

      await expect(service.getPendingByCode('raw-code')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it("records the approver's own active organisation, never anything the desktop sent", async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue(pendingRequest),
        update,
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          userId: 'user-1',
          organisationId: 'org-1',
          status: MembershipStatus.ACTIVE,
        }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        pairingRequestsRepo,
        membershipsRepo,
        auditLogService,
      });

      await service.approve('raw-code', 'user-1');

      expect(update).toHaveBeenCalledWith(
        'pairing-1',
        expect.objectContaining({
          approvedByUserId: 'user-1',
          approvedOrganisationId: 'org-1',
          approvedAt: expect.any(Date) as unknown,
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'device.pairing_approved' }),
      );
    });

    it('throws when the approving user has no active membership', async () => {
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue(pendingRequest),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ pairingRequestsRepo, membershipsRepo });

      await expect(
        service.approve('raw-code', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pollStatus', () => {
    it('reports pending before approval', async () => {
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue(pendingRequest),
      });
      const service = makeService({ pairingRequestsRepo });

      await expect(service.pollStatus('raw-code')).resolves.toEqual({
        status: 'pending',
      });
    });

    it('reports expired for an unknown or expired code', async () => {
      const service = makeService({});

      await expect(service.pollStatus('unknown')).resolves.toEqual({
        status: 'expired',
      });
    });

    it('claims an approved request exactly once, issuing the device session', async () => {
      const approvedRequest = {
        ...pendingRequest,
        approvedByUserId: 'user-1',
        approvedOrganisationId: 'org-1',
        approvedAt: new Date(),
      };
      const managerUpdate = jest.fn().mockResolvedValue(undefined);
      const manager = makeApprovedFlowManager(
        approvedRequest as unknown as DevicePairingRequest,
        { id: 'user-1', email: 'jane@acme.test' },
        { id: 'org-1', name: 'Acme Inc' },
        managerUpdate,
      );
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue(approvedRequest),
      });
      const { deviceSessionService, upsertOnLogin } =
        makeDeviceSessionService();
      const service = makeService({
        pairingRequestsRepo,
        manager,
        deviceSessionService,
      });

      const result = await service.pollStatus('raw-code');

      expect(upsertOnLogin).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ userId: 'user-1', organisationId: 'org-1' }),
      );
      expect(managerUpdate).toHaveBeenCalledWith(
        DevicePairingRequest,
        'pairing-1',
        expect.objectContaining({ claimedAt: expect.any(Date) as unknown }),
      );
      expect(result).toEqual({
        status: 'approved',
        deviceId: 'device-1',
        deviceToken: 'device-token',
        email: 'jane@acme.test',
        organisationName: 'Acme Inc',
      });
    });

    it('reports expired instead of re-claiming an already-claimed request', async () => {
      const approvedRequest = {
        ...pendingRequest,
        approvedByUserId: 'user-1',
        approvedOrganisationId: 'org-1',
        approvedAt: new Date(),
      };
      const alreadyClaimed = { ...approvedRequest, claimedAt: new Date() };
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue(alreadyClaimed),
      });
      const pairingRequestsRepo = makePairingRequestsRepo({
        findOne: jest.fn().mockResolvedValue(approvedRequest),
      });
      const service = makeService({ pairingRequestsRepo, manager });

      await expect(service.pollStatus('raw-code')).resolves.toEqual({
        status: 'expired',
      });
    });
  });
});
