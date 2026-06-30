import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminAuditLogsTable1713264000000 implements MigrationInterface {
  name = 'CreateAdminAuditLogsTable1713264000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "adminId" uuid NOT NULL,
        "method" character varying(10) NOT NULL,
        "path" character varying(500) NOT NULL,
        "action" character varying(150),
        "statusCode" integer,
        "ipAddress" character varying(64),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_tenantId"
      ON "admin_audit_logs" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_adminId"
      ON "admin_audit_logs" ("adminId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_createdAt"
      ON "admin_audit_logs" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
  }
}
