import { MigrationInterface, QueryRunner } from 'typeorm';

/** @deprecated Tenant table — lives in per-tenant DBs only. Kept as no-op for migration history. */
export class CreateAppConfigsTable1713259000000 implements MigrationInterface {
  name = 'CreateAppConfigsTable1713259000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // app_configs belongs in tenant databases, not the platform DB.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
