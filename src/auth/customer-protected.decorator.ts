import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiTenantHeader } from '../common/decorators/api-tenant-header.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

export function CustomerProtected() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiTenantHeader(true),
    UseGuards(JwtAuthGuard),
  );
}
