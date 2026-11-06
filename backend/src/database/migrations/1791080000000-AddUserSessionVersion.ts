import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The per-user counter access tokens are checked against, so "sign out
 * everywhere" and password reset can end sessions before their access token
 * expires. Defaults to 0, which is what a token without the claim counts as,
 * so existing sessions stay valid.
 */
export class AddUserSessionVersion1791080000000 implements MigrationInterface {
  name = 'AddUserSessionVersion1791080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "sessionVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sessionVersion"`);
  }
}
