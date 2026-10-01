import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationDeletion1790700000000 implements MigrationInterface {
  name = 'AddOrganisationDeletion1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "ownerUserId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "deletionScheduledFor" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "suspendedAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "purgeAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD CONSTRAINT "FK_141fcb04f5b7abc8922227df541" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Backfill: the earliest admin Membership is the founding admin, who
    // was the only admin at creation.
    await queryRunner.query(
      `UPDATE "organisations" o SET "ownerUserId" = (
         SELECT m."userId" FROM "memberships" m
         WHERE m."organisationId" = o."id" AND m."role" = 'admin'
         ORDER BY m."createdAt" ASC LIMIT 1
       )`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."OrganisationDeletionMode" AS ENUM('now', 'scheduled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organisation_deletion_requests" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "tokenHash" character varying NOT NULL,
         "mode" "public"."OrganisationDeletionMode" NOT NULL,
         "scheduledFor" TIMESTAMP(3),
         "expiresAt" TIMESTAMP(3) NOT NULL,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
         "organisationId" uuid NOT NULL,
         "requestedByUserId" uuid NOT NULL,
         CONSTRAINT "PK_organisation_deletion_requests" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7e7938a4571b2fdafcd916084b" ON "organisation_deletion_requests" ("tokenHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisation_deletion_requests" ADD CONSTRAINT "FK_edefad3946fc2b219b3bab045f7" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisation_deletion_requests" ADD CONSTRAINT "FK_04701cd9110fa836fcbd1fdfb37" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "organisation_deletion_requests"`);
    await queryRunner.query(`DROP TYPE "public"."OrganisationDeletionMode"`);
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP CONSTRAINT "FK_141fcb04f5b7abc8922227df541"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "purgeAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "suspendedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "deletionScheduledFor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP COLUMN "ownerUserId"`,
    );
  }
}
