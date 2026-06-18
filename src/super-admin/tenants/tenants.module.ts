import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantProvisioningJob } from '../../entities/tenant-provisioning-job.entity';
import { User } from '../../entities/user.entity';
import { Admin } from '../../entities/admin.entity';
import { InternalAuthModule } from '../../internal/auth/internal-auth.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantDbService } from './tenant-db.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, TenantProvisioningJob, User, Admin]),
    InternalAuthModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, TenantDbService],
  exports: [TenantsService, TenantDbService],
})
export class TenantsModule {}

