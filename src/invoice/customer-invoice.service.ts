import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { TenantContextService } from '../common/services/tenant-context.service';
import { TenantRepositoryService } from '../common/database/tenant-repository.service';
import {
  SubscriptionInvoice,
  SubscriptionInvoicePaymentMethod,
  SubscriptionInvoiceStatus,
} from '../entities/subscription-invoice.entity';
import { Subscription } from '../entities/subscription.entity';
import { Customer } from '../entities/customer.entity';
import { Product } from '../entities/product.entity';
import { AppConfig } from '../entities/app-config.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { applyPagination } from '../common/utils/pagination.util';
import { CustomerInvoiceTemplate } from './pdf/customer-invoice.template';

@Injectable()
export class CustomerInvoiceService {
  private readonly logger = new Logger(CustomerInvoiceService.name);

  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly tenantContext: TenantContextService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly customerTemplate: CustomerInvoiceTemplate,
  ) {}

  async createForSubscription(
    subscription: Subscription,
    product: Product,
    customer: Customer,
  ): Promise<SubscriptionInvoice | null> {
    const tenantId = this.tenantContext.requireTenantId();
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);

    const existing = await invoiceRepo.findOne({
      where: { tenantId, subscriptionId: subscription.id },
    });
    if (existing) {
      return existing;
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      this.logger.warn(
        `Skipping invoice: tenant ${tenantId} not found for subscription ${subscription.id}`,
      );
      return null;
    }

    let logoUrl = tenant.logoUrl;
    try {
      const appConfigRepo = await this.tenantRepos.getRepository(AppConfig);
      const appConfig = await appConfigRepo.findOne({ where: { tenantId } });
      if (appConfig?.logoUrl) {
        logoUrl = logoUrl || appConfig.logoUrl;
      }
    } catch {
      // App config is optional for invoice branding.
    }

    const invoiceNumber = await this.nextInvoiceNumber(tenantId);
    const unitPrice = Number(product.price);
    const amount = Number(subscription.totalAmount ?? 0);
    const daysLabel = subscription.selectedDays?.length
      ? subscription.selectedDays.join(',')
      : null;

    const invoice = invoiceRepo.create({
      tenantId,
      invoiceNumber,
      subscriptionId: subscription.id,
      customerId: customer.id,
      amount,
      currency: 'INR',
      status: SubscriptionInvoiceStatus.PAID,
      issuedAt: new Date(),
      paymentMethod: SubscriptionInvoicePaymentMethod.WALLET,
      issuerSnapshot: {
        businessName: tenant.businessName,
        logoUrl,
        supportEmail: tenant.supportEmail,
        supportPhone: tenant.supportPhone,
      },
      billToSnapshot: {
        name: customer.name,
        phone: customer.phone,
        address: subscription.addressSnapshot || customer.address || null,
        email: customer.email,
      },
      lineItemsSnapshot: [
        {
          description: [
            product.name,
            subscription.planType,
            daysLabel,
            `${subscription.totalDeliveries ?? 0} deliveries × qty ${subscription.quantity}`,
          ]
            .filter(Boolean)
            .join(' · '),
          productName: product.name,
          planType: subscription.planType,
          selectedDays: subscription.selectedDays,
          startDate: this.toIsoDate(subscription.startDate),
          endDate: this.toIsoDate(subscription.endDate),
          quantity: subscription.quantity,
          totalDeliveries: subscription.totalDeliveries ?? 0,
          unitPrice,
          amount,
        },
      ],
    });

    return invoiceRepo.save(invoice);
  }

  async listForCustomer(customerId: string, query: PaginationQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);
    const qb = invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenantId = :tenantId', { tenantId })
      .andWhere('invoice.customerId = :customerId', { customerId })
      .orderBy('invoice.issuedAt', 'DESC');

    return applyPagination(qb, query.page, query.limit);
  }

  async listForAdmin(
    query: PaginationQueryDto & {
      subscriptionId?: string;
      customerId?: string;
    },
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);
    const qb = invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenantId = :tenantId', { tenantId })
      .orderBy('invoice.issuedAt', 'DESC');

    if (query.subscriptionId) {
      qb.andWhere('invoice.subscriptionId = :subscriptionId', {
        subscriptionId: query.subscriptionId,
      });
    }
    if (query.customerId) {
      qb.andWhere('invoice.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    return applyPagination(qb, query.page, query.limit);
  }

  async getBySubscriptionForCustomer(
    subscriptionId: string,
    customerId: string,
  ): Promise<SubscriptionInvoice> {
    const tenantId = this.tenantContext.requireTenantId();
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);
    const invoice = await invoiceRepo.findOne({
      where: { tenantId, subscriptionId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found for this subscription');
    }
    if (invoice.customerId !== customerId) {
      throw new ForbiddenException('You do not own this invoice');
    }
    return invoice;
  }

  async getByIdForAdmin(invoiceId: string): Promise<SubscriptionInvoice> {
    const tenantId = this.tenantContext.requireTenantId();
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);
    const invoice = await invoiceRepo.findOne({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getBySubscriptionForAdmin(
    subscriptionId: string,
  ): Promise<SubscriptionInvoice> {
    const tenantId = this.tenantContext.requireTenantId();
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);
    const invoice = await invoiceRepo.findOne({
      where: { tenantId, subscriptionId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found for this subscription');
    }
    return invoice;
  }

  async renderPdf(invoice: SubscriptionInvoice): Promise<Buffer> {
    return this.customerTemplate.render(invoice);
  }

  private async nextInvoiceNumber(tenantId: string): Promise<string> {
    const invoiceRepo =
      await this.tenantRepos.getRepository(SubscriptionInvoice);
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${ym}-`;

    const latest = await invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenantId = :tenantId', { tenantId })
      .andWhere('invoice.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
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
}
