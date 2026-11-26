import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Summary emails default to weekly, but only for organisations created from
 * now on: every organisation that already exists starts with both switched
 * off, so nobody's inbox changes underneath them on the first Monday after
 * the release. An admin turns them on in Settings › Notifications.
 */
export class SummaryEmailsOffForExistingOrganisations1791200000001 implements MigrationInterface {
  name = 'SummaryEmailsOffForExistingOrganisations1791200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keys already present win (right-hand side of `||`), so this never
    // overrides a choice somebody made.
    await queryRunner.query(
      `UPDATE "organisations"
       SET "settings" = '{"personalSummaryEmails":"off","teamSummaryEmails":"off"}'::jsonb || "settings"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only "off" can have come from here; anything else was an admin's choice.
    await queryRunner.query(
      `UPDATE "organisations" SET "settings" = "settings" - 'personalSummaryEmails'
       WHERE "settings" ->> 'personalSummaryEmails' = 'off'`,
    );
    await queryRunner.query(
      `UPDATE "organisations" SET "settings" = "settings" - 'teamSummaryEmails'
       WHERE "settings" ->> 'teamSummaryEmails' = 'off'`,
    );
  }
}
