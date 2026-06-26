import { MigrationInterface, QueryRunner } from 'typeorm';

/** Platform billing tables (may already exist from DB_SYNC on older environments). */
export class CreatePlatformBillingTables1713265000000 implements MigrationInterface {
  name = 'CreatePlatformBillingTables1713265000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "durationDays" integer NOT NULL DEFAULT 30,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_plans_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'tenant_subscriptions_status_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."tenant_subscriptions_status_enum" AS ENUM(
            'PENDING_PAYMENT', 'ACTIVE', 'CANCELLED', 'EXPIRED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "status" "public"."tenant_subscriptions_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT',
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "razorpayOrderId" character varying,
        "razorpayPaymentId" character varying,
        "paidAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_subscriptions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_admin_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_userId" UNIQUE ("userId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_plans"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."tenant_subscriptions_status_enum"`,
    );
  }
}
