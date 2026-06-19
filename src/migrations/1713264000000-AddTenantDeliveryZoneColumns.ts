import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantDeliveryZoneColumns1713264000000
  implements MigrationInterface
{
  name = 'AddTenantDeliveryZoneColumns1713264000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "adminAddress" character varying,
      ADD COLUMN IF NOT EXISTS "adminLatitude" numeric(10,7),
      ADD COLUMN IF NOT EXISTS "adminLongitude" numeric(10,7),
      ADD COLUMN IF NOT EXISTS "deliveryRadiusKm" numeric(8,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "adminAddress",
      DROP COLUMN IF EXISTS "adminLatitude",
      DROP COLUMN IF EXISTS "adminLongitude",
      DROP COLUMN IF EXISTS "deliveryRadiusKm"
    `);
  }
}
