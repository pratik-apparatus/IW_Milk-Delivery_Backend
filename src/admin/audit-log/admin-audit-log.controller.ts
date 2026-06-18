import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin | Audit Logs')
@AdminProtected()
@Controller('admin/audit-logs')
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent admin audit logs for current tenant' })
  getLogs(
    @Req() req: Request & { tenantId: string },
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(Number(limit) || 100, 500);
    return this.auditLogService.findByTenant(req.tenantId, parsedLimit);
  }
}
