import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantPlan } from '../../entities/tenant-plan.entity';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../../entities/tenant-subscription.entity';
import { findSuperAdminTenant } from '../common/find-super-admin-tenant';
import { TenantBillingPaymentService } from './tenant-billing-payment.service';
import { addSubscriptionDays } from './tenant-subscription.util';

@Injectable()
export class TenantSubscriptionService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantPlan)
    private readonly planRepo: Repository<TenantPlan>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
    private readonly billingPayment: TenantBillingPaymentService,
  ) {}

  async assignPlan(tenantId: string, planId: string) {
    await findSuperAdminTenant(this.tenantRepo, tenantId);

    const plan = await this.planRepo.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException('Active plan not found');
    }

    const amount = Number(plan.amount);
    let subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });

    const needsPayment = amount > 0;
    const durationDays = plan.durationDays ?? 30;
    const expiresAt = addSubscriptionDays(new Date(), durationDays);

    if (subscription) {
      subscription.planId = plan.id;
      subscription.amount = amount;
      subscription.status = needsPayment
        ? TenantSubscriptionStatus.PENDING_PAYMENT
        : TenantSubscriptionStatus.ACTIVE;
      subscription.startedAt = needsPayment ? null : new Date();
      subscription.cancelledAt = null;
      subscription.razorpayOrderId = null;
      subscription.razorpayPaymentId = null;
      subscription.paidAt = needsPayment ? null : new Date();
      subscription.expiresAt = expiresAt;
    } else {
      subscription = this.subscriptionRepo.create({
        tenantId,
        planId: plan.id,
        amount,
        status: needsPayment
          ? TenantSubscriptionStatus.PENDING_PAYMENT
          : TenantSubscriptionStatus.ACTIVE,
        startedAt: needsPayment ? null : new Date(),
        cancelledAt: null,
        paidAt: needsPayment ? null : new Date(),
        expiresAt,
      });
    }

    const saved = await this.subscriptionRepo.save(subscription);
    return this.buildStatusResponse(tenantId, saved);
  }

  async getStatus(tenantId: string) {
    await findSuperAdminTenant(this.tenantRepo, tenantId);
    return this.getBillingStatus(tenantId, true);
  }

  /** Billing overview for tenant admin (no super-admin tenant lookup). */
  async getAdminBillingStatus(tenantId: string) {
    return this.getBillingStatus(tenantId, false);
  }

  private async getBillingStatus(
    tenantId: string,
    includeAvailablePlans: boolean,
  ) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });

    if (subscription) {
      await this.billingPayment.syncExpiredStatus(subscription);
    }

    const status = await this.buildStatusResponse(tenantId, subscription);

    if (!includeAvailablePlans) {
      return status;
    }

    const availablePlans = await this.planRepo.find({
      where: { isActive: true },
      order: { amount: 'ASC' },
    });

    return {
      ...status,
      availablePlans: availablePlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: Number(plan.amount),
        durationDays: plan.durationDays,
        isActive: plan.isActive,
      })),
    };
  }

  async cancel(tenantId: string) {
    await findSuperAdminTenant(this.tenantRepo, tenantId);

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });
    if (!subscription) {
      throw new NotFoundException('Tenant has no subscription');
    }

    subscription.status = TenantSubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    const saved = await this.subscriptionRepo.save(subscription);
    return this.buildStatusResponse(tenantId, saved);
  }

  async removeEnded(tenantId: string) {
    await findSuperAdminTenant(this.tenantRepo, tenantId);

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });
    if (!subscription) {
      throw new NotFoundException('Tenant has no subscription');
    }

    const removableStatuses = [
      TenantSubscriptionStatus.EXPIRED,
      TenantSubscriptionStatus.CANCELLED,
      TenantSubscriptionStatus.PENDING_PAYMENT,
    ];

    if (!removableStatuses.includes(subscription.status)) {
      throw new BadRequestException(
        'Only expired, cancelled, or unpaid subscriptions can be removed. Cancel the active subscription first.',
      );
    }

    await this.subscriptionRepo.remove(subscription);
    return {
      message: 'Subscription removed successfully',
      tenantId,
    };
  }

  async updatePlan(tenantId: string, planId: string) {
    return this.assignPlan(tenantId, planId);
  }

  async detachPlan(tenantId: string) {
    await findSuperAdminTenant(this.tenantRepo, tenantId);

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });

    if (!subscription) {
      return {
        message: 'No billing plan attached to this tenant',
        tenantId,
        detached: false,
      };
    }

    if (subscription.status === TenantSubscriptionStatus.ACTIVE) {
      subscription.status = TenantSubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      await this.subscriptionRepo.save(subscription);
    }

    await this.subscriptionRepo.remove(subscription);

    return {
      message: 'Billing plan detached successfully',
      tenantId,
      detached: true,
    };
  }

  async forceDetachForTenantDeletion(tenantId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });

    if (!subscription) {
      return;
    }

    await this.subscriptionRepo.remove(subscription);
  }

  private async buildStatusResponse(
    tenantId: string,
    subscription: TenantSubscription | null,
  ) {
    if (!subscription) {
      return {
        tenantId,
        subscribed: false,
        status: 'NONE',
        plan: null,
        amount: null,
        startedAt: null,
        cancelledAt: null,
        paidAt: null,
        expiresAt: null,
        razorpayOrderId: null,
        paymentRequired: false,
      };
    }

    const plan = await this.planRepo.findOne({
      where: { id: subscription.planId },
    });

    const isActive = subscription.status === TenantSubscriptionStatus.ACTIVE;

    return {
      tenantId,
      subscribed: isActive,
      status: subscription.status,
      amount: Number(subscription.amount),
      startedAt: subscription.startedAt,
      cancelledAt: subscription.cancelledAt,
      paidAt: subscription.paidAt,
      expiresAt: subscription.expiresAt,
      razorpayOrderId: subscription.razorpayOrderId,
      paymentRequired:
        subscription.status === TenantSubscriptionStatus.PENDING_PAYMENT,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            amount: Number(plan.amount),
            durationDays: plan.durationDays,
            isActive: plan.isActive,
          }
        : null,
    };
  }
}
