import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two-step login (ADR 0038): the authenticator secret and login challenge
 * on `users`, and one-time recovery codes in a table of their own. Every
 * existing account starts with it off.
 */
export class AddTwoStepLogin1791170000000 implements MigrationInterface {
  name = 'AddTwoStepLogin1791170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorEnabledAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorSecret" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorPendingSecret" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorLastUsedStep" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorChallengeHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorChallengeExpiresAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_752f583e17601a5e4b5cb54d56" ON "users" ("twoFactorChallengeHash")`,
    );

    await queryRunner.query(
      `CREATE TABLE "two_factor_recovery_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "codeHash" character varying NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), CONSTRAINT "PK_6f535a18c9fb9da8cc9b7ea70dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8bb7fb08d5097dc938cef1e4a" ON "two_factor_recovery_codes" ("userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c49221e9b3b8bacee151bb7675" ON "two_factor_recovery_codes" ("codeHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "FK_b8bb7fb08d5097dc938cef1e4ac" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "two_factor_recovery_codes" DROP CONSTRAINT "FK_b8bb7fb08d5097dc938cef1e4ac"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c49221e9b3b8bacee151bb7675"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8bb7fb08d5097dc938cef1e4a"`,
    );
    await queryRunner.query(`DROP TABLE "two_factor_recovery_codes"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_752f583e17601a5e4b5cb54d56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorChallengeExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorChallengeHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorLastUsedStep"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorPendingSecret"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorSecret"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorEnabledAt"`,
    );
  }
}
