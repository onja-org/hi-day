import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written, not generated: `migration:generate` picks up unrelated
// pre-existing schema drift in this dev DB (see ADR-0007) — the actual
// change here is a single nullable column.
export class AddRefreshTokenReplacedByHash1789480150704 implements MigrationInterface {
  name = 'AddRefreshTokenReplacedByHash1789480150704';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "replacedByTokenHash" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "replacedByTokenHash"`,
    );
  }
}
