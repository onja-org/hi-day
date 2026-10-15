import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projects become an optional feature (`settings.projectsEnabled`), so a time
 * entry may carry none. Existing Organisations that already have Projects keep
 * them on; the rest read as off through the default.
 */
export class MakeTimeEntryProjectOptional1790980000000 implements MigrationInterface {
  name = 'MakeTimeEntryProjectOptional1790980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_entries" ALTER COLUMN "projectId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "organisations"
       SET "settings" = jsonb_set("settings", '{projectsEnabled}', 'true'::jsonb)
       WHERE EXISTS (
         SELECT 1 FROM "projects" WHERE "projects"."organisationId" = "organisations"."id"
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "organisations" SET "settings" = "settings" - 'projectsEnabled'`,
    );
    // Fails if any entry has no project; those have to be assigned one first.
    await queryRunner.query(
      `ALTER TABLE "time_entries" ALTER COLUMN "projectId" SET NOT NULL`,
    );
  }
}
