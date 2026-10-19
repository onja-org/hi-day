import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An Organisation's billing state, which today means only its 14-day trial:
 * signup takes no card, so a new Organisation can start as nothing else.
 *
 * Organisations that already existed deliberately get **no row**. They were
 * never offered a trial, so backdating one would strand them as "expired"
 * from the moment this runs, and granting a fresh 14 days would hand out
 * something nobody signed up for. A missing row is how "never trialled"
 * is spelled, and the banner and reminder job both treat it as nothing to
 * say.
 *
 * Hand-written rather than generated: `migration:generate` currently also
 * emits a repo-wide rename of every hand-named foreign-key constraint,
 * which is pre-existing drift unrelated to this table.
 */
export class CreateSubscriptionTrials1791000000000 implements MigrationInterface {
  name = 'CreateSubscriptionTrials1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."SubscriptionStatus" AS ENUM('trialing')`,
    );
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'trialing',
        "trialStartedAt" TIMESTAMP(3) NOT NULL,
        "trialEndsAt" TIMESTAMP(3) NOT NULL,
        "trialReminderSentAtDaysLeft" integer,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id")
      )
    `);
    // One subscription per Organisation, enforced rather than assumed: two
    // would mean two answers to "how long is left?".
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscriptions_organisationId" ON "subscriptions" ("organisationId")`,
    );
    // The reminder job sweeps by end date, so it reads an index rather than
    // every subscription in the system.
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_trialEndsAt" ON "subscriptions" ("trialEndsAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD CONSTRAINT "FK_subscriptions_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."SubscriptionStatus"`);
  }
}
