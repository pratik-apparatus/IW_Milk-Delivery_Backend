import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Tenant, TenantStatus } from '../../entities/tenant.entity';

export const TENANT_UNAVAILABLE_ERROR_CODE = 'TENANT_UNAVAILABLE';

export const TENANT_LOGIN_BLOCKED_MESSAGE =
  'We are experiencing a temporary system issue. Please try again later or contact support.';

export function assertTenantAllowsLogin(
  tenant: Tenant | null | undefined,
): void {
  if (!tenant || tenant.deletedAt) {
    throw new NotFoundException('Tenant not found');
  }

  if (tenant.status !== TenantStatus.ACTIVE) {
    throw new ServiceUnavailableException({
      code: TENANT_UNAVAILABLE_ERROR_CODE,
      message: TENANT_LOGIN_BLOCKED_MESSAGE,
    });
  }
}
