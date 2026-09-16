import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimeEntriesMembershipStartedAtIndex1789600000000 implements MigrationInterface {
  name = 'AddTimeEntriesMembershipStartedAtIndex1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backs TimeEntriesService.listCoveringWindow, which filters by
    // membershipId plus a startedAt/endedAt range — the existing
    // membershipId-only index (see time-entry.entity.ts) isn't enough once
    // this range scan runs on every Apps/URLs/Screenshots activity page
    // load (see the time-entry-coverage.util.ts project-attribution join).
    await queryRunner.query(
      `CREATE INDEX "IDX_time_entries_membershipId_startedAt" ON "time_entries" ("membershipId", "startedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_time_entries_membershipId_startedAt"`,
    );
  }
}
