import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinuxDevicePlatform1788427859449 implements MigrationInterface {
  name = 'AddLinuxDevicePlatform1788427859449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."DevicePlatform" ADD VALUE 'linux'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."DevicePlatform_old" AS ENUM('windows', 'macos', 'ios', 'android')`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ALTER COLUMN "platform" TYPE "public"."DevicePlatform_old" USING "platform"::"text"::"public"."DevicePlatform_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."DevicePlatform"`);
    await queryRunner.query(
      `ALTER TYPE "public"."DevicePlatform_old" RENAME TO "DevicePlatform"`,
    );
  }
}
