import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppConfigsTable1713259000000 implements MigrationInterface {
  name = 'CreateAppConfigsTable1713259000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "logoUrl" character varying(500),
        "theme" character varying(100),
        "primaryColor" character varying(50),
        "secondaryColor" character varying(50),
        "styleVariables" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "fontFamily" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_configs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_app_configs_tenantId" UNIQUE ("tenantId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_app_configs_tenantId" ON "app_configs" ("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_app_configs_tenantId"`);
    await queryRunner.query(`DROP TABLE "app_configs"`);
  }
}
