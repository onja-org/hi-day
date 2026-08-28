import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthAndAuditLog1787664680971 implements MigrationInterface {
  name = 'AddAuthAndAuditLog1787664680971';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "organisationId" uuid, "actorUserId" uuid, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "emailVerificationExpiresAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pendingOrganisationName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pendingOrganisationAddress" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pendingOrganisationWebsite" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "slug" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD CONSTRAINT "UQ_db67ac918db3917134d0c9edbb3" UNIQUE ("slug")`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."OrganisationRegion" AS ENUM('us')`,
    );
    await queryRunner.query(
      `ALTER TABLE "organisations" ADD "region" "public"."OrganisationRegion" NOT NULL DEFAULT 'us'`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_c02c85fa675b6d61c6e9eb01b92" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_e36d23e1e7cf81ea77758bef795" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_e36d23e1e7cf81ea77758bef795"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_c02c85fa675b6d61c6e9eb01b92"`,
    );
    await queryRunner.query(`ALTER TABLE "organisations" DROP COLUMN "region"`);
    await queryRunner.query(`DROP TYPE "public"."OrganisationRegion"`);
    await queryRunner.query(
      `ALTER TABLE "organisations" DROP CONSTRAINT "UQ_db67ac918db3917134d0c9edbb3"`,
    );
    await queryRunner.query(`ALTER TABLE "organisations" DROP COLUMN "slug"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pendingOrganisationWebsite"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pendingOrganisationAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pendingOrganisationName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerificationExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerificationToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordHash"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
