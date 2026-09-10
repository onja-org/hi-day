import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUrlSessions1788620000000 implements MigrationInterface {
  name = 'CreateUrlSessions1788620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // An earlier, since-abandoned attempt at this same feature created a
    // `url_activities` table (no entity/migration for it survives in this
    // tree, and it holds zero rows) shaped for a design that never matched
    // the pinned client wire contract (docs/url-tracking-api.md) — missing
    // host/path/browser/private/activeMs/tzOffsetMin/source/confidence
    // entirely. Dropped here rather than ALTERed forward, same reasoning
    // as CreateTimeEntries1788504732663's own drop-and-recreate.
    await queryRunner.query(`DROP TABLE IF EXISTS "url_activities"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "UrlCaptureGap"`);

    await queryRunner.query(
      `CREATE TYPE "UrlSessionSource" AS ENUM('apple-events', 'ax', 'uia', 'atspi', 'title')`,
    );
    await queryRunner.query(
      `CREATE TYPE "UrlSessionConfidence" AS ENUM('exact', 'displayed', 'guess')`,
    );
    await queryRunner.query(`
      CREATE TABLE "url_sessions" (
        "id" uuid NOT NULL,
        "organisationId" uuid NOT NULL,
        "membershipId" uuid NOT NULL,
        "deviceId" uuid NOT NULL,
        "url" character varying NOT NULL,
        "host" character varying NOT NULL,
        "path" character varying,
        "title" character varying,
        "browser" character varying NOT NULL,
        "private" boolean,
        "startedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "endedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
        "activeMs" integer NOT NULL,
        "tzOffsetMin" integer NOT NULL,
        "source" "UrlSessionSource" NOT NULL,
        "confidence" "UrlSessionConfidence" NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_url_sessions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_url_sessions_membershipId" ON "url_sessions" ("membershipId")`,
    );
    // The grouped-by-URL listing (see UrlSessionsService.listGroupedByUrl)
    // filters/groups by exactly this pair.
    await queryRunner.query(
      `CREATE INDEX "IDX_url_sessions_membershipId_url" ON "url_sessions" ("membershipId", "url")`,
    );

    await queryRunner.query(
      `ALTER TABLE "url_sessions" ADD CONSTRAINT "FK_url_sessions_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "url_sessions" ADD CONSTRAINT "FK_url_sessions_membershipId" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "url_sessions" ADD CONSTRAINT "FK_url_sessions_deviceId" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "url_sessions"`);
    await queryRunner.query(`DROP TYPE "UrlSessionSource"`);
    await queryRunner.query(`DROP TYPE "UrlSessionConfidence"`);
  }
}
