import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../../entities/tenant-subscription.entity';
import { TenantPlan } from '../../entities/tenant-plan.entity';
import { Tenant } from '../../entities/tenant.entity';
import { findSuperAdminTenant } from '../common/find-super-admin-tenant';
import {
  addSubscriptionDays,
  syncSubscriptionExpiry,
} from './tenant-subscription.util';

const Razorpay = require('razorpay');

@Injectable()
export class TenantBillingPaymentService {
  private readonly logger = new Logger(TenantBillingPaymentService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantPlan)
    private readonly planRepo: Repository<TenantPlan>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepo: Repository<TenantSubscription>,
  ) {
    this.keyId = (
      this.configService.get<string>('RAZORPAY_KEY_ID') || ''
    ).trim();
    this.keySecret = (
      this.configService.get<string>('RAZORPAY_KEY_SECRET') || ''
    ).trim();
    this.webhookSecret = (
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || ''
    ).trim();
  }

  private getRazorpayClient() {
    if (!this.keyId || !this.keySecret) {
      throw new InternalServerErrorException(
        'Platform Razorpay credentials not configured',
      );
    }
    return new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  /** Create a Razorpay order for the tenant's assigned plan (super-admin). */
  async createOrder(tenantId: string) {
    return this.createOrderForTenant(tenantId, true);
  }

  /** Create a Razorpay order when tenant admin initiates payment. */
  async createOrderForTenant(
    tenantId: string,
    requireSuperAdminTenant = false,
  ) {
    const subscription = await this.getSubscriptionOrThrow(
      tenantId,
      requireSuperAdminTenant,
    );
    await this.syncExpiredStatus(subscription);

    if (subscription.status === TenantSubscriptionStatus.CANCELLED) {
      throw new BadRequestException(
        'Subscription is cancelled. Assign a plan first.',
      );
    }

    if (subscription.status === TenantSubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Subscription is already active.');
    }

    const amount = Number(subscription.amount);
    if (amount <= 0) {
      return this.activateSubscription(subscription, null, null);
    }

    const razorpay = this.getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `tenant_${tenantId.slice(0, 8)}_${Date.now()}`,
      notes: { tenantId, planId: subscription.planId, type: 'SAAS_BILLING' },
    });

    subscription.razorpayOrderId = order.id;
    subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT;
    await this.subscriptionRepo.save(subscription);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.keyId,
      tenantId,
      planAmount: amount,
    };
  }

  /** Verify Razorpay payment and activate the tenant subscription (super-admin). */
  async verifyPayment(
    tenantId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    return this.verifyPaymentForTenant(
      tenantId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      true,
    );
  }

  /** Verify Razorpay payment when tenant admin completes checkout. */
  async verifyPaymentForTenant(
    tenantId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    requireSuperAdminTenant = false,
  ) {
    const subscription = await this.getSubscriptionOrThrow(
      tenantId,
      requireSuperAdminTenant,
    );

    if (subscription.razorpayOrderId !== razorpayOrderId) {
      throw new BadRequestException(
        'Order does not match current subscription',
      );
    }

    const isValid = this.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid payment signature');
    }

    return this.activateSubscription(
      subscription,
      razorpayPaymentId,
      razorpayOrderId,
    );
  }

  /** Handle Razorpay webhook (payment.captured / order.paid). */
  async handleWebhook(payload: Record<string, unknown>, signature: string) {
    if (this.webhookSecret) {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (signature !== expected) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const event = payload.event as string;
    const paymentEntity = (payload.payload as any)?.payment?.entity;
    const orderId =
      paymentEntity?.order_id || (payload.payload as any)?.order?.entity?.id;

    if (!orderId) {
      return { received: true, processed: false };
    }

    if (event !== 'payment.captured' && event !== 'order.paid') {
      return { received: true, processed: false };
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { razorpayOrderId: orderId },
    });
    if (!subscription) {
      return { received: true, processed: false };
    }

    const paymentId = paymentEntity?.id || null;
    await this.activateSubscription(subscription, paymentId, orderId);
    return { received: true, processed: true, tenantId: subscription.tenantId };
  }

  private verifySignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');
    return expected === signature;
  }

  private async activateSubscription(
    subscription: TenantSubscription,
    paymentId: string | null,
    orderId: string | null,
  ) {
    const plan = await this.planRepo.findOne({
      where: { id: subscription.planId },
    });
    const durationDays = plan?.durationDays ?? 30;

    const now = new Date();
    const expiresAt = addSubscriptionDays(now, durationDays);

    subscription.status = TenantSubscriptionStatus.ACTIVE;
    subscription.paidAt = now;
    subscription.startedAt = now;
    subscription.expiresAt = expiresAt;
    subscription.cancelledAt = null;
    if (paymentId) {
      subscription.razorpayPaymentId = paymentId;
    }
    if (orderId) {
      subscription.razorpayOrderId = orderId;
    }

    await this.subscriptionRepo.save(subscription);

    return {
      success: true,
      message: 'Subscription payment verified and activated',
      tenantId: subscription.tenantId,
      status: subscription.status,
      paidAt: subscription.paidAt,
      expiresAt: subscription.expiresAt,
      amount: Number(subscription.amount),
    };
  }

  private async getSubscriptionOrThrow(
    tenantId: string,
    requireSuperAdminTenant = false,
  ) {
    if (requireSuperAdminTenant) {
      await findSuperAdminTenant(this.tenantRepo, tenantId);
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
    });
    if (!subscription) {
      throw new BadRequestException(
        'No plan assigned. Assign a plan before creating a payment order.',
      );
    }
    return subscription;
  }

  async syncExpiredStatus(subscription: TenantSubscription) {
    await syncSubscriptionExpiry(subscription, this.subscriptionRepo);

    // Legacy rows may still be EXPIRED — treat as renewal pending.
    if (subscription.status === TenantSubscriptionStatus.EXPIRED) {
      subscription.status = TenantSubscriptionStatus.PENDING_PAYMENT;
      subscription.razorpayOrderId = null;
      subscription.razorpayPaymentId = null;
      await this.subscriptionRepo.save(subscription);
    }
  }
}
