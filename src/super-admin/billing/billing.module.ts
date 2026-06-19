import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantPlan } from '../../entities/tenant-plan.entity';
import { TenantSubscription } from '../../entities/tenant-subscription.entity';
import { AdminBillingController } from '../../admin/billing/admin-billing.controller';
import { TenantPlanController } from './tenant-plan.controller';
import { TenantPlanService } from './tenant-plan.service';
import { TenantSubscriptionController } from './tenant-subscription.controller';
import { TenantSubscriptionService } from './tenant-subscription.service';
import { TenantBillingPaymentService } from './tenant-billing-payment.service';
import { BillingWebhookController } from './billing-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantPlan, TenantSubscription])],
  controllers: [
    TenantPlanController,
    TenantSubscriptionController,
    BillingWebhookController,
    AdminBillingController,
  ],
  providers: [
    TenantPlanService,
    TenantSubscriptionService,
    TenantBillingPaymentService,
  ],
  exports: [TenantPlanService, TenantSubscriptionService, TenantBillingPaymentService],
})
export class BillingModule {}
