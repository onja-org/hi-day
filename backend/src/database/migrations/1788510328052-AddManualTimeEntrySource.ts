import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualTimeEntrySource1788510328052 implements MigrationInterface {
  name = 'AddManualTimeEntrySource1788510328052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres allows ADD VALUE inside a transaction (PG 12+) as long as
    // the new value isn't used in that same transaction — this migration
    // only adds it.
    await queryRunner.query(
      `ALTER TYPE "TimeEntrySource" ADD VALUE IF NOT EXISTS 'manual'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres has no DROP VALUE for enums; removing 'manual' would mean
    // recreating the type (rename old, create new, migrate every column
    // and dependent object, drop old). Not worth the risk for a rollback
    // path that will essentially never run — accepted as a one-way
    // migration, matching how enum additions are usually handled here.
  }
}
