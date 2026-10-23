import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two halves of keeping browser time that cannot be read visible rather
 * than silently missing (docs/adr/0027-...):
 *
 * - `unknown` confidence: a focused browser window whose address could not
 *   be read at all, stored with an empty url and host.
 * - The desktop agent's report of whether URL capture works on a Device,
 *   alongside the app-capture columns from
 *   `1791020000000-AddDeviceAppCaptureHealth`.
 *
 * Hand-written, same reasoning as that migration.
 */
export class AddUrlUnknownAndDeviceUrlCaptureHealth1791030000000 implements MigrationInterface {
  name = 'AddUrlUnknownAndDeviceUrlCaptureHealth1791030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."UrlSessionConfidence" ADD VALUE IF NOT EXISTS 'unknown'`,
    );
    await queryRunner.query(
      `CREATE TYPE "UrlCaptureStatus" AS ENUM('ok', 'degraded', 'unavailable')`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD "urlCaptureStatus" "UrlCaptureStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD "urlCaptureDetail" character varying`,
    );
  }

  // Postgres can't drop a single enum value, so unknown-URL sessions go and
  // the type is rebuilt without 'unknown'.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "devices" DROP COLUMN "urlCaptureDetail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP COLUMN "urlCaptureStatus"`,
    );
    await queryRunner.query(`DROP TYPE "UrlCaptureStatus"`);
    await queryRunner.query(
      `DELETE FROM "url_sessions" WHERE "confidence" = 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."UrlSessionConfidence" RENAME TO "UrlSessionConfidence_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."UrlSessionConfidence" AS ENUM('exact', 'displayed', 'guess')`,
    );
    await queryRunner.query(
      `ALTER TABLE "url_sessions" ALTER COLUMN "confidence" TYPE "public"."UrlSessionConfidence" USING "confidence"::text::"public"."UrlSessionConfidence"`,
    );
    await queryRunner.query(`DROP TYPE "public"."UrlSessionConfidence_old"`);
  }
}
