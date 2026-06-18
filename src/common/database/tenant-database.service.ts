import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TENANT_BUSINESS_ENTITIES } from './tenant-database.config';

@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseService.name);
  private readonly connections = new Map<string, DataSource>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** True when tenant has its own Postgres database name configured. */
  usesDedicatedDatabase(tenant: Tenant | null | undefined): boolean {
    return Boolean(tenant?.dbName);
  }

  /** Create tables inside the tenant database (runs once after CREATE DATABASE). */
  async initializeTenantSchema(tenant: Tenant): Promise<void> {
    const dataSource = await this.createConnection(tenant, true);
    await dataSource.destroy();
    this.connections.delete(tenant.id);
    this.logger.log(`Schema initialized for tenant database: ${tenant.dbName}`);
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

    return this.createConnection(tenant, false);
  }

  /** Get a repository from a specific tenant database (for super-admin / internal calls). */
  async getRepositoryForTenant<T extends ObjectLiteral>(
    tenantId: string,
    entity: EntityTarget<T>,
  ): Promise<Repository<T>> {
    const dataSource = await this.getTenantDataSource(tenantId);
    return dataSource.getRepository(entity);
  }

  private async createConnection(
    tenant: Tenant,
    initializeSchema: boolean,
  ): Promise<DataSource> {
    const dataSource = new DataSource({
      type: 'postgres',
      host: tenant.dbHost || this.configService.get('DB_HOST') || 'localhost',
      port: tenant.dbPort || Number(this.configService.get('DB_PORT') || 5432),
      username: tenant.dbUser || this.configService.get('DB_USER') || 'postgres',
      password:
        tenant.dbPassword || this.configService.get('DB_PASSWORD') || 'postgres',
      database: tenant.dbName!,
      entities: TENANT_BUSINESS_ENTITIES,
      synchronize: initializeSchema,
      logging: this.configService.get('NODE_ENV') === 'development',
    });

    await dataSource.initialize();

    if (!initializeSchema) {
      this.connections.set(tenant.id, dataSource);
    }

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
}
