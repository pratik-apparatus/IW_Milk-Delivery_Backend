import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';

/** Resolve tenant by ID for super-admin control-plane APIs (includes decommissioned tenants). */
export async function findSuperAdminTenant(
  tenantRepo: Repository<Tenant>,
  tenantId: string,
): Promise<Tenant> {
  const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundException('Tenant not found');
  }
  return tenant;
}
