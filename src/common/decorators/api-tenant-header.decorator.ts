import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export function ApiTenantHeader(required = true) {
  return applyDecorators(
    ApiHeader({
      name: 'x-tenant-id',
      required,
      description: required
        ? 'Tenant UUID. Required unless the request Host subdomain resolves the tenant.'
        : 'Tenant UUID. Optional if the request Host subdomain resolves the tenant, or when tenant is inferred another way.',
    }),
  );
}
