import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Browsers that skip the two-step login code after "don't ask again"
 * (ADR 0038). Only the hash of each browser's token is stored.
 */
export class AddTwoFactorTrustedBrowsers1791190000000 implements MigrationInterface {
  name = 'AddTwoFactorTrustedBrowsers1791190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "two_factor_trusted_browsers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), CONSTRAINT "PK_84788e0917c8ece9f2e39660b51" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6b2c5eb335a925c197c9ca7b07" ON "two_factor_trusted_browsers" ("userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_07cbed715c2b7b82ba69f637a5" ON "two_factor_trusted_browsers" ("tokenHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "two_factor_trusted_browsers" ADD CONSTRAINT "FK_6b2c5eb335a925c197c9ca7b07c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "two_factor_trusted_browsers" DROP CONSTRAINT "FK_6b2c5eb335a925c197c9ca7b07c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_07cbed715c2b7b82ba69f637a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6b2c5eb335a925c197c9ca7b07"`,
    );
    await queryRunner.query(`DROP TABLE "two_factor_trusted_browsers"`);
  }
}
