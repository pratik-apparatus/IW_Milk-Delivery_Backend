import { Repository } from 'typeorm';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../../entities/tenant-subscription.entity';

export function addSubscriptionDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** When an active subscription passes expiresAt, require renewal payment. */
export async function syncSubscriptionExpiry(
  subscription: TenantSubscription,
  subscriptionRepo: Repository<TenantSubscription>,
): Promise<void> {
  if (
    subscription.status === TenantSubscriptionStatus.ACTIVE &&
    subscription.expiresAt &&
    subscription.expiresAt < new Date()
  ) {
    subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT;
    subscription.razorpayOrderId = null;
    subscription.razorpayPaymentId = null;
    await subscriptionRepo.save(subscription);
  }
}
