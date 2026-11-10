import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Record activity" (`settings.activityTrackingEnabled`) defaults off, so a
 * new Organisation starts without it. Every Organisation that predates the
 * setting has been recording activity all along, though — it was wired to a
 * running timer alone, with no switch — so each gets an explicit `true`
 * rather than being switched off by the new default. Same shape as
 * `1790980000000-MakeTimeEntryProjectOptional`'s projectsEnabled backfill.
 *
 * Only rows that haven't got the key: re-running this must not overwrite an
 * admin who has since turned it off. Written as `-> 'key' IS NULL` rather
 * than the `?` containment operator, which a driver can mistake for a
 * parameter placeholder.
 */
export class BackfillOrganisationActivityTracking1791100000000 implements MigrationInterface {
  name = 'BackfillOrganisationActivityTracking1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "organisations"
       SET "settings" = jsonb_set("settings", '{activityTrackingEnabled}', 'true'::jsonb)
       WHERE "settings" -> 'activityTrackingEnabled' IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "organisations" SET "settings" = "settings" - 'activityTrackingEnabled'`,
    );
  }
}
