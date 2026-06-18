import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { NotificationIntegrationService } from './services/notification-integration.service';
import { TenantIntegrationConfigService } from './services/tenant-integration-config.service';
import { TenantContextService } from './services/tenant-context.service';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { EnabledAppsMiddleware } from './middleware/enabled-apps.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';

import { TenantDatabaseModule } from './database/tenant-database.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), TenantDatabaseModule],
  providers: [
    NotificationIntegrationService,
    TenantIntegrationConfigService,
    TenantContextService,
    TenantContextMiddleware,
    EnabledAppsMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [
    NotificationIntegrationService,
    TenantIntegrationConfigService,
    TenantContextService,
    TenantContextMiddleware,
    EnabledAppsMiddleware,
    TypeOrmModule,
  ],
})
export class CommonModule {}
