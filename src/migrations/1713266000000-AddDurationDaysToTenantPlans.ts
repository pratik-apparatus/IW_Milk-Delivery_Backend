import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDurationDaysToTenantPlans1713266000000 implements MigrationInterface {
  name = 'AddDurationDaysToTenantPlans1713266000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_plans"
      ADD COLUMN IF NOT EXISTS "durationDays" integer NOT NULL DEFAULT 30
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_plans"
      DROP COLUMN IF EXISTS "durationDays"
    `);
  }
}
