import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Daily and weekly summary emails: each member's admin-set overrides and
 * their own opt-outs, and the table that records (and claims) every send.
 */
export class AddSummaryEmails1791200000000 implements MigrationInterface {
  name = 'AddSummaryEmails1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "personalSummaryEmails" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "teamSummaryEmails" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "summaryEmailOptOuts" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `CREATE TABLE "summary_email_sends" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organisationId" uuid NOT NULL, "membershipId" uuid NOT NULL, "kind" character varying(20) NOT NULL, "periodStart" character varying(10) NOT NULL, "sentAt" TIMESTAMP WITH TIME ZONE, "error" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_summary_email_sends_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_summary_email_sends_membership_kind_period" ON "summary_email_sends" ("membershipId", "kind", "periodStart")`,
    );
    await queryRunner.query(
      `ALTER TABLE "summary_email_sends" ADD CONSTRAINT "FK_summary_email_sends_organisationId" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "summary_email_sends" ADD CONSTRAINT "FK_summary_email_sends_membershipId" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "summary_email_sends" DROP CONSTRAINT "FK_summary_email_sends_membershipId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "summary_email_sends" DROP CONSTRAINT "FK_summary_email_sends_organisationId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_summary_email_sends_membership_kind_period"`,
    );
    await queryRunner.query(`DROP TABLE "summary_email_sends"`);
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "summaryEmailOptOuts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "teamSummaryEmails"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "personalSummaryEmails"`,
    );
  }
}
