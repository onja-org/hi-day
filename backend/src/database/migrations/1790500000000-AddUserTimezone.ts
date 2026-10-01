import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `users.timezone`, so a timesheet can be read in someone's local time.
 * Nullable, no backfill: a guessed zone would be indistinguishable from a
 * reported one.
 */
export class AddUserTimezone1790500000000 implements MigrationInterface {
  name = 'AddUserTimezone1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "timezone" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "timezone"`);
  }
}
