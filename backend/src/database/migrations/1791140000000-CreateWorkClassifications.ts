import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organisation-wide core / non-core labels for apps and websites, read by
 * the Performance page's Work time classification card. An app or site
 * with no row is "unclassified", so nothing is seeded.
 *
 * Hand-written, same reasoning as `1790860000000-CreateSavedReports`.
 */
export class CreateWorkClassifications1791140000000 implements MigrationInterface {
  name = 'CreateWorkClassifications1791140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "work_classifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "kind" character varying(8) NOT NULL,
        "name" character varying(255) NOT NULL,
        "label" character varying(16) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_classifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_work_classifications_kind" CHECK ("kind" IN ('app', 'site')),
        CONSTRAINT "CHK_work_classifications_label" CHECK ("label" IN ('core', 'non_core'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_work_classifications_organisationId_kind_name" ON "work_classifications" ("organisationId", "kind", "name")`,
    );
    await queryRunner.query(`
      ALTER TABLE "work_classifications"
      ADD CONSTRAINT "FK_work_classifications_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "work_classifications"`);
  }
}
