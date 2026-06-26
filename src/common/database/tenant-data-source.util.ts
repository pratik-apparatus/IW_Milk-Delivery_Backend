import { DataSource, DataSourceOptions } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TENANT_BUSINESS_ENTITIES } from './tenant-database.config';
import { getTypeOrmLogging } from './typeorm-options.util';
import {
  TENANT_MIGRATIONS,
  TENANT_MIGRATIONS_TABLE,
} from '../../tenant-migrations/tenant-migrations.registry';

export { TENANT_MIGRATIONS_TABLE };

export interface TenantDbConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface TenantDataSourceOptions {
  synchronize?: boolean;
  /** Only true for provisioning / migration scripts — not runtime API connections. */
  includeMigrations?: boolean;
}

export function resolveTenantDbConnection(
  tenant: Tenant,
  env: NodeJS.ProcessEnv = process.env,
): TenantDbConnectionConfig {
  return {
    host: env.TENANT_DB_HOST || tenant.dbHost || env.DB_HOST || 'localhost',
    port: Number(env.TENANT_DB_PORT || tenant.dbPort || env.DB_PORT || 5432),
    username: env.TENANT_DB_USER || tenant.dbUser || env.DB_USER || 'postgres',
    password:
      env.TENANT_DB_PASSWORD ||
      tenant.dbPassword ||
      env.DB_PASSWORD ||
      'postgres',
    database: tenant.dbName!,
  };
}

export function createPseudoTenantForDirectMigration(dbName: string): Tenant {
  return {
    dbName,
    dbHost: process.env.TENANT_DB_HOST || process.env.DB_HOST || 'localhost',
    dbPort: Number(process.env.TENANT_DB_PORT || process.env.DB_PORT || 5432),
    dbUser: process.env.TENANT_DB_USER || process.env.DB_USER || 'postgres',
    dbPassword:
      process.env.TENANT_DB_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  } as Tenant;
}

export function buildTenantDataSourceOptions(
  connection: TenantDbConnectionConfig,
  options: TenantDataSourceOptions = {},
): DataSourceOptions {
  const base: DataSourceOptions = {
    type: 'postgres',
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    database: connection.database,
    entities: TENANT_BUSINESS_ENTITIES,
    synchronize: options.synchronize ?? false,
    logging: getTypeOrmLoggingFromEnv(),
  };

  if (options.includeMigrations) {
    return {
      ...base,
      migrations: TENANT_MIGRATIONS,
      migrationsTableName: TENANT_MIGRATIONS_TABLE,
    };
  }

  return base;
}

export function createTenantDataSource(
  tenant: Tenant,
  options: TenantDataSourceOptions = {},
): DataSource {
  const connection = resolveTenantDbConnection(tenant);
  return new DataSource(buildTenantDataSourceOptions(connection, options));
}

export function createTenantDataSourceFromConfig(
  connection: TenantDbConnectionConfig,
  options: TenantDataSourceOptions = {},
): DataSource {
  return new DataSource(buildTenantDataSourceOptions(connection, options));
}

function getTypeOrmLoggingFromEnv(): boolean | ('error' | 'warn')[] {
  if (process.env.DB_LOGGING === 'true') {
    return true;
  }
  return ['error', 'warn'];
}

export async function tenantHasBusinessTables(
  dataSource: DataSource,
): Promise<boolean> {
  const result = await dataSource.query(`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('tenant_migrations', 'migrations')
  `);
  return Number(result[0]?.count || 0) > 0;
}

export async function runTenantMigrationsForDataSource(
  dataSource: DataSource,
  label: string,
): Promise<string[]> {
  const applied = await dataSource.runMigrations();
  if (applied.length === 0) {
    console.log(`  No pending tenant migrations for ${label}.`);
  } else {
    console.log(
      `  Applied ${applied.length} tenant migration(s) for ${label}:`,
    );
    applied.forEach((migration) => console.log(`    - ${migration.name}`));
  }
  return applied.map((migration) => migration.name);
}
