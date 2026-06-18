import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantProvisioningJobsTable1713258000000
  implements MigrationInterface
{
  name = 'CreateTenantProvisioningJobsTable1713258000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_provisioning_jobs_status_enum" AS ENUM('PENDING', 'RUNNING', 'FAILED', 'DONE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "tenant_provisioning_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "status" "public"."tenant_provisioning_jobs_status_enum" NOT NULL DEFAULT 'PENDING',
        "steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "lastError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_provisioning_jobs_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenant_provisioning_jobs"`);
    await queryRunner.query(
      `DROP TYPE "public"."tenant_provisioning_jobs_status_enum"`,
    );
  }
}

