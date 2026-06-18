import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'category',
  'product',
  'banner',
  '"order"',
  'order_item',
  'cart',
  'subscription',
  'subscription_delivery_logs',
  'payment',
  'wallet',
  'wallet_transaction',
  'delivery_partners',
  'delivery_partner_locations',
];

export class AddTenantIdToBusinessTables1713261000000
  implements MigrationInterface
{
  name = 'AddTenantIdToBusinessTables1713261000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "tenantId" uuid`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table.replace(/"/g, '')}_tenantId" ON ${table} ("tenantId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_${table.replace(/"/g, '')}_tenantId"`,
      );
      await queryRunner.query(
        `ALTER TABLE ${table} DROP COLUMN IF EXISTS "tenantId"`,
      );
    }
  }
}
