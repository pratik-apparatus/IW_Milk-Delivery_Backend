import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import {
  Subscription,
  PlanType,
  SubscriptionStatus,
} from '../../entities/subscription.entity';
import { Customer } from '../../entities/customer.entity';
import { Product } from '../../entities/product.entity';
import { WalletService } from '../wallet/wallet.service';
import { CreateSubscriptionDto } from '../../dto/subscription.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { applyPagination } from '../../common/utils/pagination.util';
import { applySearch } from '../../common/utils/search.util';
import { NoRecordsFoundException } from '../../common/exceptions/no-records-found.exception';
import { SubscriptionDeliveryLog } from '../../entities/subscription-delivery-log.entity';
import { TenantContextService } from '../../common/services/tenant-context.service';
import {
  applyTenantFilter,
  tenantWhere,
} from '../../common/utils/tenant-scope.util';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly walletService: WalletService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Create subscription with backend-calculated values
   */
  async createSubscription(
    customerId: string,
    dto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const customerRepo = await this.tenantRepos.getRepository(Customer);
    const productRepo = await this.tenantRepos.getRepository(Product);
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const customer = await customerRepo.findOne({
      where: tenantWhere(tenantId, { id: customerId }, dedicated),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Validate product
    const product = await productRepo.findOne({
      where: tenantWhere(tenantId, { id: dto.productId }, dedicated),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    // Parse dates from DD/MM/YYYY format
    const startDate = this.parseDate(dto.startDate);
    if (!startDate) {
      throw new BadRequestException(
        'Invalid startDate format. Expected DD/MM/YYYY',
      );
    }

    let endDate: Date | null = null;
    if (dto.endDate) {
      endDate = this.parseDate(dto.endDate);
      if (!endDate) {
        throw new BadRequestException(
          'Invalid endDate format. Expected DD/MM/YYYY',
        );
      }
    }

    // Force startDate to be at least tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date(); // Keep today for calculation needs further down
    today.setHours(0, 0, 0, 0);

    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0);

    // Auto-adjust to tomorrow if they tried to pick today or the past
    let finalStartDate = startDate;
    if (startDateOnly < tomorrow) {
      finalStartDate = tomorrow;
    }

    // Validate endDate >= startDate
    if (endDate) {
      const endDateOnly = new Date(endDate);
      endDateOnly.setHours(0, 0, 0, 0);
      if (endDateOnly < startDateOnly) {
        throw new BadRequestException(
          'End date must be greater than or equal to start date',
        );
      }
    }

    // Validate WEEKLY requires selectedDays
    if (dto.planType === PlanType.WEEKLY) {
      if (!dto.selectedDays || dto.selectedDays.length === 0) {
        throw new BadRequestException('WEEKLY plan type requires selectedDays');
      }
    }

    // Set default quantity
    const quantity = dto.quantity || 1;

    // Calculate delivery dates and totals
    const deliveryDates = this.calculateDeliveryDates(
      dto.planType,
      finalStartDate,
      endDate,
      dto.selectedDays,
      dto.skipPattern,
      dto.nthDay,
    );

    const totalDeliveries = deliveryDates.length;
    const totalQuantityNeeded = totalDeliveries * quantity;

    // Check if product has enough quantity for the entire subscription duration
    const availableStock = product.remainingQuantity ?? product.quantity;
    if (availableStock < totalQuantityNeeded) {
      throw new BadRequestException(
        `Insufficient stock to fulfill this subscription. Required: ${totalQuantityNeeded}, Available: ${availableStock}`,
      );
    }

    const totalAmount = Number(product.price) * totalDeliveries * quantity;
    const nextDeliveryDate = this.getNextDeliveryDate(deliveryDates, today);

    // Check wallet balance
    const hasBalance = await this.walletService.hasSufficientBalance(
      customerId,
      totalAmount,
    );
    if (!hasBalance) {
      throw new BadRequestException(
        `Insufficient wallet balance. Required: ${totalAmount}`,
      );
    }

    // Create address and phone snapshots
    const addressSnapshot = customer.address;
    const phoneSnapshot = customer.phone;

    // Create subscription
    const subscription = new Subscription();
    subscription.customerId = customerId;
    subscription.tenantId = dedicated ? null : tenantId;
    subscription.productId = dto.productId;
    subscription.planType = dto.planType;
    subscription.addressSnapshot = addressSnapshot;
    subscription.phoneSnapshot = phoneSnapshot;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.startDate = finalStartDate;
    subscription.endDate = endDate ?? null;
    subscription.selectedDays = dto.selectedDays ?? null;
    subscription.skipPattern = dto.skipPattern ?? null;
    subscription.quantity = quantity;
    subscription.totalDeliveries = totalDeliveries;
    subscription.totalAmount = totalAmount;
    subscription.nextDeliveryDate = nextDeliveryDate ?? null;
    subscription.nthDay = dto.nthDay ?? null;
    subscription.remainingDeliveries = totalDeliveries; // At creation, remaining equals total

    const savedSubscription = await subscriptionRepo.save(subscription);

    // Debit wallet for total subscription amount
    await this.walletService.debitWallet(
      customerId,
      totalAmount,
      savedSubscription.id,
      `Subscription started for ${product.name} - ${dto.planType} (${totalDeliveries} deliveries)`,
    );

    // Return subscription with product relation and calculated remainingDeliveries
    const subscriptionWithProduct = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: savedSubscription.id }, dedicated),
      relations: ['product'],
    });

    if (!subscriptionWithProduct) {
      throw new NotFoundException('Subscription not found after creation');
    }

    // Calculate remaining deliveries
    subscriptionWithProduct.remainingDeliveries =
      this.calculateRemainingDeliveries(subscriptionWithProduct, today);

    return subscriptionWithProduct;
  }

  /**
   * Calculate all delivery dates based on plan type using calendar-based logic
   */
  private calculateDeliveryDates(
    planType: PlanType,
    startDate: Date,
    endDate: Date | null,
    selectedDays: string[] | undefined,
    skipPattern: string | undefined,
    nthDay: number | undefined,
  ): Date[] {
    const dates: Date[] = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    // If no endDate, calculate for 1 year ahead
    const end = endDate ? new Date(endDate) : new Date(start);
    if (!endDate) {
      end.setFullYear(end.getFullYear() + 1);
    }
    end.setHours(23, 59, 59, 999);

    // Day name mapping
    const dayMap: { [key: string]: number } = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    switch (planType) {
      case PlanType.MONTHLY:
        // Deliver EVERY day between startDate and endDate
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
        break;

      case PlanType.WEEKLY:
        // Deliver ONLY on selected weekdays between startDate and endDate
        if (!selectedDays || selectedDays.length === 0) {
          break;
        }
        const selectedDayNumbers = selectedDays
          .map((day) => dayMap[day])
          .filter((num) => num !== undefined);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (selectedDayNumbers.includes(d.getDay())) {
            dates.push(new Date(d));
          }
        }
        break;
    }

    return dates;
  }

  /**
   * Get next delivery date from delivery dates array
   */
  private getNextDeliveryDate(deliveryDates: Date[], today: Date): Date | null {
    const todayOnly = new Date(today);
    todayOnly.setHours(0, 0, 0, 0);

    for (const date of deliveryDates) {
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly >= todayOnly) {
        return date;
      }
    }

    return deliveryDates.length > 0
      ? deliveryDates[deliveryDates.length - 1]
      : null;
  }

  /**
   * Calculate remaining deliveries for a subscription
   */
  public calculateRemainingDeliveries(
    subscription: Subscription,
    today: Date,
  ): number {
    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.DELIVERED
    ) {
      return 0;
    }

    if (!subscription.startDate) {
      return 0;
    }

    // Recalculate delivery dates to get remaining count
    const deliveryDates = this.calculateDeliveryDates(
      subscription.planType,
      subscription.startDate,
      subscription.endDate || null,
      subscription.selectedDays || undefined,
      subscription.skipPattern || undefined,
      subscription.nthDay || undefined,
    );

    const todayOnly = new Date(today);
    todayOnly.setHours(0, 0, 0, 0);

    let remaining = 0;
    for (const date of deliveryDates) {
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly >= todayOnly) {
        remaining++;
      }
    }

    return remaining;
  }

  /**
   * Parse date from DD/MM/YYYY format
   */
  private parseDate(dateString: string): Date | null {
    try {
      const [day, month, year] = dateString.split('/').map(Number);
      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return null;
      }
      // Month is 0-indexed in JavaScript Date
      const date = new Date(year, month - 1, day);
      // Validate the date is correct (handles invalid dates like 32/13/2026)
      if (
        date.getDate() !== day ||
        date.getMonth() !== month - 1 ||
        date.getFullYear() !== year
      ) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  /**
   * Calculate next delivery date from start date
   */
  private calculateNextDeliveryDateFromStartDate(
    planType: PlanType,
    startDate: Date,
  ): Date {
    const nextDate = new Date(startDate);

    switch (planType) {
      case PlanType.WEEKLY:
        nextDate.setDate(startDate.getDate() + 7);
        break;
      case PlanType.MONTHLY:
        nextDate.setMonth(startDate.getMonth() + 1);
        break;
      default:
        // For NTH_DAY or unknown types, default to next day
        nextDate.setDate(startDate.getDate() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Get all subscriptions for customer with pagination and search
   */
  async getMySubscriptions(customerId: string, query: PaginationQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const { search, page, limit } = query;

    const qb = subscriptionRepo
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.product', 'product')
      .where('subscription.customerId = :customerId', { customerId });
    applyTenantFilter(qb, tenantId, 'subscription', dedicated);

    if (search) {
      applySearch(qb, search, [
        'product.name',
        'subscription.planType',
        'subscription.status',
      ]);
    }

    qb.orderBy('subscription.createdAt', 'DESC');

    const result = await applyPagination(qb, page, limit);

    if (search && result.meta.total === 0) {
      throw new NoRecordsFoundException();
    }

    // Calculate remainingDeliveries for each subscription
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    result.data = result.data.map((sub: Subscription) => {
      sub.remainingDeliveries = this.calculateRemainingDeliveries(sub, today);
      return sub;
    });

    return result;
  }

  // delete history of subscriptions
  async deleteSubscriptionLogs(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );
    const Logs = await deliveryLogRepo.find({
      where: tenantWhere(tenantId, { id }, dedicated),
    });

    if (!Logs || Logs.length === 0) {
      throw new NotFoundException('No delivered subscription logs found');
    }

    await deliveryLogRepo.remove(Logs);

    return {
      message: 'Delivered subscription logs deleted successfully',
      count: Logs.length,
    };
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(
    customerId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(
        tenantId,
        { id: subscriptionId, customerId },
        dedicated,
      ),
      relations: ['product'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Calculate remainingDeliveries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    subscription.remainingDeliveries = this.calculateRemainingDeliveries(
      subscription,
      today,
    );

    return subscription;
  }

  /**
   * Get active subscriptions
   * Keeping this for specific active-only scenarios if needed, or can be replaced by getMySubscriptions with filtered status
   */
  async getActiveSubscriptions(customerId: string): Promise<Subscription[]> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscriptions = await subscriptionRepo.find({
      where: tenantWhere(
        tenantId,
        {
          customerId,
          status: SubscriptionStatus.ACTIVE,
        },
        dedicated,
      ),
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });

    // Calculate remainingDeliveries for each subscription
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return subscriptions.map((sub) => {
      sub.remainingDeliveries = this.calculateRemainingDeliveries(sub, today);
      return sub;
    });
  }

  /**
   * Pause subscription (idempotent - safe to call multiple times)
   */
  async pauseSubscription(
    customerId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(
        tenantId,
        { id: subscriptionId, customerId },
        dedicated,
      ),
      relations: ['product'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Idempotent: if already paused, just return it
    if (subscription.status === SubscriptionStatus.PAUSED) {
      return subscription;
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can be paused');
    }

    subscription.status = SubscriptionStatus.PAUSED;
    subscription.remainingDeliveries = this.calculateRemainingDeliveries(
      subscription,
      new Date(),
    );
    await subscriptionRepo.save(subscription);

    const updatedSubscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
      relations: ['product'],
    });

    if (!updatedSubscription) {
      throw new NotFoundException('Subscription not found after update');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    updatedSubscription.remainingDeliveries = this.calculateRemainingDeliveries(
      updatedSubscription,
      today,
    );

    return updatedSubscription;
  }

  /**
   * Resume subscription (idempotent - safe to call multiple times)
   */
  async resumeSubscription(
    customerId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(
        tenantId,
        { id: subscriptionId, customerId },
        dedicated,
      ),
      relations: ['product'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Idempotent: if already active, just return it
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return subscription;
    }

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Only paused subscriptions can be resumed');
    }

    subscription.status = SubscriptionStatus.ACTIVE;

    // Recalculate next delivery date using the new calculation logic
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const baseDate = subscription.startDate || now;

    // Recalculate all delivery dates to get the next one
    const deliveryDates = this.calculateDeliveryDates(
      subscription.planType,
      baseDate,
      subscription.endDate || null,
      subscription.selectedDays || undefined,
      subscription.skipPattern || undefined,
      subscription.nthDay ?? undefined,
    );

    subscription.nextDeliveryDate = this.getNextDeliveryDate(
      deliveryDates,
      now,
    );
    subscription.remainingDeliveries = this.calculateRemainingDeliveries(
      subscription,
      now,
    );
    await subscriptionRepo.save(subscription);

    const updatedSubscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
      relations: ['product'],
    });

    if (!updatedSubscription) {
      throw new NotFoundException('Subscription not found after update');
    }

    updatedSubscription.remainingDeliveries = this.calculateRemainingDeliveries(
      updatedSubscription,
      now,
    );

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    customerId: string,
    subscriptionId: string,
  ): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(
        tenantId,
        { id: subscriptionId, customerId },
        dedicated,
      ),
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.remainingDeliveries = 0;
    await subscriptionRepo.save(subscription);
  }

  async addMissedDelivery(
    customerId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(
        tenantId,
        { id: subscriptionId, customerId },
        dedicated,
      ),
      relations: ['product'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active subscriptions can have missed deliveries added',
      );
    }

    if (!subscription.startDate) {
      throw new BadRequestException('Subscription has no start date');
    }

    // Logic to add a missed delivery by adjusting the next delivery date based on the plan and skip pattern
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Calculate all delivery dates to find the next one
    const deliveryDates = this.calculateDeliveryDates(
      subscription.planType,
      subscription.startDate,
      subscription.endDate,
      subscription.selectedDays || undefined,
      subscription.skipPattern || undefined,
      subscription.nthDay ?? undefined,
    );

    const nextDeliveryDate = this.getNextDeliveryDate(deliveryDates, now);
    if (!nextDeliveryDate) {
      throw new BadRequestException(
        'No upcoming delivery dates found for this subscription',
      );
    }

    // Use the calculated next delivery date (based on the subscription pattern)
    subscription.nextDeliveryDate = nextDeliveryDate;
    subscription.remainingDeliveries = this.calculateRemainingDeliveries(
      subscription,
      now,
    );

    await subscriptionRepo.save(subscription);

    const updatedSubscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
      relations: ['product'],
    });

    if (!updatedSubscription) {
      throw new NotFoundException('Subscription not found after update');
    }

    updatedSubscription.remainingDeliveries = this.calculateRemainingDeliveries(
      updatedSubscription,
      now,
    );

    return updatedSubscription;
  }

  /**
   * Calculate next delivery date based on plan type
   */
  private calculateNextDeliveryDate(planType: PlanType, nthDay?: number): Date {
    const now = new Date();
    const nextDate = new Date(now);

    switch (planType) {
      case PlanType.WEEKLY:
        nextDate.setDate(now.getDate() + 7);
        break;
      case PlanType.MONTHLY:
        nextDate.setMonth(now.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  /**
   * Calculate next delivery date from a base date (used by scheduler)
   * This is public so scheduler can use it
   */
  /**
   * Calculate next delivery date by scanning the calendar starting from the day AFTER baseDate
   */
  calculateNextDeliveryDateFromBase(
    subscription: Subscription,
    baseDate: Date,
  ): Date | null {
    const nextStart = new Date(baseDate);
    nextStart.setDate(nextStart.getDate() + 1);
    nextStart.setHours(0, 0, 0, 0);

    const endDate = subscription.endDate
      ? new Date(subscription.endDate)
      : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
      if (nextStart > endDate) return null;
    }

    // Reuse calculateDeliveryDates logic but only for the future
    const futureDates = this.calculateDeliveryDates(
      subscription.planType,
      nextStart,
      subscription.endDate,
      subscription.selectedDays || undefined,
      subscription.skipPattern || undefined,
      subscription.nthDay || undefined,
    );

    return futureDates.length > 0 ? futureDates[0] : null;
  }
}
