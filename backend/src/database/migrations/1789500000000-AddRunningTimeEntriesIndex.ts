import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRunningTimeEntriesIndex1789500000000 implements MigrationInterface {
  name = 'AddRunningTimeEntriesIndex1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backs TimeEntriesService.splitRunningEntriesAcrossDayBoundary's hourly
    // scan (`endedAt IS NULL AND "startedAt" < <today's midnight>`) — unlike
    // every other time_entries query, this one isn't paired with a
    // membershipId, so it needs its own index rather than relying on
    // "UQ_time_entries_one_running_per_membership" (which is keyed on
    // membershipId, not startedAt).
    await queryRunner.query(
      `CREATE INDEX "IDX_time_entries_running_startedAt" ON "time_entries" ("startedAt") WHERE "endedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_time_entries_running_startedAt"`);
  }
}
