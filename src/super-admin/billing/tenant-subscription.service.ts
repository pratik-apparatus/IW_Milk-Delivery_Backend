import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { TenantPlan } from '../../entities/tenant-plan.entity';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../../entities/tenant-subscription.entity';
import { TenantBillingPaymentService } from './tenant-billing-payment.service';

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
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

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
      subscription.expiresAt = needsPayment
        ? null
        : this.addDays(new Date(), 30);
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
        expiresAt: needsPayment ? null : this.addDays(new Date(), 30),
      });
    }

    const saved = await this.subscriptionRepo.save(subscription);
    return this.buildStatusResponse(tenantId, saved);
  }

  async getStatus(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });

    if (subscription) {
      await this.billingPayment.syncExpiredStatus(subscription);
    }

    const availablePlans = await this.planRepo.find({
      where: { isActive: true },
      order: { amount: 'ASC' },
    });

    const status = await this.buildStatusResponse(tenantId, subscription);
    return {
      ...status,
      availablePlans: availablePlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        amount: Number(plan.amount),
        isActive: plan.isActive,
      })),
    };
  }

  async cancel(tenantId: string) {
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

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
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
        subscription.status === TenantSubscriptionStatus.PENDING_PAYMENT ||
        subscription.status === TenantSubscriptionStatus.EXPIRED,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            amount: Number(plan.amount),
            isActive: plan.isActive,
          }
        : null,
    };
  }
}
