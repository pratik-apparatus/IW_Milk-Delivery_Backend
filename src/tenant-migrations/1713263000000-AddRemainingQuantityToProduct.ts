import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRemainingQuantityToProduct1713263000000 implements MigrationInterface {
  name = 'AddRemainingQuantityToProduct1713263000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product"
      ADD COLUMN IF NOT EXISTS "remainingQuantity" integer
    `);

    await queryRunner.query(`
      UPDATE "product"
      SET "remainingQuantity" = "quantity"
      WHERE "remainingQuantity" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "product"
      ALTER COLUMN "remainingQuantity" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product" DROP COLUMN IF EXISTS "remainingQuantity"
    `);
  }
}
