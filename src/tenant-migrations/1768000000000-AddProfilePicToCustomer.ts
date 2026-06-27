import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfilePicToCustomer1768000000000 implements MigrationInterface {
  name = 'AddProfilePicToCustomer1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer"
      ADD COLUMN IF NOT EXISTS "profilePic" character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer" DROP COLUMN IF EXISTS "profilePic"
    `);
  }
}
