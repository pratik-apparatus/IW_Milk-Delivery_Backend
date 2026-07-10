import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDbService } from '../tenants/tenant-db.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantDbService],
  exports: [TenantDbService],
})
export class TenantDbModule {}
