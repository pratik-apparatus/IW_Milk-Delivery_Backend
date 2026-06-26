import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminRole1713257000000 implements MigrationInterface {
  name = 'AddSuperAdminRole1713257000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'user_role_enum' AND n.nspname = 'public'
        ) THEN
          ALTER TYPE "public"."user_role_enum" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
        END IF;
      END
      $$;
      `,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL enum value removal is not safely reversible.
  }
}
