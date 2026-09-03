import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDevicesAndDeviceSessions1788425975987 implements MigrationInterface {
  name = 'AddDevicesAndDeviceSessions1788425975987';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."DevicePlatform" AS ENUM('windows', 'macos', 'ios', 'android')`,
    );
    await queryRunner.query(
      `CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceFingerprint" character varying NOT NULL, "platform" "public"."DevicePlatform" NOT NULL, "osVersion" character varying, "hostname" character varying, "appVersion" character varying, "lastSeenAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "organisationId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "UQ_e7f77680f8a2d69efed7e6c5392" UNIQUE ("deviceFingerprint"), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "revokedAt" TIMESTAMP(3), "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "deviceId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_94d0c25305680904fc03285a38e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a3ce4855b680cf7c6eb621e4f5" ON "device_sessions"  ("tokenHash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD CONSTRAINT "FK_fe67080cf24f8eeca42c9272a14" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" ADD CONSTRAINT "FK_e8a5d59f0ac3040395f159507c6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_1a58500a3b9369f33812a360f15" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_sessions" ADD CONSTRAINT "FK_336070a77b04552cd1640dc56a7" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_336070a77b04552cd1640dc56a7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_sessions" DROP CONSTRAINT "FK_1a58500a3b9369f33812a360f15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP CONSTRAINT "FK_e8a5d59f0ac3040395f159507c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "devices" DROP CONSTRAINT "FK_fe67080cf24f8eeca42c9272a14"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a3ce4855b680cf7c6eb621e4f5"`,
    );
    await queryRunner.query(`DROP TABLE "device_sessions"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TYPE "public"."DevicePlatform"`);
  }
}
