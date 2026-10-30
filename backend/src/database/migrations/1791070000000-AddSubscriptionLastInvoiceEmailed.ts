import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The last invoice a receipt was emailed for, so a retried webhook does not
 * send a second copy. Nullable: every existing row has had none sent.
 */
export class AddSubscriptionLastInvoiceEmailed1791070000000 implements MigrationInterface {
  name = 'AddSubscriptionLastInvoiceEmailed1791070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "lastInvoiceEmailedId" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "lastInvoiceEmailedId"`,
    );
  }
}
