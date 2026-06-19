import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { TenantMatchGuard } from './tenant-match.guard';
import { AdminTenantResolverGuard } from './admin-tenant-resolver.guard';
import { AdminSubscriptionGuard } from './admin-subscription.guard';

function adminAuthGuards(includeSubscriptionCheck: boolean) {
  const guards: Array<
    | typeof JwtAuthGuard
    | typeof RolesGuard
    | typeof AdminTenantResolverGuard
    | typeof TenantMatchGuard
    | typeof AdminSubscriptionGuard
  > = [
    JwtAuthGuard,
    RolesGuard,
    AdminTenantResolverGuard,
    TenantMatchGuard,
  ];

  if (includeSubscriptionCheck) {
    guards.push(AdminSubscriptionGuard);
  }

  return guards;
}

export function AdminProtected() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiHeader({
      name: 'x-tenant-id',
      required: false,
      description:
        'Tenant UUID. Optional for tenant ADMIN if the JWT already contains tenantId.',
    }),
    UseGuards(...adminAuthGuards(true)),
    Roles('ADMIN'),
  );
}

/** Admin auth without subscription gate — for billing/payment endpoints. */
export function AdminBillingProtected() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiHeader({
      name: 'x-tenant-id',
      required: false,
      description:
        'Tenant UUID. Optional for tenant ADMIN if the JWT already contains tenantId.',
    }),
    UseGuards(...adminAuthGuards(false)),
    Roles('ADMIN'),
  );
}
