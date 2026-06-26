import { applyDecorators } from '@nestjs/common';
import { ApiTenantHeader } from '../common/decorators/api-tenant-header.decorator';

/** Public routes that still require tenant resolution via header or subdomain. */
export function TenantScoped() {
  return applyDecorators(ApiTenantHeader(true));
}
