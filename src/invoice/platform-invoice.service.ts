import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PlatformInvoice,
  PlatformInvoiceStatus,
} from '../entities/platform-invoice.entity';
import { Tenant } from '../entities/tenant.entity';
import { TenantPlan } from '../entities/tenant-plan.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { applyPagination } from '../common/utils/pagination.util';
import { PlatformInvoiceTemplate } from './pdf/platform-invoice.template';

@Injectable()
export class PlatformInvoiceService {
  private readonly logger = new Logger(PlatformInvoiceService.name);

  constructor(
    @InjectRepository(PlatformInvoice)
    private readonly invoiceRepo: Repository<PlatformInvoice>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly platformTemplate: PlatformInvoiceTemplate,
  ) {}

  async createForTenantSubscription(
    subscription: TenantSubscription,
    plan: TenantPlan | null,
  ): Promise<PlatformInvoice | null> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: subscription.tenantId },
    });
    if (!tenant) {
      this.logger.warn(
        `Skipping platform invoice: tenant ${subscription.tenantId} not found`,
      );
      return null;
    }

    if (subscription.razorpayPaymentId) {
      const byPayment = await this.invoiceRepo.findOne({
        where: {
          tenantId: subscription.tenantId,
          razorpayPaymentId: subscription.razorpayPaymentId,
        },
      });
      if (byPayment) {
        return byPayment;
      }
    }

    if (subscription.razorpayOrderId) {
      const byOrder = await this.invoiceRepo.findOne({
        where: {
          tenantId: subscription.tenantId,
          razorpayOrderId: subscription.razorpayOrderId,
        },
      });
      if (byOrder) {
        return byOrder;
      }
    }

    const paidAt = subscription.paidAt || new Date();
    const activationKey = subscription.razorpayPaymentId
      ? null
      : subscription.razorpayOrderId
        ? null
        : `free:${subscription.id}`;

    if (activationKey) {
      const byKey = await this.invoiceRepo.findOne({
        where: { activationKey },
      });
      if (byKey) {
        return byKey;
      }
    }

    const invoiceNumber = await this.nextInvoiceNumber();
    const amount = Number(subscription.amount);
    const periodStart = subscription.startedAt || paidAt;
    const periodEnd = subscription.expiresAt;

    const invoice = this.invoiceRepo.create({
      tenantId: subscription.tenantId,
      tenantSubscriptionId: subscription.id,
      planId: subscription.planId,
      invoiceNumber,
      amount,
      currency: 'INR',
      status: PlatformInvoiceStatus.PAID,
      issuedAt: paidAt,
      paidAt,
      razorpayPaymentId: subscription.razorpayPaymentId,
      razorpayOrderId: subscription.razorpayOrderId,
      activationKey,
      issuerSnapshot: {
        businessName:
          this.configService.get<string>('PLATFORM_NAME') ||
          'Milk Delivery Platform',
        logoUrl: this.configService.get<string>('PLATFORM_LOGO_URL') || null,
        supportEmail:
          this.configService.get<string>('PLATFORM_SUPPORT_EMAIL') || null,
        supportPhone:
          this.configService.get<string>('PLATFORM_SUPPORT_PHONE') || null,
      },
      billToSnapshot: {
        name: tenant.businessName,
        phone: tenant.supportPhone || '',
        address: tenant.adminAddress,
        email: tenant.adminEmail,
      },
      lineItemsSnapshot: [
        {
          description: [
            plan?.name || 'Platform plan',
            plan ? `${plan.durationDays} days` : null,
            this.formatPeriod(periodStart, periodEnd),
          ]
            .filter(Boolean)
            .join(' · '),
          planName: plan?.name || 'Platform plan',
          planDescription: plan?.description ?? null,
          durationDays: plan?.durationDays ?? 30,
          periodStart: this.toIsoDate(periodStart),
          periodEnd: this.toIsoDate(periodEnd),
          amount,
        },
      ],
    });

    try {
      return await this.invoiceRepo.save(invoice);
    } catch (err) {
      // Concurrent webhook + verify may race on unique constraints.
      this.logger.warn(
        `Platform invoice create race for tenant ${subscription.tenantId}: ${String(err)}`,
      );
      if (subscription.razorpayPaymentId) {
        return this.invoiceRepo.findOne({
          where: {
            tenantId: subscription.tenantId,
            razorpayPaymentId: subscription.razorpayPaymentId,
          },
        });
      }
      if (activationKey) {
        return this.invoiceRepo.findOne({ where: { activationKey } });
      }
      return null;
    }
  }

  async listForTenant(tenantId: string, query: PaginationQueryDto) {
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenantId = :tenantId', { tenantId })
      .orderBy('invoice.issuedAt', 'DESC');
    return applyPagination(qb, query.page, query.limit);
  }

  async getForTenant(
    tenantId: string,
    invoiceId: string,
  ): Promise<PlatformInvoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getLatestForTenant(tenantId: string): Promise<PlatformInvoice | null> {
    return this.invoiceRepo.findOne({
      where: { tenantId },
      order: { issuedAt: 'DESC' },
    });
  }

  async renderPdf(invoice: PlatformInvoice): Promise<Buffer> {
    return this.platformTemplate.render(invoice);
  }

  private async nextInvoiceNumber(): Promise<string> {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PLT-INV-${ym}-`;

    const latest = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('invoice.invoiceNumber', 'DESC')
      .getOne();

    let seq = 1;
    if (latest?.invoiceNumber) {
      const part = latest.invoiceNumber.split('-').pop();
      const parsed = Number(part);
      if (!Number.isNaN(parsed)) {
        seq = parsed + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private toIsoDate(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  private formatPeriod(start: Date | null, end: Date | null): string | null {
    if (!start && !end) return null;
    const a = this.toIsoDate(start) || '—';
    const b = this.toIsoDate(end) || '—';
    return `${a} → ${b}`;
  }
}
