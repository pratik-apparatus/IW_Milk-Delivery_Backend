import { BadRequestException } from '@nestjs/common';
import {
  OPTIONAL_TENANT_APPS,
  resolveEnabledApps,
} from '../../common/constants/tenant-apps.constants';
import { TenantIntegrationConfigDto } from './dto/tenant-integration-config.dto';

export function parseEnabledApps(requested?: string[]): string[] {
  try {
    return resolveEnabledApps(requested);
  } catch {
    throw new BadRequestException(
      `Invalid enabledApps. Optional modules: ${OPTIONAL_TENANT_APPS.join(', ')}. CUSTOMER_APP and ADMIN_APP are always enabled.`,
    );
  }
}

export function normalizeIntegrationConfig(
  input?: Record<string, unknown> | TenantIntegrationConfigDto,
): Record<string, unknown> {
  if (!input) {
    return {};
  }

  const raw = input as Record<string, unknown>;
  const razorpayInput = (raw.razorpay || {}) as Record<string, unknown>;

  const keyId =
    (razorpayInput.keyId as string) || (raw.razorpayKeyId as string) || '';
  const keySecret =
    (razorpayInput.keySecret as string) ||
    (raw.razorpayKeySecret as string) ||
    '';

  if (!keyId && !keySecret) {
    return {};
  }

  if (!keyId || !keySecret) {
    throw new BadRequestException(
      'integrationConfig.razorpay requires both keyId and keySecret',
    );
  }

  return {
    razorpay: {
      keyId,
      keySecret,
      mode: (razorpayInput.mode as string) || 'live',
    },
  };
}
