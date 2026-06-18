import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';

@Injectable()
export class TenantIntegrationConfigService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async getRazorpayConfig(tenantId?: string | null) {
    if (!tenantId) {
      return {
        keyId: process.env.RAZORPAY_KEY_ID?.trim() || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
      };
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const config = (tenant.integrationConfig || {}) as any;
    const razorpayConfig = config.razorpay || {};
    return {
      keyId: (razorpayConfig.keyId || process.env.RAZORPAY_KEY_ID || '').trim(),
      // In production this should come from a secret store using keySecretRef.
      keySecret: (
        razorpayConfig.keySecret ||
        process.env.RAZORPAY_KEY_SECRET ||
        ''
      ).trim(),
      keySecretRef: razorpayConfig.keySecretRef || null,
      mode: razorpayConfig.mode || 'live',
    };
  }
}

