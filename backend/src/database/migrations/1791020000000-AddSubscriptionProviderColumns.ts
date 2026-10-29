import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where Stripe's own records live once an admin has paid.
 *
 * All nullable, because most Subscriptions never get them: a self-hosted
 * install has no Stripe, a free-by-config Organisation never checks out, and
 * one still on trial has nothing with the provider yet.
 *
 * `stripeStatus` is deliberately separate from `status`. Ours is a decision,
 * Stripe's is a fact, and a single column holding both is how a webhook ends
 * up overwriting something we meant.
 *
 * Hand-written, same reasoning as `1791000000000-CreateSubscriptionTrials`.
 */
export class AddSubscriptionProviderColumns1791020000000 implements MigrationInterface {
  name = 'AddSubscriptionProviderColumns1791020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "stripeCustomerId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "stripeSubscriptionId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "stripeStatus" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "billingPeriod" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "currentPeriodEnd" TIMESTAMP(3)`,
    );
    // Partial: one Stripe subscription belongs to one Organisation, but the
    // many rows with no subscription at all must not collide with each other.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscriptions_stripeSubscriptionId" ON "subscriptions" ("stripeSubscriptionId") WHERE "stripeSubscriptionId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_subscriptions_stripeSubscriptionId"`,
    );
    for (const column of [
      'currentPeriodEnd',
      'billingPeriod',
      'stripeStatus',
      'stripeSubscriptionId',
      'stripeCustomerId',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "subscriptions" DROP COLUMN "${column}"`,
      );
    }
  }
}
