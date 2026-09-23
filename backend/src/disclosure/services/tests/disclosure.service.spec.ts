import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { ConsentDecision } from '../../../database/entities/consent-decision.enum';
import { ConsentRecord } from '../../../database/entities/consent-record.entity';
import { DisclosureVersion } from '../../../database/entities/disclosure-version.entity';
import { DisclosureVersionStatus } from '../../../database/entities/disclosure-version-status.enum';
import { Membership } from '../../../database/entities/membership.entity';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
import { DisclosureService } from '../disclosure.service';

const NO_CAPTURE_ENABLED = {
  windowTrackingEnabled: false,
  screenshotsEnabled: false,
  screenshotFrequencySeconds: 600,
  screenshotRetentionDays: 30,
};

const CAPTURE_ENABLED = {
  ...NO_CAPTURE_ENABLED,
  windowTrackingEnabled: true,
};

function makeDisclosureVersionsRepo(
  overrides: Partial<Repository<DisclosureVersion>> = {},
) {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: Partial<DisclosureVersion>) => data),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    createQueryBuilder: jest.fn(),
    ...overrides,
  } as unknown as Repository<DisclosureVersion>;
}

function makeConsentRecordsRepo(
  overrides: Partial<Repository<ConsentRecord>> = {},
) {
  return {
    findOne: jest.fn(),
    ...overrides,
  } as unknown as Repository<ConsentRecord>;
}

function makeMembershipsRepo(overrides: Partial<Repository<Membership>> = {}) {
  return {
    findOne: jest.fn(),
    ...overrides,
  } as unknown as Repository<Membership>;
}

function makeDataSource() {
  const create = jest.fn((_entity: unknown, data: unknown) => data);
  const save = jest.fn((_entity: unknown, data: unknown) =>
    Promise.resolve(data),
  );
  const manager = { create, save } as unknown as EntityManager;
  const transaction = jest.fn(
    (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
  );
  return { dataSource: { transaction } as unknown, transaction, create, save };
}

function makeAuditLogService() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { auditLogService: { record } as unknown as AuditLogService, record };
}

function makeOrganisationsService(captureSettings = NO_CAPTURE_ENABLED) {
  return {
    getCaptureSettings: jest.fn().mockResolvedValue(captureSettings),
  } as unknown as OrganisationsService;
}

function makeQueryBuilder(maxVersion: number | null) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ maxVersion }),
  };
}

function makeService(
  overrides: {
    disclosureVersionsRepo?: Repository<DisclosureVersion>;
    consentRecordsRepo?: Repository<ConsentRecord>;
    membershipsRepo?: Repository<Membership>;
    dataSource?: unknown;
    auditLogService?: AuditLogService;
    organisationsService?: OrganisationsService;
  } = {},
) {
  return new DisclosureService(
    overrides.disclosureVersionsRepo ?? makeDisclosureVersionsRepo(),
    overrides.consentRecordsRepo ?? makeConsentRecordsRepo(),
    overrides.membershipsRepo ?? makeMembershipsRepo(),
    (overrides.dataSource ?? makeDataSource().dataSource) as never,
    overrides.auditLogService ?? makeAuditLogService().auditLogService,
    overrides.organisationsService ?? makeOrganisationsService(),
  );
}

const REGIONAL_VERSION = {
  id: 'dv-regional',
  disclosureRegion: 'FR',
  status: DisclosureVersionStatus.PUBLISHED,
  version: 2,
  text: 'French text',
} as DisclosureVersion;

const DEFAULT_VERSION = {
  id: 'dv-default',
  disclosureRegion: null,
  status: DisclosureVersionStatus.PUBLISHED,
  version: 1,
  text: 'Default text',
} as DisclosureVersion;

describe('DisclosureService', () => {
  describe('resolveCurrentVersion', () => {
    it('returns the version matching the region exactly when one exists', async () => {
      const findOne = jest.fn().mockResolvedValueOnce(REGIONAL_VERSION);
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({ findOne }),
      });

      const result = await service.resolveCurrentVersion('org-1', 'FR');

      expect(result).toBe(REGIONAL_VERSION);
      expect(findOne).toHaveBeenCalledTimes(1);
    });

    it('falls back to the org default (region-less) version when no regional match exists', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(null) // regional lookup
        .mockResolvedValueOnce(DEFAULT_VERSION); // fallback lookup
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({ findOne }),
      });

      const result = await service.resolveCurrentVersion('org-1', 'FR');

      expect(result).toBe(DEFAULT_VERSION);
      expect(findOne).toHaveBeenCalledTimes(2);
    });

    it('returns null when nothing has been published at all', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({ findOne }),
      });

      const result = await service.resolveCurrentVersion('org-1', null);

      expect(result).toBeNull();
    });
  });

  describe('publish', () => {
    it('rejects publishing an empty draft', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValue({ ...DEFAULT_VERSION, text: '   ' });
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({ findOne }),
      });

      await expect(
        service.publish('org-1', null, 'membership-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('bumps the version number and writes an audit log entry', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValue({ ...DEFAULT_VERSION, text: 'Hello' });
      const qb = makeQueryBuilder(3);
      const disclosureVersionsRepo = makeDisclosureVersionsRepo({
        findOne,
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      });
      const { dataSource, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        disclosureVersionsRepo,
        dataSource,
        auditLogService,
      });

      await service.publish('org-1', 'FR', 'membership-1', 'user-1');

      expect(save).toHaveBeenCalledWith(
        DisclosureVersion,
        expect.objectContaining({
          version: 4,
          status: DisclosureVersionStatus.PUBLISHED,
          disclosureRegion: 'FR',
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'disclosure_version.published' }),
      );
    });
  });

  describe('getConsentStatus', () => {
    it('is never required when the org has no capture setting enabled', async () => {
      const service = makeService({
        organisationsService: makeOrganisationsService(NO_CAPTURE_ENABLED),
        disclosureVersionsRepo: makeDisclosureVersionsRepo({
          findOne: jest.fn().mockResolvedValue(DEFAULT_VERSION),
        }),
      });

      const status = await service.getConsentStatus('org-1', null, 'device-1');

      expect(status.required).toBe(false);
    });

    it('is not required (fail-closed but non-blocking) when capture is enabled but nothing has been published yet', async () => {
      const service = makeService({
        organisationsService: makeOrganisationsService(CAPTURE_ENABLED),
        disclosureVersionsRepo: makeDisclosureVersionsRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      const status = await service.getConsentStatus('org-1', null, 'device-1');

      expect(status).toEqual({
        required: false,
        disclosureVersionId: null,
        text: null,
      });
    });

    it('is required when capture is enabled, a version is published, and the device has not granted consent', async () => {
      const service = makeService({
        organisationsService: makeOrganisationsService(CAPTURE_ENABLED),
        disclosureVersionsRepo: makeDisclosureVersionsRepo({
          findOne: jest.fn().mockResolvedValue(DEFAULT_VERSION),
        }),
        consentRecordsRepo: makeConsentRecordsRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      const status = await service.getConsentStatus('org-1', null, 'device-1');

      expect(status.required).toBe(true);
      expect(status.disclosureVersionId).toBe(DEFAULT_VERSION.id);
    });

    it('is not required once the device has granted consent for the current version', async () => {
      const service = makeService({
        organisationsService: makeOrganisationsService(CAPTURE_ENABLED),
        disclosureVersionsRepo: makeDisclosureVersionsRepo({
          findOne: jest.fn().mockResolvedValue(DEFAULT_VERSION),
        }),
        consentRecordsRepo: makeConsentRecordsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ decision: ConsentDecision.GRANTED }),
        }),
      });

      const status = await service.getConsentStatus('org-1', null, 'device-1');

      expect(status.required).toBe(false);
    });
  });

  describe('recordConsent', () => {
    it('rejects a disclosureVersionId that is not a published version of this org', async () => {
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.recordConsent(
          'org-1',
          'membership-1',
          'device-1',
          null,
          'not-a-real-version',
          ConsentDecision.GRANTED,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a disclosureVersionId that is not the currently resolved version for the region', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(REGIONAL_VERSION) // the id lookup
        .mockResolvedValueOnce(DEFAULT_VERSION); // resolveCurrentVersion's own lookup(s)
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({ findOne }),
      });

      await expect(
        service.recordConsent(
          'org-1',
          'membership-1',
          'device-1',
          null,
          REGIONAL_VERSION.id,
          ConsentDecision.GRANTED,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('writes a device_consent.declined audit entry for a decline', async () => {
      const { dataSource, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        disclosureVersionsRepo: makeDisclosureVersionsRepo({
          findOne: jest.fn().mockResolvedValue(DEFAULT_VERSION),
        }),
        dataSource,
        auditLogService,
      });

      await service.recordConsent(
        'org-1',
        'membership-1',
        'device-1',
        null,
        DEFAULT_VERSION.id,
        ConsentDecision.DECLINED,
        'user-1',
      );

      expect(save).toHaveBeenCalledWith(
        ConsentRecord,
        expect.objectContaining({ decision: ConsentDecision.DECLINED }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'device_consent.declined' }),
      );
    });
  });
});
