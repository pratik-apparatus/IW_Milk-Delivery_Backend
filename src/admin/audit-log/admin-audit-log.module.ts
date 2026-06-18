import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [AdminAuditLogController],
  providers: [
    AdminAuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminAuditInterceptor,
    },
  ],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
