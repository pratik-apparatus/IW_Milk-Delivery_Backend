import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { TenantContextService } from '../services/tenant-context.service';
import { TenantDatabaseService } from './tenant-database.service';

/**
 * Use this for all tenant business tables (orders, products, customers, etc.).
 * Business data never lives in the platform database.
 */
@Injectable()
export class TenantRepositoryService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDatabase: TenantDatabaseService,
  ) {}

  async getRepository<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
  ): Promise<Repository<T>> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.tenantDatabase.getRepositoryForTenant(tenantId, entity);
  }
}
