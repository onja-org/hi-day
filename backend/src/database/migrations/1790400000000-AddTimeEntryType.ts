import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `time_entries.type`, so an entry can say what kind of time it holds:
 * ordinary tracked time, an idle stretch kept as its own entry rather than
 * deleted, one the person resumed after an idle warning, or hand-entered.
 *
 * Backfills `manual` from `source` — those two agree by construction — and
 * leaves everything else `normal`, since nothing before this recorded idle
 * against an entry at all.
 */
export class AddTimeEntryType1790400000000 implements MigrationInterface {
  name = 'AddTimeEntryType1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "TimeEntryType" AS ENUM('normal', 'idle', 'resumed', 'manual')`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_entries" ADD "type" "TimeEntryType" NOT NULL DEFAULT 'normal'`,
    );
    // Compare as text: `'manual'` was added to "TimeEntrySource" by an
    // earlier migration that may share this transaction, and Postgres
    // refuses to use an enum value before the transaction adding it commits.
    await queryRunner.query(
      `UPDATE "time_entries" SET "type" = 'manual' WHERE "source"::text = 'manual'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "time_entries" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "TimeEntryType"`);
  }
}
