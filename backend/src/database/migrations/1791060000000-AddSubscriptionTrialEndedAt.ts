import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the trial actually stopped, and the `active` status that says it has.
 *
 * Both are additive: existing rows keep `trialing` and a null
 * `trialEndedAt`, which is the truth for every Organisation that has not
 * paid. Nothing backfills, because nothing has paid through this flow yet.
 */
export class AddSubscriptionTrialEndedAt1791060000000 implements MigrationInterface {
  name = 'AddSubscriptionTrialEndedAt1791060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "trialEndedAt" TIMESTAMP(3)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "trialEndedAt"`,
    );
    // Postgres cannot drop a value from an enum type, so the type keeps
    // 'active'. Harmless: nothing reads it once the column is gone.
  }
}
