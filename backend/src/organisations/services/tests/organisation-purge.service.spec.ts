import { getMetadataArgsStorage } from 'typeorm';
import '../../../database/database.module';
import { PURGED_TABLES_BY_ORGANISATION_ID } from '../organisation-purge.service';

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
