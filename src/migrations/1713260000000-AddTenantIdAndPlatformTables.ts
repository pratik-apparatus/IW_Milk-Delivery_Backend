import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIdAndPlatformTables1713260000000
  implements MigrationInterface
{
  name = 'AddTenantIdAndPlatformTables1713260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "tenantId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_tenantId" ON "user" ("tenantId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "role" character varying(64) NOT NULL,
        "tenantId" uuid,
        "tokenHash" character varying(128) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refresh_tokens_tokenHash" UNIQUE ("tokenHash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "deletedAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_tenantId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "tenantId"`);
  }
}
