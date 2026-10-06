import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written, same reasoning as `1790860000000-CreateSavedReports`: a
 * generated migration would also rewrite unrelated constraints. See
 * docs/adr/0023-owner-can-opt-into-immediate-purge.md.
 */
export class AddPermanentOrganisationDeletionMode1790900000000 implements MigrationInterface {
  name = 'AddPermanentOrganisationDeletionMode1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."OrganisationDeletionMode" ADD VALUE IF NOT EXISTS 'permanent'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres can't drop an enum value, so the type is rebuilt without it.
    await queryRunner.query(
      `DELETE FROM "organisation_deletion_requests" WHERE "mode" = 'permanent'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."OrganisationDeletionMode" RENAME TO "OrganisationDeletionMode_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."OrganisationDeletionMode" AS ENUM('now', 'scheduled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisation_deletion_requests" ALTER COLUMN "mode" TYPE "public"."OrganisationDeletionMode" USING "mode"::text::"public"."OrganisationDeletionMode"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."OrganisationDeletionMode_old"`,
    );
  }
}
