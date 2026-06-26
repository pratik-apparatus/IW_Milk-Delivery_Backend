import { MigrationInterface, QueryRunner } from 'typeorm';

/** @deprecated Business tables live in per-tenant DBs only. Kept as no-op for migration history. */
export class AddTenantIdToBusinessTables1713261000000 implements MigrationInterface {
  name = 'AddTenantIdToBusinessTables1713261000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
