import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsTable1713256000000 implements MigrationInterface {
  name = 'CreateTenantsTable1713256000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."tenants_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'INACTIVE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessName" character varying(150) NOT NULL,
        "subdomain" character varying(100) NOT NULL,
        "logoUrl" character varying,
        "adminEmail" character varying NOT NULL,
        "supportEmail" character varying,
        "supportPhone" character varying,
        "status" "public"."tenants_status_enum" NOT NULL DEFAULT 'INACTIVE',
        "dbHost" character varying,
        "dbPort" integer,
        "dbName" character varying,
        "dbUser" character varying,
        "dbPassword" character varying,
        "enabledApps" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "appSettings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "integrationConfig" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "suspensionReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenants_subdomain" UNIQUE ("subdomain")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TYPE "public"."tenants_status_enum"`);
  }
}
