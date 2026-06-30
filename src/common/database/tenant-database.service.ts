import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import {
  createTenantDataSource,
  runTenantMigrationsForDataSource,
  tenantHasBusinessTables,
} from './tenant-data-source.util';

@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseService.name);
  private readonly connections = new Map<string, DataSource>();

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** True when tenant has its own Postgres database name configured. */
  usesDedicatedDatabase(tenant: Tenant | null | undefined): boolean {
    return Boolean(tenant?.dbName);
  }

  /** Apply tenant migrations (and bootstrap schema on a brand-new empty database). */
  async initializeTenantSchema(tenant: Tenant): Promise<void> {
    const dataSource = createTenantDataSource(tenant, {
      includeMigrations: true,
    });
    await dataSource.initialize();

    try {
      const hasTables = await tenantHasBusinessTables(dataSource);
      if (!hasTables) {
        this.logger.log(
          `Bootstrapping empty tenant database: ${tenant.dbName}`,
        );
        await dataSource.synchronize();
      }

      await runTenantMigrationsForDataSource(
        dataSource,
        `${tenant.businessName} (${tenant.dbName})`,
      );
    } finally {
      await dataSource.destroy();
      this.connections.delete(tenant.id);
    }

    this.logger.log(`Tenant schema migrated: ${tenant.dbName}`);
  }

  /** Get (or create) a TypeORM connection for this tenant's business data. */
  async getTenantDataSource(tenantId: string): Promise<DataSource> {
    const cached = this.connections.get(tenantId);
    if (cached?.isInitialized) {
      return cached;
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt) {
      throw new ServiceUnavailableException('Tenant not found');
    }
    if (!this.usesDedicatedDatabase(tenant)) {
      throw new ServiceUnavailableException(
        'Tenant database is not configured. Set dbName and provision the tenant.',
      );
    }

    return this.createConnection(tenant);
  }

  /** Get a repository from a specific tenant database (for super-admin / internal calls). */
  async getRepositoryForTenant<T extends ObjectLiteral>(
    tenantId: string,
    entity: EntityTarget<T>,
  ): Promise<Repository<T>> {
    const dataSource = await this.getTenantDataSource(tenantId);
    return dataSource.getRepository(entity);
  }

  /** Runtime tenant connections never auto-sync schema — use tenant migrations instead. */
  private async createConnection(tenant: Tenant): Promise<DataSource> {
    const dataSource = createTenantDataSource(tenant);
    await dataSource.initialize();
    this.connections.set(tenant.id, dataSource);
    return dataSource;
  }

  async onModuleDestroy() {
    for (const [tenantId, dataSource] of this.connections.entries()) {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        this.logger.log(`Closed tenant DB connection: ${tenantId}`);
      }
    }
    this.connections.clear();
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const cached = this.connections.get(tenantId);
    if (!cached?.isInitialized) {
      return;
    }

    await cached.destroy();
    this.connections.delete(tenantId);
    this.logger.log(`Closed tenant DB connection: ${tenantId}`);
  }
}
