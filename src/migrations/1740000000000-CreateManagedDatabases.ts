import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateManagedDatabases1740000000000 implements MigrationInterface {
  name = 'CreateManagedDatabases1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "managed_databases_status_enum" AS ENUM ('AVAILABLE', 'ASSIGNED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "managed_databases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "displayName" character varying(150),
        "dbHost" character varying NOT NULL,
        "dbPort" integer NOT NULL,
        "dbName" character varying NOT NULL,
        "dbUser" character varying NOT NULL,
        "dbPassword" character varying NOT NULL,
        "status" "managed_databases_status_enum" NOT NULL DEFAULT 'AVAILABLE',
        "tenantId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_managed_databases" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_managed_databases_tenantId" UNIQUE ("tenantId"),
        CONSTRAINT "UQ_managed_databases_host_name" UNIQUE ("dbHost", "dbName")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "managedDatabaseId" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tenants"
        ADD CONSTRAINT "FK_tenants_managedDatabaseId"
        FOREIGN KEY ("managedDatabaseId") REFERENCES "managed_databases"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "FK_tenants_managedDatabaseId"
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "managedDatabaseId"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "managed_databases"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "managed_databases_status_enum"`);
  }
}
