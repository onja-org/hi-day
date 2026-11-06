import { getMetadataArgsStorage } from 'typeorm';
import '../../../database/database.module';
import { Organisation } from '../../../database/entities/organisation.entity';
import {
  OrganisationPurgeService,
  PURGED_TABLES_BY_ORGANISATION_ID,
} from '../organisation-purge.service';

// Tables whose `organisationId` column is deliberately not purged by
// `organisationId` alone: audit rows outlive the org (see purgeAuditLogs).
const EXEMPT_TABLES = ['audit_logs'];

describe('OrganisationPurgeService table coverage', () => {
  it('purges every entity table that has an organisationId column', () => {
    const storage = getMetadataArgsStorage();
    const orgScopedTables = storage.tables
      .filter((table) =>
        storage.columns.some(
          (column) =>
            column.target === table.target &&
            column.propertyName === 'organisationId',
        ),
      )
      .map((table) => table.name as string)
      .filter((name) => !EXEMPT_TABLES.includes(name));

    expect(orgScopedTables.length).toBeGreaterThan(0);
    for (const table of orgScopedTables) {
      expect(PURGED_TABLES_BY_ORGANISATION_ID).toContain(table);
    }
  });
});

describe('OrganisationPurgeService billing', () => {
  const organisation = {
    id: 'org-1',
    publicId: 100001,
    name: 'Acme',
  } as Organisation;

  function makeService(billing?: { cancelNow: jest.Mock }) {
    /** Every side effect, in the order it happened. */
    const steps: string[] = [];
    const query = jest.fn((sql: string) => {
      if (sql.startsWith('DELETE FROM "subscriptions"')) {
        steps.push('delete subscription row');
      }
      return Promise.resolve([]);
    });
    const dataSource = {
      transaction: jest.fn((fn: (manager: unknown) => unknown) => {
        steps.push('database transaction');
        return fn({ query });
      }),
    };
    const storage = {
      deleteByPrefix: jest.fn(() => {
        steps.push('delete screenshots');
        return Promise.resolve(0);
      }),
      hasObjectsWithPrefix: jest.fn().mockResolvedValue(false),
    };
    billing?.cancelNow.mockImplementation(() => {
      steps.push('cancel subscription');
      return Promise.resolve();
    });
    const service = new OrganisationPurgeService(
      dataSource as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      storage as never,
      { record: jest.fn() },
      { sendOrganisationDeletionNotice: jest.fn() } as never,
      billing as never,
    );
    return { service, steps, storage, dataSource };
  }

  // Our row is the only record of the subscription id: once it is gone,
  // nothing could stop the subscription charging.
  it('cancels the subscription before erasing anything', async () => {
    const { service, steps } = makeService({ cancelNow: jest.fn() });

    await service.purge(organisation);

    expect(steps.slice(0, 3)).toEqual([
      'cancel subscription',
      'delete screenshots',
      'database transaction',
    ]);
    expect(steps).toContain('delete subscription row');
  });

  it('erases nothing when the subscription cannot be cancelled, leaving it for the hourly retry', async () => {
    const billing = { cancelNow: jest.fn() };
    const { service, storage, dataSource } = makeService(billing);
    billing.cancelNow.mockRejectedValue(new Error('Stripe is down'));

    await expect(service.purge(organisation)).rejects.toThrow('Stripe is down');
    expect(storage.deleteByPrefix).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('purges as before with billing off', async () => {
    const { service, steps } = makeService();

    await service.purge(organisation);

    expect(steps[0]).toBe('delete screenshots');
  });
});
