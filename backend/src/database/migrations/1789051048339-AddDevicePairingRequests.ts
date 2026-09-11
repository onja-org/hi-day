import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDevicePairingRequests1789051048339 implements MigrationInterface {
  name = 'AddDevicePairingRequests1789051048339';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "device_pairing_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "codeHash" character varying NOT NULL, "deviceFingerprint" character varying NOT NULL, "platform" "public"."DevicePlatform" NOT NULL, "osVersion" character varying, "hostname" character varying, "appVersion" character varying, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP(3) NOT NULL, "approvedByUserId" uuid, "approvedOrganisationId" uuid, "approvedAt" TIMESTAMP(3), "claimedAt" TIMESTAMP(3), CONSTRAINT "UQ_aef2d93f588b122a91872c07cda" UNIQUE ("codeHash"), CONSTRAINT "PK_0a61319179e30943a6c57241514" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_pairing_requests" ADD CONSTRAINT "FK_1eb38440c7833527724c9c8ef63" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_pairing_requests" ADD CONSTRAINT "FK_add44280663b4dd3fede29f063f" FOREIGN KEY ("approvedOrganisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_pairing_requests" DROP CONSTRAINT "FK_add44280663b4dd3fede29f063f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_pairing_requests" DROP CONSTRAINT "FK_1eb38440c7833527724c9c8ef63"`,
    );
    await queryRunner.query(`DROP TABLE "device_pairing_requests"`);
  }
}
