import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../entities/tenant-subscription.entity';
import { syncSubscriptionExpiry } from '../super-admin/billing/tenant-subscription.util';

@Injectable()
export class AdminSubscriptionGuard implements CanActivate {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'ADMIN') {
      return true;
    }

    const tenantId = request.tenantId as string | undefined;
    if (!tenantId) {
      return true;
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });

    if (!subscription) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message:
          'No subscription plan assigned. Contact platform admin to assign a plan.',
        paymentRequired: false,
      });
    }

    await syncSubscriptionExpiry(subscription, this.subscriptionRepo);

    if (subscription.status === TenantSubscriptionStatus.EXPIRED) {
      subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT;
      await this.subscriptionRepo.save(subscription);
    }

    if (subscription.status !== TenantSubscriptionStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_INACTIVE',
        status: subscription.status,
        message: this.inactiveMessage(subscription.status),
        paymentRequired: this.isPaymentRequired(subscription.status),
      });
    }

    return true;
  }

  private isPaymentRequired(status: TenantSubscriptionStatus) {
    return status === TenantSubscriptionStatus.PENDING_PAYMENT;
  }

  private inactiveMessage(status: TenantSubscriptionStatus) {
    switch (status) {
      case TenantSubscriptionStatus.PENDING_PAYMENT:
        return 'Subscription payment is pending. Complete payment to access the admin panel.';
      case TenantSubscriptionStatus.EXPIRED:
        return 'Your subscription has expired. Renew your subscription to continue.';
      case TenantSubscriptionStatus.CANCELLED:
        return 'Your subscription is cancelled. Contact platform admin to assign a new plan.';
      default:
        return 'Active subscription required to access the admin panel.';
    }
  }
}
