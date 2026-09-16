import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUrlSessionsMembershipStartedAtIndex1789610000000 implements MigrationInterface {
  name = 'AddUrlSessionsMembershipStartedAtIndex1789610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backs UrlSessionsService.getDayGroupedByUrl, which filters one day's
    // rows by membershipId + a startedAt range for the URL activity page's
    // hour-bucketed view — the existing membershipId-only index isn't
    // enough for that range scan.
    await queryRunner.query(
      `CREATE INDEX "IDX_url_sessions_membershipId_startedAt" ON "url_sessions" ("membershipId", "startedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_url_sessions_membershipId_startedAt"`,
    );
  }
}
