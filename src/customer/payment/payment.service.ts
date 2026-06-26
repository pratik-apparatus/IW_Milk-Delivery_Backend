import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { WalletService } from '../wallet/wallet.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
const Razorpay = require('razorpay');
import { TenantIntegrationConfigService } from '../../common/services/tenant-integration-config.service';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private razorpayKeyId: string;
  private razorpayKeySecret: string;
  private razorpay: InstanceType<typeof Razorpay>;

  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly tenantIntegrationConfigService: TenantIntegrationConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.razorpayKeyId = (
      this.configService.get<string>('RAZORPAY_KEY_ID') ||
      'rzp_test_S5iJuPus3ggxkS'
    ).trim();
    this.razorpayKeySecret = (
      this.configService.get<string>('RAZORPAY_KEY_SECRET') ||
      'x1YuOZBSy1g6SL64QNi8C7jL'
    ).trim();

    this.logger.log(
      `Razorpay KeyId loaded: ${this.razorpayKeyId ? this.razorpayKeyId.substring(0, 8) + '...' : 'NOT SET'}`,
    );

    if (this.razorpayKeyId && this.razorpayKeySecret) {
      this.razorpay = new Razorpay({
        key_id: this.razorpayKeyId,
        key_secret: this.razorpayKeySecret,
      });
    }
  }

  async createRazorpayOrder(
    customerId: string,
    amount: number,
    tenantId?: string | null,
  ) {
    if (amount < 1) {
      throw new BadRequestException('Amount must be at least 1 rupee');
    }

    const config =
      await this.tenantIntegrationConfigService.getRazorpayConfig(tenantId);
    const keyId = config.keyId || this.razorpayKeyId;
    const keySecret = config.keySecret || this.razorpayKeySecret;

    if (!keyId || !keySecret) {
      throw new InternalServerErrorException(
        'Razorpay credentials not configured',
      );
    }

    const razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    try {
      this.logger.log(
        `Razorpay KeyId loaded: ${this.razorpayKeyId ? this.razorpayKeyId.substring(0, 8) + '...' : 'NOT SET'}`,
      );
      this.logger.log(
        `Razorpay KeySecret loaded: ${this.razorpayKeySecret ? this.razorpayKeySecret.substring(0, 8) + '...' : 'NOT SET'}`,
      );
      const order = await razorpayClient.orders.create({
        amount: amount * 100,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
      });

      const resolvedTenantId = tenantId ?? this.tenantContext.requireTenantId();
      const dedicated = this.tenantContext.usesDedicatedDatabase();
      const paymentRepo = await this.tenantRepos.getRepository(Payment);
      const payment = paymentRepo.create({
        customerId,
        razorpayOrderId: order.id,
        amount,
        status: PaymentStatus.PENDING,
        tenantId: dedicated ? null : resolvedTenantId,
      });
      const savedPayment = await paymentRepo.save(payment);
      this.logger.log(
        `Payment order created: ${savedPayment.id}, Razorpay Order ID: ${order.id}`,
      );

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      };
    } catch (error) {
      try {
        const errDetails = JSON.stringify(
          error,
          Object.getOwnPropertyNames(error),
        );
        this.logger.error('Failed to create Razorpay order', errDetails);
      } catch (logErr) {
        this.logger.error('Failed to create Razorpay order', error);
      }

      throw new InternalServerErrorException('Failed to create Razorpay order');
    }
  }

  async verifyPayment(
    customerId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    tenantId?: string | null,
  ) {
    const config =
      await this.tenantIntegrationConfigService.getRazorpayConfig(tenantId);
    const keySecret = config.keySecret || this.razorpayKeySecret;

    this.logger.log(
      `Verifying payment - Order ID: ${razorpayOrderId}, Payment ID: ${razorpayPaymentId}`,
    );

    const resolvedTenantId = tenantId ?? this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const paymentRepo = await this.tenantRepos.getRepository(Payment);
    const payment = await paymentRepo.findOne({
      where: tenantWhere(resolvedTenantId, { razorpayOrderId }, dedicated),
    });

    if (!payment) {
      this.logger.error(
        `Payment record not found for order ID: ${razorpayOrderId}`,
      );
      throw new BadRequestException('Invalid order ID');
    }

    if (payment.customerId !== customerId) {
      this.logger.error(
        `Order ${razorpayOrderId} does not belong to customer ${customerId}`,
      );
      throw new BadRequestException('Order does not belong to this customer');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      this.logger.warn(`Payment ${payment.id} already processed`);
      throw new ConflictException('Payment already processed');
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const isValidSignature = razorpaySignature === expectedSignature;

    if (!isValidSignature) {
      this.logger.error(
        `Invalid signature for order ${razorpayOrderId}. Expected: ${expectedSignature}, Received: ${razorpaySignature}`,
      );

      payment.status = PaymentStatus.FAILED;
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;

      try {
        await paymentRepo.save(payment);
        this.logger.log(
          `Payment ${payment.id} marked as FAILED and payment details saved`,
        );
      } catch (saveError) {
        this.logger.error(`Failed to save payment record: ${saveError}`);
      }

      throw new BadRequestException('Invalid payment signature');
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;

    try {
      await paymentRepo.save(payment);
      this.logger.log(
        `Payment ${payment.id} verified and saved - Payment ID: ${razorpayPaymentId}`,
      );
    } catch (saveError) {
      this.logger.error(`Failed to save payment record: ${saveError}`);
      throw new InternalServerErrorException('Failed to update payment record');
    }

    const { wallet } = await this.walletService.creditWallet(
      customerId,
      payment.amount,
      razorpayPaymentId,
      `Wallet recharge via Razorpay - Order ${razorpayOrderId}`,
    );

    this.logger.log(
      `Wallet credited for customer ${customerId}. New balance: ${wallet.balance}`,
    );

    return {
      success: true,
      message: 'Payment verified and wallet credited',
      newBalance: Number(wallet.balance),
    };
  }
}
