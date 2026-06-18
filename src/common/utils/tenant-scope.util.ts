import { ForbiddenException } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function applyTenantFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  tenantId: string | null | undefined,
  alias: string,
  skipTenantFilter = false,
): SelectQueryBuilder<T> {
  if (skipTenantFilter) {
    return qb;
  }
  if (!tenantId) {
    throw new ForbiddenException('Tenant context is required');
  }
  return qb.andWhere(`${alias}.tenantId = :tenantId`, { tenantId });
}

export function tenantWhere(
  tenantId: string | null | undefined,
  where: Record<string, unknown> = {},
  skipTenantFilter = false,
) {
  if (skipTenantFilter) {
    return where;
  }
  if (!tenantId) {
    throw new ForbiddenException('Tenant context is required');
  }
  return { ...where, tenantId };
}
