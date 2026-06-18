import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { TenantMatchGuard } from './tenant-match.guard';
import { AdminTenantResolverGuard } from './admin-tenant-resolver.guard';

export function AdminProtected() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiHeader({
      name: 'x-tenant-id',
      required: false,
      description:
        'Tenant UUID. Optional for tenant ADMIN if the JWT already contains tenantId.',
    }),
    UseGuards(
      JwtAuthGuard,
      RolesGuard,
      AdminTenantResolverGuard,
      TenantMatchGuard,
    ),
    Roles('ADMIN'),
  );
}
