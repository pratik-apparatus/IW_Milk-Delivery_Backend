import 'reflect-metadata';
import '../config/load-env';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../dataSource/data-source';
import { Tenant } from '../entities/tenant.entity';
import {
  createPseudoTenantForDirectMigration,
  createTenantDataSource,
  resolveTenantDbConnection,
  runTenantMigrationsForDataSource,
  tenantHasBusinessTables,
} from '../common/database/tenant-data-source.util';

type CliOptions = {
  all: boolean;
  tenantId?: string;
  dbName?: string;
  bootstrapEmpty: boolean;
  activeOnly: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    all: argv.includes('--all'),
    bootstrapEmpty: argv.includes('--bootstrap-empty'),
    activeOnly: argv.includes('--active-only'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1];
    }
    if (arg.startsWith('--db-name=')) {
      options.dbName = arg.split('=')[1];
    }
  }

  return options;
}

async function ensureTenantSchemaBootstrapped(
  dataSource: DataSource,
  label: string,
  forceBootstrap: boolean,
) {
  const hasTables = await tenantHasBusinessTables(dataSource);
  if (hasTables && !forceBootstrap) {
    return;
  }

  if (!hasTables || forceBootstrap) {
    console.log(`  Bootstrapping tenant DB ${label} (one-time schema sync)...`);
    await dataSource.synchronize();
  }
}

async function migrateTenantRecord(tenant: Tenant, bootstrapEmpty: boolean) {
  const connection = resolveTenantDbConnection(tenant);
  const label = `${tenant.businessName} (${connection.database} @ ${connection.host})`;
  console.log(`\nTenant: ${label}`);

  const dataSource = createTenantDataSource(tenant, { includeMigrations: true });
  await dataSource.initialize();

  try {
    await ensureTenantSchemaBootstrapped(dataSource, label, bootstrapEmpty);
    await runTenantMigrationsForDataSource(dataSource, label);
  } finally {
    await dataSource.destroy();
  }
}

async function migrateTenantByDbName(dbName: string, bootstrapEmpty: boolean) {
  const pseudoTenant = createPseudoTenantForDirectMigration(dbName);
  const connection = resolveTenantDbConnection(pseudoTenant);
  console.log(`\nTenant DB (direct): ${connection.database} @ ${connection.host}:${connection.port}`);

  const dataSource = createTenantDataSource(pseudoTenant, { includeMigrations: true });
  await dataSource.initialize();

  try {
    await ensureTenantSchemaBootstrapped(dataSource, connection.database, bootstrapEmpty);
    await runTenantMigrationsForDataSource(dataSource, connection.database);
  } finally {
    await dataSource.destroy();
  }
}

async function printTenantDiscoveryDiagnostics(tenantRepo: ReturnType<typeof AppDataSource.getRepository<Tenant>>) {
  const total = await tenantRepo.count();
  const withDbName = await tenantRepo
    .createQueryBuilder('tenant')
    .where('tenant.dbName IS NOT NULL')
    .getCount();
  const decommissioned = await tenantRepo
    .createQueryBuilder('tenant')
    .where('tenant.dbName IS NOT NULL')
    .andWhere('tenant.deletedAt IS NOT NULL')
    .getCount();

  console.log(`Platform DB: ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);
  console.log(`Tenants in platform DB: ${total} total, ${withDbName} with dbName, ${decommissioned} decommissioned`);

  if (withDbName > 0) {
    const sample = await tenantRepo
      .createQueryBuilder('tenant')
      .select(['tenant.businessName', 'tenant.dbName', 'tenant.dbHost', 'tenant.deletedAt'])
      .where('tenant.dbName IS NOT NULL')
      .orderBy('tenant.createdAt', 'ASC')
      .limit(5)
      .getMany();

    console.log('Registered tenant databases:');
    sample.forEach((tenant) => {
      const status = tenant.deletedAt ? 'decommissioned' : 'active';
      console.log(`  - ${tenant.businessName}: ${tenant.dbName} @ ${tenant.dbHost || '(uses DB_HOST)'} [${status}]`);
    });
  }

  if (process.env.TENANT_DB_HOST) {
    console.log(`TENANT_DB_HOST override: ${process.env.TENANT_DB_HOST} (all tenant connections use this host)`);
  } else {
    console.log('Tip: set TENANT_DB_HOST=localhost in .env.dev if tenant DBs are on local Postgres.');
  }
}

async function runTenantMigrations() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.all && !options.tenantId && !options.dbName) {
    console.error(`
Usage:
  npm run migration:tenant:run:dev -- --all
  npm run migration:tenant:run:dev -- --tenant-id=<uuid>
  npm run migration:tenant:run:dev -- --db-name=milk_tenant_001

Optional:
  --bootstrap-empty   Re-sync base tenant tables from entities before running migrations
  --active-only       Only migrate tenants that are not decommissioned (default: include all with dbName)

Note:
  --all reads tenant list from the PLATFORM database (${process.env.DB_NAME || 'DB_NAME'}).
  For a local DB not registered in platform, use --db-name=milk_tenant_001
  and set TENANT_DB_HOST=localhost in .env.dev if needed.
`);
    process.exit(1);
  }

  try {
    console.log('=== Tenant DB migrations ===');

    if (options.dbName) {
      await migrateTenantByDbName(options.dbName, options.bootstrapEmpty);
      console.log('\nTenant migrations completed.');
      process.exit(0);
    }

    await AppDataSource.initialize();
    const tenantRepo = AppDataSource.getRepository(Tenant);

    let tenants: Tenant[] = [];
    if (options.tenantId) {
      const tenant = await tenantRepo.findOne({ where: { id: options.tenantId } });
      if (!tenant?.dbName) {
        throw new Error(`Tenant ${options.tenantId} not found or has no dbName configured.`);
      }
      tenants = [tenant];
    } else if (options.all) {
      const qb = tenantRepo
        .createQueryBuilder('tenant')
        .where('tenant.dbName IS NOT NULL')
        .orderBy('tenant.createdAt', 'ASC');

      if (options.activeOnly) {
        qb.andWhere('tenant.deletedAt IS NULL');
      }

      tenants = await qb.getMany();
    }

    if (tenants.length === 0) {
      await printTenantDiscoveryDiagnostics(tenantRepo);
      console.log('\nNo tenant databases matched the migration query.');
      if (!options.activeOnly) {
        console.log('Use --db-name=milk_tenant_001 for a local DB not listed above.');
      } else {
        console.log('Try again without --active-only to include decommissioned tenants.');
      }
      await AppDataSource.destroy();
      process.exit(0);
    }

    await AppDataSource.destroy();

    for (const tenant of tenants) {
      await migrateTenantRecord(tenant, options.bootstrapEmpty);
    }

    console.log(`\nTenant migrations completed for ${tenants.length} database(s).`);
    process.exit(0);
  } catch (error) {
    console.error('Tenant migration failed:', error);
    process.exit(1);
  }
}

runTenantMigrations();
