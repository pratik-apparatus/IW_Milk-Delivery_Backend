import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Subscription,
  SubscriptionStatus,
} from 'src/entities/subscription.entity';
import { SubscriptionDeliveryLog } from 'src/entities/subscription-delivery-log.entity';
import { DeliveryPartner } from 'src/entities/delivery-partner.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { applyPagination } from 'src/common/utils/pagination.util';
import { applySearch } from 'src/common/utils/search.util';
import { NoRecordsFoundException } from 'src/common/exceptions/no-records-found.exception';
import { AdminSubscriptionFilterDto } from './dto/subscription-filter.dto';
import { UpdateSubscriptionLogStatusDto } from './dto/update-log-status.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { TenantContextService } from 'src/common/services/tenant-context.service';
import { TenantRepositoryService } from 'src/common/database/tenant-repository.service';
import {
  applyTenantFilter,
  tenantWhere,
} from 'src/common/utils/tenant-scope.util';

@Injectable()
export class subscriptionService {
  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getallsub(query: AdminSubscriptionFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const { search, page, limit, date, deliveryPartnerId, status } = query;

    const qb = subscriptionRepo
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.customer', 'customer')
      .leftJoinAndSelect('subscription.product', 'product')
      .leftJoinAndSelect('subscription.deliveryPartner', 'deliveryPartner');
    applyTenantFilter(qb, tenantId, 'subscription', dedicated);

    if (search) {
      applySearch(qb, search, [
        'customer.name',
        'customer.phone',
        'product.name',
        'subscription.planType',
        'subscription.status',
        'deliveryPartner.name',
      ]);
    }

    if (date) {
      qb.andWhere(
        '(subscription.nextDeliveryDate <= :filterDate OR EXISTS (SELECT 1 FROM subscription_delivery_logs log WHERE log.subscriptionId = subscription.id AND log.deliveryDate = :date))',
        {
          filterDate: new Date(date),
          date,
        },
      );
      qb.leftJoinAndSelect(
        'subscription.deliveryLogs',
        'deliveryLogs',
        'deliveryLogs.deliveryDate = :date',
        { date },
      );
    }

    if (deliveryPartnerId) {
      qb.andWhere('subscription.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId,
      });
    }

    if (status) {
      qb.andWhere('subscription.status = :status', { status });
    }

    qb.orderBy('subscription.createdAt', 'DESC');

    const result = await applyPagination(qb, page, limit);

    if (search && result.meta.total === 0) {
      throw new NoRecordsFoundException();
    }

    const groupedData = this.groupSubscriptionsByCustomer(result.data);

    const dataWithCustomerName = groupedData.map((item: any) => {
      if (item.customer) {
        item.customerName = item.customer.name;
      } else {
        item.customerName = null;
      }
      return item;
    });

    return {
      data: dataWithCustomerName,
      meta: result.meta,
    };
  }

  private groupSubscriptionsByCustomer(subscriptions: any[]) {
    const customerMap = new Map<string, any>();

    subscriptions.forEach((subscription) => {
      const customerId = subscription.customerId || 'null-customer';

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer: subscription.customer || null,
          subscriptions: [],
        });
      }

      const { customer, ...subscriptionData } = subscription;
      customerMap.get(customerId).subscriptions.push(subscriptionData);
    });

    return Array.from(customerMap.values());
  }

  async getSubscriptionsByCustomerId(customerId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscriptions = await subscriptionRepo.find({
      where: tenantWhere(tenantId, { customerId }, dedicated),
      relations: [
        'customer',
        'product',
        'deliveryPartner',
        'deliveryLogs',
        'orders',
      ],
    });

    if (!subscriptions || subscriptions.length === 0) {
      throw new NotFoundException('No subscriptions found for this customer');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const detailedSubscriptions = subscriptions.map((subscription) => {
      const expectedDates = this.calculateExpectedDeliveryDates(subscription);

      const loggedDates = (subscription.deliveryLogs || [])
        .filter((l) => l.status === 'DELIVERED')
        .map((log) => log.deliveryDate);

      const orderedDates = (subscription.orders || [])
        .filter((o) => o.status !== 'CANCELLED' && o.status !== 'FAILED')
        .map((o) => {
          const d = o.scheduledDeliveryDate
            ? new Date(o.scheduledDeliveryDate)
            : new Date(o.createdAt);
          return this.formatToYYYYMMDD(d);
        });

      const missedDates = expectedDates
        .filter((date) => {
          const dateStr = this.formatToYYYYMMDD(date);
          return (
            date < today &&
            !loggedDates.includes(dateStr) &&
            !orderedDates.includes(dateStr)
          );
        })
        .map((date) => this.formatToYYYYMMDD(date));

      const nextActualDate = expectedDates.find((date) => date >= today);
      const remainingDeliveries = expectedDates.filter(
        (date) => date >= today,
      ).length;

      return {
        ...subscription,
        missedDates,
        autoCalculatedNextDate: nextActualDate
          ? this.formatToYYYYMMDD(nextActualDate)
          : null,
        remainingDeliveries,
        isMissed: missedDates.length > 0,
      };
    });

    return {
      customer: subscriptions[0].customer,
      subscriptions: detailedSubscriptions,
    };
  }

  private calculateExpectedDeliveryDates(subscription: Subscription): Date[] {
    if (!subscription.startDate) return [];
    const dates: Date[] = [];
    const start = new Date(subscription.startDate);
    start.setHours(0, 0, 0, 0);

    const end = subscription.endDate
      ? new Date(subscription.endDate)
      : new Date(start);
    if (!subscription.endDate) {
      end.setFullYear(end.getFullYear() + 1);
    }
    end.setHours(23, 59, 59, 999);

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

    const planType = subscription.planType as string;

    switch (planType) {
      case 'MONTHLY':
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
        break;

      case 'WEEKLY':
        if (subscription.selectedDays && subscription.selectedDays.length > 0) {
          const selectedDayNums = subscription.selectedDays
            .map((day) => dayMap[day])
            .filter((n) => n !== undefined);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (selectedDayNums.includes(d.getDay())) {
              dates.push(new Date(d));
            }
          }
        }
        break;
    }

    return dates;
  }

  async deleteSubscription(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id }, dedicated),
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    await subscriptionRepo.delete(tenantWhere(tenantId, { id }, dedicated));
    return {
      message: 'Subscription deleted successfully',
      data: subscription,
    };
  }

  async assignDeliveryPartner(
    subscriptionId: string,
    deliveryPartnerId: string,
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const deliveryPartnerRepo =
      await this.tenantRepos.getRepository(DeliveryPartner);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const deliveryPartner = await deliveryPartnerRepo.findOne({
      where: tenantWhere(tenantId, { id: deliveryPartnerId }, dedicated),
    });
    if (!deliveryPartner) {
      throw new NotFoundException('Delivery partner not found');
    }

    if (deliveryPartner.isBanned || !deliveryPartner.isActive) {
      throw new BadRequestException(
        'Cannot assign a banned or inactive delivery partner',
      );
    }

    subscription.deliveryPartnerId = deliveryPartnerId;
    await subscriptionRepo.save(subscription);

    const updatedSubscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
      relations: ['customer', 'product', 'deliveryPartner'],
    });

    return {
      message: 'Delivery partner assigned successfully',
      subscription: updatedSubscription,
    };
  }

  async updateDeliveryPartner(
    subscriptionId: string,
    deliveryPartnerId: string,
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const deliveryPartnerRepo =
      await this.tenantRepos.getRepository(DeliveryPartner);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
      relations: ['deliveryPartner'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.deliveryPartnerId === deliveryPartnerId) {
      throw new BadRequestException(
        `This subscription is already assigned to delivery partner ID: ${deliveryPartnerId}`,
      );
    }

    const previousDeliveryPartner = subscription.deliveryPartner;

    const newDeliveryPartner = await deliveryPartnerRepo.findOne({
      where: tenantWhere(tenantId, { id: deliveryPartnerId }, dedicated),
    });
    if (!newDeliveryPartner) {
      throw new NotFoundException('Delivery partner not found');
    }

    if (newDeliveryPartner.isBanned || !newDeliveryPartner.isActive) {
      throw new BadRequestException(
        'Cannot assign a banned or inactive delivery partner',
      );
    }

    const updateQb = subscriptionRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({ deliveryPartnerId: deliveryPartnerId })
      .where('id = :id', { id: subscriptionId });

    if (!dedicated) {
      updateQb.andWhere('tenantId = :tenantId', { tenantId });
    }

    await updateQb.execute();

    const updatedSubscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
      relations: ['customer', 'product', 'deliveryPartner'],
    });

    if (!updatedSubscription) {
      throw new NotFoundException('Failed to fetch updated subscription');
    }

    return {
      message: 'Delivery partner updated successfully',
      previousDeliveryPartner: previousDeliveryPartner
        ? {
            id: previousDeliveryPartner.id,
            name: previousDeliveryPartner.name,
          }
        : null,
      newDeliveryPartner: {
        id: newDeliveryPartner.id,
        name: newDeliveryPartner.name,
      },
      subscription: updatedSubscription,
    };
  }

  async getDeliveryHistory(query: PaginationQueryDto, subscriptionId?: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );
    const { page, limit } = query;

    const qb = deliveryLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.subscription', 'subscription')
      .leftJoinAndSelect('subscription.customer', 'customer')
      .leftJoinAndSelect('subscription.product', 'product')
      .leftJoinAndSelect('log.deliveryPartner', 'deliveryPartner');
    applyTenantFilter(qb, tenantId, 'log', dedicated);

    if (subscriptionId) {
      qb.andWhere('log.subscriptionId = :subscriptionId', { subscriptionId });
    }

    qb.orderBy('log.deliveryDate', 'DESC');

    return applyPagination(qb, page, limit);
  }

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

  async updateSubscriptionLogStatus(
    logId: string,
    dto: UpdateSubscriptionLogStatusDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );
    const log = await deliveryLogRepo.findOne({
      where: tenantWhere(tenantId, { id: logId }, dedicated),
    });

    if (!log) {
      throw new NotFoundException('Subscription log entry not found');
    }

    log.status = dto.status;
    if (dto.notes) {
      log.notes = dto.notes;
    }

    await deliveryLogRepo.save(log);

    return {
      message: 'Subscription log status updated successfully',
      data: log,
    };
  }

  async extendSubscriptionForMissedDelivery(
    subscriptionId: string,
    dto: ExtendSubscriptionDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (!subscription.endDate || !subscription.startDate) {
      throw new BadRequestException(
        'This subscription does not have a set start or end date to extend',
      );
    }

    const missedDate = new Date(dto.missedDate);
    const weekday = missedDate.getDay();

    const currentEndDate = new Date(subscription.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + 1);

    while (newEndDate.getDay() !== weekday) {
      newEndDate.setDate(newEndDate.getDate() + 1);
    }

    subscription.endDate = newEndDate;

    const allExpectedDates = this.calculateExpectedDeliveryDates(subscription);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const missedDateOnly = new Date(missedDate);
    missedDateOnly.setHours(0, 0, 0, 0);

    const nextActualDate = allExpectedDates.find((date) => {
      const dOnly = new Date(date);
      dOnly.setHours(0, 0, 0, 0);
      return dOnly > missedDateOnly && dOnly >= today;
    });

    if (nextActualDate) {
      subscription.nextDeliveryDate = nextActualDate;
    }

    await subscriptionRepo.save(subscription);

    return {
      message: `Subscription extended successfully. New end date is ${this.formatToYYYYMMDD(newEndDate)}`,
      data: {
        id: subscription.id,
        oldEndDate: this.formatToYYYYMMDD(currentEndDate),
        newEndDate: this.formatToYYYYMMDD(newEndDate),
        nextDeliveryDate: subscription.nextDeliveryDate
          ? this.formatToYYYYMMDD(subscription.nextDeliveryDate)
          : null,
        totalDeliveries: subscription.totalDeliveries,
      },
    };
  }

  private formatToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
