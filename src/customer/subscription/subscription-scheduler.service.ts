import { Injectable, Logger } from '@nestjs/common';
import { LessThanOrEqual, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  Subscription,
  SubscriptionStatus,
} from '../../entities/subscription.entity';
import { OrderService } from '../order/order.service';
import { SubscriptionService } from './subscription.service';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly orderService: OrderService,
    private readonly subscriptionService: SubscriptionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Cron('0 2 * * *')
  async processSubscriptionsDueForDelivery() {
    const result = await this.executeSubscriptionProcessing();
    this.logger.log(
      `Subscription processing completed: ${result.summary.processed} successful, ${result.summary.paused} paused, ${result.summary.errors} errors`,
    );
  }

  private async executeSubscriptionProcessing(
    subscriptionId?: string,
  ): Promise<{
    summary: { processed: number; paused: number; errors: number };
    details: any[];
  }> {
    this.logger.log('Starting subscription delivery processing...');
    const details: any[] = [];

    try {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const tenantId = this.tenantContext.getTenantId();
      const dedicated = this.tenantContext.usesDedicatedDatabase();
      const subscriptionRepo =
        await this.tenantRepos.getRepository(Subscription);
      const whereCondition: any = {
        status: SubscriptionStatus.ACTIVE,
        nextDeliveryDate: LessThanOrEqual(endOfToday),
      };

      if (tenantId && !dedicated) {
        whereCondition.tenantId = tenantId;
      }

      if (subscriptionId) {
        whereCondition.id = subscriptionId;
      }

      const dueSubscriptions = await subscriptionRepo.find({
        where: whereCondition,
        relations: ['product', 'customer'],
      });

      this.logger.log(
        `Found ${dueSubscriptions.length} subscriptions due for delivery`,
      );

      let processed = 0;
      let paused = 0;
      let errors = 0;

      for (const subscription of dueSubscriptions) {
        try {
          const wasPaused =
            await this.processSubscriptionDelivery(subscription);

          details.push({
            subscriptionId: subscription.id,
            customerName: subscription.customer?.name || 'Unknown',
            productName: subscription.product?.name || 'Unknown',
            status: wasPaused ? 'PAUSED' : 'PROCESSED',
            nextDeliveryDate: subscription.nextDeliveryDate,
            remainingDeliveries: subscription.remainingDeliveries,
          });

          if (wasPaused) {
            paused++;
          } else {
            processed++;
          }
        } catch (error) {
          errors++;
          details.push({
            subscriptionId: subscription.id,
            customerName: subscription.customer?.name || 'Unknown',
            error: error.message,
          });
          this.logger.error(
            `Failed to process subscription ${subscription.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      return {
        summary: { processed, paused, errors },
        details,
      };
    } catch (error) {
      this.logger.error(
        `Error in subscription scheduler: ${error.message}`,
        error.stack,
      );
      return {
        summary: { processed: 0, paused: 0, errors: 1 },
        details: [],
      };
    }
  }

  private async processSubscriptionDelivery(
    subscription: Subscription,
  ): Promise<boolean> {
    const { customerId, product, addressSnapshot, phoneSnapshot } =
      subscription;
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);

    if (!product) {
      throw new Error(`Product not found for subscription ${subscription.id}`);
    }

    if (!product.isActive) {
      this.logger.warn(
        `Product ${product.id} is inactive for subscription ${subscription.id}. Pausing subscription.`,
      );
      subscription.status = SubscriptionStatus.PAUSED;
      await subscriptionRepo.save(subscription);
      return true;
    }

    const productPrice = Number(product.price);

    try {
      const order = await this.orderService.createOrderFromSubscription(
        customerId,
        subscription.id,
        product.id,
        productPrice,
        addressSnapshot,
        phoneSnapshot,
        subscription.quantity,
      );

      const nextDeliveryDate =
        this.subscriptionService.calculateNextDeliveryDateFromBase(
          subscription,
          subscription.nextDeliveryDate || new Date(),
        );

      if (nextDeliveryDate) {
        subscription.nextDeliveryDate = nextDeliveryDate;
        this.logger.log(
          `Processed subscription delivery for ${subscription.id}. Order: ${order.id}. Next: ${nextDeliveryDate.toISOString()}`,
        );
      } else {
        subscription.status = SubscriptionStatus.DELIVERED;
        subscription.nextDeliveryDate = null;
        this.logger.log(
          `Final delivery processed for subscription ${subscription.id}. Order: ${order.id}. Marked as ${SubscriptionStatus.DELIVERED}.`,
        );
      }

      subscription.remainingDeliveries =
        this.subscriptionService.calculateRemainingDeliveries(
          subscription,
          subscription.nextDeliveryDate || new Date(),
        );

      await subscriptionRepo.save(subscription);
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to process subscription ${subscription.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async triggerSubscriptionProcessing(subscriptionId?: string) {
    this.logger.log(
      `Manual subscription processing triggered${subscriptionId ? ` for ID ${subscriptionId}` : ''}`,
    );

    const tenantId = this.tenantContext.getTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);

    const subscriptionsToFix = await subscriptionRepo.find({
      where:
        tenantId && !dedicated
          ? { remainingDeliveries: IsNull(), tenantId }
          : { remainingDeliveries: IsNull() },
    });

    if (subscriptionsToFix.length > 0) {
      this.logger.log(
        `Found ${subscriptionsToFix.length} subscriptions with missing remaining count. Healing data...`,
      );
      const today = new Date();
      for (const sub of subscriptionsToFix) {
        sub.remainingDeliveries =
          this.subscriptionService.calculateRemainingDeliveries(sub, today);
        await subscriptionRepo.save(sub);
      }
      this.logger.log('Data healing completed.');
    }

    return await this.executeSubscriptionProcessing(subscriptionId);
  }
}
