import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationAcceptanceAndMembershipStatus1788268543393 implements MigrationInterface {
  name = 'AddInvitationAcceptanceAndMembershipStatus1788268543393';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "UQ_e577dcf9bb6d084373ed3998509"`,
    );
    await queryRunner.query(`ALTER TABLE "invitations" DROP COLUMN "token"`);
    await queryRunner.query(
      `CREATE TYPE "public"."MembershipStatus" AS ENUM('active', 'deactivated')`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "status" "public"."MembershipStatus" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD "deactivatedAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "tokenHash" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "UQ_a6eb6f2543de8a5a4c148b32a18" UNIQUE ("tokenHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "acceptedAt" TIMESTAMP(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "invitedByUserId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "FK_b7423cfb362a842b7ea0a3763b9" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "FK_b7423cfb362a842b7ea0a3763b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN "invitedByUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN "acceptedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "UQ_a6eb6f2543de8a5a4c148b32a18"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN "tokenHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP COLUMN "deactivatedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "memberships" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."MembershipStatus"`);
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "token" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "UQ_e577dcf9bb6d084373ed3998509" UNIQUE ("token")`,
    );
  }
}
