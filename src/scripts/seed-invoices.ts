import 'reflect-metadata';
import '../config/load-env';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../dataSource/data-source';
import { Tenant } from '../entities/tenant.entity';
import { TenantPlan } from '../entities/tenant-plan.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { PlatformInvoice } from '../entities/platform-invoice.entity';
import { PlatformInvoiceService } from '../invoice/platform-invoice.service';
import { ConfigService } from '@nestjs/config';
import { PlatformInvoiceTemplate } from '../invoice/pdf/platform-invoice.template';
import { PdfInvoiceRenderer } from '../invoice/pdf/pdf-invoice.renderer';
import { createTenantDataSource } from '../common/database/tenant-data-source.util';
import { Subscription } from '../entities/subscription.entity';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import {
  SubscriptionInvoice,
  SubscriptionInvoicePaymentMethod,
  SubscriptionInvoiceStatus,
} from '../entities/subscription-invoice.entity';

/**
 * Backfill invoices for existing paid platform subscriptions and customer milk subscriptions.
 *
 *   npm run seed:invoices:dev
 *   npm run seed:invoices
 */
async function seedInvoices() {
  console.log('=== Seed invoices ===');
  console.log(`Database: ${process.env.DB_NAME}`);
  console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);

  await AppDataSource.initialize();

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const planRepo = AppDataSource.getRepository(TenantPlan);
  const subscriptionRepo = AppDataSource.getRepository(TenantSubscription);
  const platformInvoiceRepo = AppDataSource.getRepository(PlatformInvoice);

  const configService = new ConfigService(process.env);
  const pdfRenderer = new PdfInvoiceRenderer();
  const platformTemplate = new PlatformInvoiceTemplate(pdfRenderer);
  const platformInvoiceService = new PlatformInvoiceService(
    platformInvoiceRepo,
    tenantRepo,
    configService,
    platformTemplate,
  );

  const tenants = await tenantRepo.find();
  const plans = await planRepo.find();
  const planById = new Map(plans.map((p) => [p.id, p]));

  let platformCreated = 0;
  let platformSkipped = 0;

  const saasSubs = await subscriptionRepo.find();
  for (const sub of saasSubs) {
    // Seed paid activations and free/active rows that already have paidAt/startedAt.
    if (!sub.paidAt && !sub.startedAt) {
      platformSkipped += 1;
      continue;
    }
    const existingCount = await platformInvoiceRepo.count({
      where: { tenantSubscriptionId: sub.id },
    });
    if (existingCount > 0) {
      platformSkipped += 1;
      continue;
    }

    const plan = planById.get(sub.planId) || null;
    if (!sub.paidAt && sub.startedAt) {
      sub.paidAt = sub.startedAt;
    }
    const created = await platformInvoiceService.createForTenantSubscription(
      sub,
      plan,
    );
    if (created) platformCreated += 1;
    else platformSkipped += 1;
  }

  console.log(
    `Platform invoices: created=${platformCreated}, skipped=${platformSkipped}`,
  );

  let customerCreated = 0;
  let customerSkipped = 0;

  for (const tenant of tenants) {
    if (!tenant.dbName || tenant.deletedAt) continue;

    let tenantDs: DataSource | null = null;
    try {
      tenantDs = createTenantDataSource(tenant);
      await tenantDs.initialize();

      const subscriptionRepoTenant = tenantDs.getRepository(Subscription);
      const productRepo = tenantDs.getRepository(Product);
      const customerRepo = tenantDs.getRepository(Customer);
      const invoiceRepo = tenantDs.getRepository(SubscriptionInvoice);

      // Ensure table exists on older DBs without migrations in-repo.
      const hasTable = await tenantDs.query(`
        SELECT to_regclass('public.subscription_invoices') AS exists
      `);
      if (!hasTable[0]?.exists) {
        console.log(
          `  Skipping ${tenant.businessName}: subscription_invoices table missing`,
        );
        continue;
      }

      const subscriptions = await subscriptionRepoTenant.find();
      for (const subscription of subscriptions) {
        const existing = await invoiceRepo.findOne({
          where: {
            tenantId: tenant.id,
            subscriptionId: subscription.id,
          },
        });
        if (existing) {
          customerSkipped += 1;
          continue;
        }

        const product = await productRepo.findOne({
          where: { id: subscription.productId },
        });
        const customer = await customerRepo.findOne({
          where: { id: subscription.customerId },
        });
        if (!product || !customer) {
          customerSkipped += 1;
          continue;
        }

        const now = new Date();
        const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prefix = `INV-${ym}-`;
        const latest = await invoiceRepo
          .createQueryBuilder('invoice')
          .where('invoice.tenantId = :tenantId', { tenantId: tenant.id })
          .andWhere('invoice.invoiceNumber LIKE :prefix', {
            prefix: `${prefix}%`,
          })
          .orderBy('invoice.invoiceNumber', 'DESC')
          .getOne();
        let seq = 1;
        if (latest?.invoiceNumber) {
          const part = Number(latest.invoiceNumber.split('-').pop());
          if (!Number.isNaN(part)) seq = part + 1;
        }
        const invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;
        const amount = Number(subscription.totalAmount ?? 0);
        const unitPrice = Number(product.price);

        await invoiceRepo.save(
          invoiceRepo.create({
            tenantId: tenant.id,
            invoiceNumber,
            subscriptionId: subscription.id,
            customerId: customer.id,
            amount,
            currency: 'INR',
            status: SubscriptionInvoiceStatus.PAID,
            issuedAt: subscription.createdAt || now,
            paymentMethod: SubscriptionInvoicePaymentMethod.WALLET,
            issuerSnapshot: {
              businessName: tenant.businessName,
              logoUrl: tenant.logoUrl,
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
                  subscription.selectedDays?.join(',') || null,
                  `${subscription.totalDeliveries ?? 0} deliveries × qty ${subscription.quantity}`,
                ]
                  .filter(Boolean)
                  .join(' · '),
                productName: product.name,
                planType: subscription.planType,
                selectedDays: subscription.selectedDays,
                startDate: subscription.startDate
                  ? new Date(subscription.startDate).toISOString().slice(0, 10)
                  : null,
                endDate: subscription.endDate
                  ? new Date(subscription.endDate).toISOString().slice(0, 10)
                  : null,
                quantity: subscription.quantity,
                totalDeliveries: subscription.totalDeliveries ?? 0,
                unitPrice,
                amount,
              },
            ],
          }),
        );
        customerCreated += 1;
      }

      console.log(`  Tenant ${tenant.businessName}: ok`);
    } catch (err) {
      console.error(
        `  Failed tenant ${tenant.businessName} (${tenant.dbName}):`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      if (tenantDs?.isInitialized) {
        await tenantDs.destroy();
      }
    }
  }

  console.log(
    `Customer invoices: created=${customerCreated}, skipped=${customerSkipped}`,
  );

  await AppDataSource.destroy();
  console.log('Invoice seeding completed.');
}

seedInvoices().catch((err) => {
  console.error('Invoice seeding failed:', err);
  process.exit(1);
});
