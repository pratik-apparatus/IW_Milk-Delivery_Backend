import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDatabaseService } from './tenant-database.service';
import { TenantRepositoryService } from './tenant-repository.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantDatabaseService, TenantRepositoryService],
  exports: [TenantDatabaseService, TenantRepositoryService],
})
export class TenantDatabaseModule {}
