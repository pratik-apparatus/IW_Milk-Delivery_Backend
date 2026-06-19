import { MigrationInterface, QueryRunner } from 'typeorm';
import { TENANT_BUSINESS_TABLES } from '../common/database/tenant-database.config';

/**
 * Removes tenant business tables from the platform (control-plane) database.
 * Those tables belong only in per-tenant databases (milk_tenant_*).
 */
export class DropTenantBusinessTablesFromPlatformDb1713262000000
  implements MigrationInterface
{
  name = 'DropTenantBusinessTablesFromPlatformDb1713262000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TENANT_BUSINESS_TABLES) {
      const quoted = table === 'order' ? '"order"' : table;
      await queryRunner.query(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
    }
  }

  public async down(): Promise<void> {
    // Intentionally empty — tenant tables must not be recreated on the platform DB.
  }
}
