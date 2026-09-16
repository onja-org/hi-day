import dataSource from './database/data-source';

describe('real DB smoke check (read-only)', () => {
  jest.setTimeout(30000);

  it('runs the new overlap query and confirms the notes table + new indexes exist', async () => {
    await dataSource.initialize();
    try {
      const qr = dataSource.createQueryRunner();
      try {
        const overlap = await dataSource
          .createQueryBuilder()
          .select(['entry.id', 'entry.projectId', 'entry.startedAt', 'entry.endedAt'])
          .from('time_entries', 'entry')
          .where('entry."organisationId" = :organisationId', {
            organisationId: '00000000-0000-0000-0000-000000000000',
          })
          .andWhere('entry."membershipId" = :membershipId', {
            membershipId: '00000000-0000-0000-0000-000000000000',
          })
          .andWhere('entry."startedAt" < :end', { end: new Date() })
          .andWhere('(entry."endedAt" IS NULL OR entry."endedAt" > :start)', {
            start: new Date(0),
          })
          .getRawMany();
        expect(Array.isArray(overlap)).toBe(true);

        const notes = await qr.query('SELECT * FROM "notes" LIMIT 1');
        expect(Array.isArray(notes)).toBe(true);

        const indexes = await qr.query(
          `SELECT indexname FROM pg_indexes WHERE indexname IN ($1, $2, $3)`,
          [
            'IDX_time_entries_membershipId_startedAt',
            'IDX_url_sessions_membershipId_startedAt',
            'IDX_notes_organisationId_membershipId_noteDate',
          ],
        );
        expect(indexes).toHaveLength(3);
      } finally {
        await qr.release();
      }
    } finally {
      await dataSource.destroy();
    }
  });
});
