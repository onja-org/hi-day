import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written, same reasoning as the other recent migrations in this
 * folder — this dev DB's schema has drifted from what `migration:generate`
 * expects (see docs/adr/0007-...).
 *
 * Two partial unique indexes on `disclosure_versions` enforce the
 * draft/publish invariants described on the entity itself: at most one
 * `draft` row per `(organisationId, disclosureRegion)`, and at most one
 * `published` row per `(organisationId, disclosureRegion, version)`.
 * `disclosureRegion` is nullable, and Postgres treats NULLs as distinct for
 * plain uniqueness — so both indexes wrap it in `COALESCE(..., '')` to
 * treat "no region" as one specific value instead of "anything goes".
 */
export class CreateDisclosureAndConsent1789100000000 implements MigrationInterface {
  name = 'CreateDisclosureAndConsent1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "disclosureRegion" character varying`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."DisclosureVersionStatus" AS ENUM('draft', 'published')`,
    );
    await queryRunner.query(`
      CREATE TABLE "disclosure_versions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "disclosureRegion" character varying,
        "text" text NOT NULL,
        "status" "public"."DisclosureVersionStatus" NOT NULL,
        "version" integer,
        "publishedAt" TIMESTAMP(3),
        "publishedByMembershipId" uuid,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_disclosure_versions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_disclosure_versions_org_region_status" ON "disclosure_versions" ("organisationId", "disclosureRegion", "status")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_disclosure_versions_draft"
      ON "disclosure_versions" ("organisationId", COALESCE("disclosureRegion", ''))
      WHERE "status" = 'draft'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_disclosure_versions_published_version"
      ON "disclosure_versions" ("organisationId", COALESCE("disclosureRegion", ''), "version")
      WHERE "status" = 'published'
    `);
    await queryRunner.query(`
      ALTER TABLE "disclosure_versions" ADD CONSTRAINT "FK_disclosure_versions_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "disclosure_versions" ADD CONSTRAINT "FK_disclosure_versions_publishedByMembershipId"
      FOREIGN KEY ("publishedByMembershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."ConsentDecision" AS ENUM('granted', 'declined')`,
    );
    await queryRunner.query(`
      CREATE TABLE "consent_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "deviceId" uuid NOT NULL,
        "disclosureVersionId" uuid NOT NULL,
        "decision" "public"."ConsentDecision" NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consent_records_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_consent_records_deviceId_disclosureVersionId_createdAt" ON "consent_records" ("deviceId", "disclosureVersionId", "createdAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "consent_records" ADD CONSTRAINT "FK_consent_records_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_records" ADD CONSTRAINT "FK_consent_records_membershipId"
      FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_records" ADD CONSTRAINT "FK_consent_records_deviceId"
      FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "consent_records" ADD CONSTRAINT "FK_consent_records_disclosureVersionId"
      FOREIGN KEY ("disclosureVersionId") REFERENCES "disclosure_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "consent_records"`);
    await queryRunner.query(`DROP TYPE "public"."ConsentDecision"`);
    await queryRunner.query(`DROP TABLE "disclosure_versions"`);
    await queryRunner.query(`DROP TYPE "public"."DisclosureVersionStatus"`);
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "disclosureRegion"`,
    );
  }
}
