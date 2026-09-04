import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1788460000000 implements MigrationInterface {
  name = 'AddUserProfileFields1788460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "firstName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "lastName" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" text`);

    await queryRunner.query(`
      UPDATE "users"
      SET
        "firstName" = NULLIF(split_part("name", ' ', 1), ''),
        "lastName" = NULLIF(substr("name", length(split_part("name", ' ', 1)) + 2), '')
      WHERE "name" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastName"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firstName"`);
  }
}
