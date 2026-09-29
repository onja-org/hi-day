import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInviteLinks1790400000000 implements MigrationInterface {
  name = 'CreateInviteLinks1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invite_links" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organisationId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "role" "MembershipRole" NOT NULL,
        "teamIds" uuid array NOT NULL DEFAULT '{}',
        "projectIds" uuid array NOT NULL DEFAULT '{}',
        "expiresAt" TIMESTAMP(3),
        "usageCap" integer,
        "usageCount" integer NOT NULL DEFAULT 0,
        "enabled" boolean NOT NULL DEFAULT true,
        "token" character varying NOT NULL,
        "createdByUserId" uuid,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invite_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invite_links_token" UNIQUE ("token")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_invite_links_organisationId" ON "invite_links" ("organisationId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "invite_links" ADD CONSTRAINT "FK_invite_links_organisationId"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "invite_links" ADD CONSTRAINT "FK_invite_links_createdByUserId"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD "inviteLinkId" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "invitations" ADD CONSTRAINT "FK_invitations_inviteLinkId"
      FOREIGN KEY ("inviteLinkId") REFERENCES "invite_links"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "FK_invitations_inviteLinkId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN "inviteLinkId"`,
    );
    await queryRunner.query(`DROP TABLE "invite_links"`);
  }
}
