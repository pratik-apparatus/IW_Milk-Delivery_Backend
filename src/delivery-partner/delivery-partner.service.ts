import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TenantRepositoryService } from '../common/database/tenant-repository.service';
import { Order, OrderStatus } from '../entities/order.entity';
import { Customer } from '../entities/customer.entity';
import { DeliveryPartner } from '../entities/delivery-partner.entity';
import { NotificationIntegrationService } from '../common/services/notification-integration.service';
import {
  UpdateDeliveryStatusDto,
  AssignedOrderResponseDto,
  CustomerDetailsResponseDto,
  UpdateSubscriptionDeliveryStatusDto,
  AssignedSubscriptionResponseDto,
  DeliveryPartnerProfileResponseDto,
  CombinedDeliveryResponseDto,
  StartBatchDeliveryDto,
} from '../dto/delivery-partner.dto';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity';
import {
  SubscriptionDeliveryLog,
  DeliveryStatus,
} from '../entities/subscription-delivery-log.entity';
import { User, Role } from '../entities/user.entity';
import { DeliveryPartnerQueryDto } from './dto/delivery-partner-query.dto';
import {
  applyPagination,
  PaginationResult,
} from '../common/utils/pagination.util';
import { TenantContextService } from '../common/services/tenant-context.service';
import {
  applyTenantFilter,
  tenantWhere,
} from '../common/utils/tenant-scope.util';

@Injectable()
export class DeliveryPartnerService {
  private readonly logger = new Logger(DeliveryPartnerService.name);

  // Define valid status transitions
  private statusTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [],
    [OrderStatus.ASSIGNED]: [
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.FAILED,
    ],
    [OrderStatus.ACCEPTED]: [],
    [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.FAILED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationIntegrationService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private requireTenantId(): string {
    return this.tenantContext.requireTenantId();
  }

  /**
   * Get delivery partner ID from user ID
   */
  async getDeliveryPartnerByUserId(userId: string): Promise<DeliveryPartner> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryPartnerRepo =
      await this.tenantRepos.getRepository(DeliveryPartner);
    const partner = await deliveryPartnerRepo.findOne({
      where: tenantWhere(tenantId, { userId }, dedicated),
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner profile not found');
    }

    return partner;
  }

  /**
   * Fetch all orders assigned to this delivery partner
   */
  async getAssignedOrders(
    deliveryPartnerId: string,
    date?: string,
  ): Promise<AssignedOrderResponseDto[]> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const activeStatuses = [OrderStatus.ASSIGNED];

    let query = orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId,
      })
      .andWhere('order.status IN (:...statuses)', { statuses: activeStatuses });
    applyTenantFilter(query, tenantId, 'order', dedicated);

    if (date) {
      query = query.andWhere('order.scheduledDeliveryDate <= :date', { date });
    }

    const orders = await query.orderBy('order.createdAt', 'DESC').getMany();

    // Fetch admin (shop) profile for pickup location
    const admin = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
    });

    return orders.map((order) => ({
      orderId: order.id,
      orderStatus: order.status,
      deliveryAddress: order.deliveryAddress || order.customer?.address || '',
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      customerName: order.customer?.name || 'Unknown',
      customerPhone: order.deliveryPhone || order.customer?.phone || '',
      deliverySlot: order.estimatedDeliveryTime || undefined,
      totalAmount: Number(order.totalAmount),
      googleMapsUrl:
        order.deliveryLatitude && order.deliveryLongitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`
          : undefined,
      pickupAddress: admin?.address || undefined,
      pickupLatitude: admin?.latitude ? Number(admin.latitude) : undefined,
      pickupLongitude: admin?.longitude ? Number(admin.longitude) : undefined,
      items: (order.items || []).map((item) => ({
        id: item.productId,
        name: item.product?.name || 'Unknown Product',
        image: item.product?.images?.[0],
        quantity: item.quantity,
        price: Number(item.price),
      })),
    }));
  }

  /**
   * Fetch all in-progress orders (not yet completed) for this delivery partner
   */
  async getInProgressOrders(
    deliveryPartnerId: string,
  ): Promise<AssignedOrderResponseDto[]> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const inProgressStatuses = [OrderStatus.OUT_FOR_DELIVERY];

    const query = orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId,
      })
      .andWhere('order.status IN (:...statuses)', {
        statuses: inProgressStatuses,
      });
    applyTenantFilter(query, tenantId, 'order', dedicated);

    const orders = await query.orderBy('order.createdAt', 'DESC').getMany();

    // Fetch admin (shop) profile for pickup location
    const admin = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
    });

    return orders.map((order) => ({
      orderId: order.id,
      orderStatus: order.status,
      deliveryAddress: order.deliveryAddress || order.customer?.address || '',
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      customerName: order.customer?.name || 'Unknown',
      customerPhone: order.deliveryPhone || order.customer?.phone || '',
      deliverySlot: order.estimatedDeliveryTime || undefined,
      totalAmount: Number(order.totalAmount),
      googleMapsUrl:
        order.deliveryLatitude && order.deliveryLongitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`
          : undefined,
      pickupAddress: admin?.address || undefined,
      pickupLatitude: admin?.latitude ? Number(admin.latitude) : undefined,
      pickupLongitude: admin?.longitude ? Number(admin.longitude) : undefined,
      items: (order.items || []).map((item) => ({
        id: item.productId,
        name: item.product?.name || 'Unknown Product',
        image: item.product?.images?.[0],
        quantity: item.quantity,
        price: Number(item.price),
      })),
    }));
  }

  /**
   * Fetch all completed orders for this delivery partner with pagination
   */
  async getCompletedOrders(
    deliveryPartnerId: string,
    query: DeliveryPartnerQueryDto,
  ): Promise<PaginationResult<AssignedOrderResponseDto>> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const filterDate = query.date || new Date().toISOString().split('T')[0];

    const queryBuilder = orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId,
      })
      .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('DATE(order.updatedAt) = :date', { date: filterDate })
      .orderBy('order.updatedAt', 'DESC');
    applyTenantFilter(queryBuilder, tenantId, 'order', dedicated);

    const paginationResult = await applyPagination(
      queryBuilder,
      query.page,
      query.limit,
    );

    // Fetch admin (shop) profile for pickup location
    const admin = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
    });

    const mappedData = paginationResult.data.map((order) => ({
      orderId: order.id,
      orderStatus: order.status,
      deliveryAddress: order.deliveryAddress || order.customer?.address || '',
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      customerName: order.customer?.name || 'Unknown',
      customerPhone: order.deliveryPhone || order.customer?.phone || '',
      deliverySlot: order.estimatedDeliveryTime || undefined,
      totalAmount: Number(order.totalAmount),
      googleMapsUrl:
        order.deliveryLatitude && order.deliveryLongitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`
          : undefined,
      pickupAddress: admin?.address || undefined,
      pickupLatitude: admin?.latitude ? Number(admin.latitude) : undefined,
      pickupLongitude: admin?.longitude ? Number(admin.longitude) : undefined,
      items: (order.items || []).map((item) => ({
        id: item.productId,
        name: item.product?.name || 'Unknown Product',
        image: item.product?.images?.[0],
        quantity: item.quantity,
        price: Number(item.price),
      })),
    }));

    return {
      data: mappedData,
      meta: paginationResult.meta,
    };
  }

  /**
   * Get delivery partner profile
   */
  async getProfile(userId: string): Promise<DeliveryPartnerProfileResponseDto> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryPartnerRepo =
      await this.tenantRepos.getRepository(DeliveryPartner);
    const partner = await deliveryPartnerRepo.findOne({
      where: tenantWhere(tenantId, { userId }, dedicated),
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner profile not found');
    }

    const user = await this.userRepo.findOne({ where: { id: partner.userId } });

    return {
      id: partner.id,
      name: partner.name,
      email: user?.email || undefined,
      phone: user?.phone || partner.phoneNumber || '',
      address: partner.address,
      vehicleNumber: partner.vehicleNumber,
      isActive: partner.isActive,
      currentOrders: partner.CurrentOrder || 0,
    };
  }

  /**
   * Accept an assigned order
   */
  async acceptOrder(
    deliveryPartnerId: string,
    orderId: string,
  ): Promise<Order> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const order = await orderRepo.findOne({
      where: tenantWhere(tenantId, { id: orderId }, dedicated),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveryPartnerId !== deliveryPartnerId) {
      throw new ForbiddenException('This order is not assigned to you');
    }

    if (order.status !== OrderStatus.ASSIGNED) {
      throw new BadRequestException(
        `Cannot accept order. Current status is ${order.status}. Order must be in ASSIGNED status.`,
      );
    }

    order.status = OrderStatus.OUT_FOR_DELIVERY;
    return orderRepo.save(order);
  }

  //  Update order delivery status
  async updateOrderStatus(
    deliveryPartnerId: string,
    orderId: string,
    dto: UpdateDeliveryStatusDto,
  ): Promise<Order> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const deliveryPartnerRepo =
      await this.tenantRepos.getRepository(DeliveryPartner);
    const customerRepo = await this.tenantRepos.getRepository(Customer);
    const order = await orderRepo.findOne({
      where: tenantWhere(tenantId, { id: orderId }, dedicated),
      relations: ['customer'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveryPartnerId !== deliveryPartnerId) {
      throw new ForbiddenException('This order is not assigned to you');
    }

    // Validate status transition
    const allowedTransitions = this.statusTransitions[order.status] || [];
    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${dto.status}.`,
      );
    }

    const FINAL_STATES = [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ];

    const wasActive = !FINAL_STATES.includes(order.status);
    const isFinal = FINAL_STATES.includes(dto.status);

    order.status = dto.status;

    // THIS IS THE MISSING LOGIC
    if (wasActive && isFinal) {
      const partner = await deliveryPartnerRepo.findOne({
        where: tenantWhere(tenantId, { id: deliveryPartnerId }, dedicated),
      });

      if (partner) {
        partner.CurrentOrder = Math.max(0, (partner.CurrentOrder ?? 0) - 1);
        await deliveryPartnerRepo.save(partner);
      }
    }

    const savedOrder = await orderRepo.save(order);

    await this.syncSubscriptionLogFromOrder(
      order,
      dto.status,
      deliveryPartnerId,
      dto.notes,
      order.deliveryProofUrl,
      dedicated,
    );

    const partner = await deliveryPartnerRepo.findOne({
      where: tenantWhere(tenantId, { id: deliveryPartnerId }, dedicated),
    });
    const customer = await customerRepo.findOne({
      where: tenantWhere(tenantId, { id: order.customerId }, dedicated),
    });

    // Send notifications based on status change (async - don't wait)
    if (dto.status === OrderStatus.OUT_FOR_DELIVERY && customer) {
      this.notificationService
        .sendNotification({
          recipientId: order.customerId,
          recipientType: 'CUSTOMER',
          templateType: 'ORDER_OUT_FOR_DELIVERY',
          variables: {
            customerName: customer.name,
            orderId: order.id,
            partnerName: partner?.name || 'Delivery Partner',
            partnerPhone: partner?.phoneNumber || 'N/A',
          },
          channel: 'BOTH',
          fcmToken: customer.fcmToken,
        })
        .catch((err) =>
          this.logger.warn(
            'Failed to send ORDER_OUT_FOR_DELIVERY notification:',
            err.message,
          ),
        );
    }

    if (dto.status === OrderStatus.DELIVERED && customer) {
      this.notificationService
        .sendNotification({
          recipientId: order.customerId,
          recipientType: 'CUSTOMER',
          templateType: 'ORDER_DELIVERED',
          variables: {
            customerName: customer.name,
            orderId: order.id,
            partnerName: partner?.name || 'Delivery Partner',
            partnerPhone: partner?.phoneNumber || 'N/A',
          },
          channel: 'BOTH',
          fcmToken: customer.fcmToken,
        })
        .catch((err) =>
          this.logger.warn(
            'Failed to send ORDER_DELIVERED notification:',
            err.message,
          ),
        );
    }

    return savedOrder;
  }

  /**
   * Upload proof of delivery
   */
  async uploadDeliveryProof(
    deliveryPartnerId: string,
    orderId: string,
    proofUrl: string,
  ): Promise<Order> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const order = await orderRepo.findOne({
      where: tenantWhere(tenantId, { id: orderId }, dedicated),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveryPartnerId !== deliveryPartnerId) {
      throw new ForbiddenException('This order is not assigned to you');
    }

    // Allow proof upload only for specific statuses
    const allowedStatuses = [
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
      OrderStatus.FAILED,
    ];
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Proof can only be uploaded when order status is OUT_FOR_DELIVERY , DELIVERED or FAILED. Current status: ${order.status}`,
      );
    }

    order.deliveryProofUrl = proofUrl;
    return orderRepo.save(order);
  }

  async getCustomerDetails(
    deliveryPartnerId: string,
    customerId: string,
  ): Promise<CustomerDetailsResponseDto> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const order = await orderRepo.findOne({
      where: tenantWhere(
        tenantId,
        {
          customerId,
          deliveryPartnerId,
        },
        dedicated,
      ),
      relations: ['customer'],
    });

    if (!order) {
      throw new ForbiddenException(
        'You do not have access to this customer. Customer must have an order assigned to you.',
      );
    }

    const customer = order.customer;
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      name: customer.name,
      phone: order.deliveryPhone || customer.phone,
      deliveryAddress: order.deliveryAddress || customer.address || '',
      googleMapsUrl:
        order.deliveryLatitude && order.deliveryLongitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`
          : undefined,
    };
  }

  /**
   * Get subscriptions assigned to this delivery partner
   */
  async getAssignedSubscriptions(
    deliveryPartnerId: string,
    date?: string,
  ): Promise<AssignedSubscriptionResponseDto[]> {
    try {
      const tenantId = this.requireTenantId();
      const dedicated = this.tenantContext.usesDedicatedDatabase();
      const subscriptionRepo =
        await this.tenantRepos.getRepository(Subscription);
      const filterDate = date || new Date().toISOString().split('T')[0];

      const query = subscriptionRepo
        .createQueryBuilder('subscription')
        .leftJoinAndSelect('subscription.customer', 'customer')
        .leftJoinAndSelect('subscription.product', 'product')
        .leftJoinAndSelect('subscription.deliveryLogs', 'deliveryLogs')
        .where('subscription.deliveryPartnerId = :deliveryPartnerId', {
          deliveryPartnerId,
        })
        .andWhere('subscription.status = :status', {
          status: SubscriptionStatus.ACTIVE,
        })
        .andWhere(
          '(subscription.nextDeliveryDate <= :filterDate OR EXISTS (SELECT 1 FROM subscription_delivery_logs log WHERE log.subscriptionId = subscription.id AND log.deliveryDate = :logDate))',
          {
            filterDate: new Date(filterDate),
            logDate: filterDate,
          },
        );
      applyTenantFilter(query, tenantId, 'subscription', dedicated);

      const subscriptions = await query
        .orderBy('subscription.createdAt', 'DESC')
        .getMany();

      const admin = await this.userRepo.findOne({
        where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
      });

      return subscriptions.map((sub) => {
        // Check if delivered today
        const isDeliveredToday = (sub.deliveryLogs || []).some(
          (log) =>
            log.deliveryDate === filterDate &&
            log.status === DeliveryStatus.DELIVERED,
        );

        return {
          subscriptionId: sub.id,
          planType: sub.planType,
          status: sub.status,
          quantity: sub.quantity,
          productName: sub.product?.name || 'Unknown Product',
          customerName: sub.customer?.name || 'Unknown Customer',
          customerPhone: sub.phoneSnapshot || sub.customer?.phone || '',
          deliveryAddress: sub.addressSnapshot || sub.customer?.address || '',
          deliveryLatitude: sub.customer?.latitude
            ? Number(sub.customer.latitude)
            : undefined,
          deliveryLongitude: sub.customer?.longitude
            ? Number(sub.customer.longitude)
            : undefined,
          googleMapsUrl:
            sub.customer?.latitude && sub.customer?.longitude
              ? `https://www.google.com/maps/dir/?api=1&destination=${sub.customer.latitude},${sub.customer.longitude}`
              : undefined,
          nextDeliveryDate: sub.nextDeliveryDate || undefined,
          selectedDays: sub.selectedDays || undefined,
          startDate: sub.startDate || undefined,
          endDate: sub.endDate || undefined,
          isDeliveredToday,
          deliveryLogs: (sub.deliveryLogs || []).map((log) => ({
            deliveryDate: log.deliveryDate,
            status: log.status,
            notes: log.notes,
          })),
          pickupAddress: admin?.address || undefined,
          pickupLatitude: admin?.latitude ? Number(admin.latitude) : undefined,
          pickupLongitude: admin?.longitude
            ? Number(admin.longitude)
            : undefined,
          product: {
            id: sub.productId,
            name: sub.product?.name || 'Unknown Product',
            image: sub.product?.images?.[0],
            quantity: sub.quantity,
            price: sub.product?.price ? Number(sub.product.price) : undefined,
          },
        };
      });
    } catch (error) {
      this.logger.error(
        `Error in getAssignedSubscriptions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to fetch assigned subscriptions',
      );
    }
  }

  /**
   * Get completed subscriptions for this delivery partner (all delivered logs, not just today)
   */
  async getCompletedSubscriptions(
    deliveryPartnerId: string,
    query: DeliveryPartnerQueryDto,
  ): Promise<PaginationResult<AssignedSubscriptionResponseDto>> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );
    const filterDate = query.date || new Date().toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const queryBuilder = deliveryLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.subscription', 'subscription')
      .leftJoinAndSelect('subscription.customer', 'customer')
      .leftJoinAndSelect('subscription.product', 'product')
      .where('log.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId,
      })
      .andWhere('log.status = :status', { status: DeliveryStatus.DELIVERED })
      .andWhere('log.deliveryDate = :date', { date: filterDate })
      .orderBy('log.createdAt', 'DESC');
    applyTenantFilter(queryBuilder, tenantId, 'log', dedicated);

    const paginationResult = await applyPagination(
      queryBuilder,
      query.page,
      query.limit,
    );

    const admin = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
    });

    const mappedData = paginationResult.data.map((log) => {
      const sub = log.subscription;
      return {
        subscriptionId: sub.id,
        planType: sub.planType,
        status: sub.status,
        quantity: sub.quantity,
        productName: sub.product?.name || 'Unknown Product',
        customerName: sub.customer?.name || 'Unknown Customer',
        customerPhone: sub.phoneSnapshot || sub.customer?.phone || '',
        deliveryAddress: sub.addressSnapshot || sub.customer?.address || '',
        deliveryLatitude: sub.customer?.latitude
          ? Number(sub.customer.latitude)
          : undefined,
        deliveryLongitude: sub.customer?.longitude
          ? Number(sub.customer.longitude)
          : undefined,
        googleMapsUrl:
          sub.customer?.latitude && sub.customer?.longitude
            ? `https://www.google.com/maps/dir/?api=1&destination=${sub.customer.latitude},${sub.customer.longitude}`
            : undefined,
        nextDeliveryDate: sub.nextDeliveryDate || undefined,
        selectedDays: sub.selectedDays || undefined,
        startDate: sub.startDate || undefined,
        endDate: sub.endDate || undefined,
        isDeliveredToday: log.deliveryDate === todayStr,
        deliveryLogs: [
          {
            deliveryDate: log.deliveryDate,
            status: log.status,
            notes: log.notes,
          },
        ],
        pickupAddress: admin?.address || undefined,
        pickupLatitude: admin?.latitude ? Number(admin.latitude) : undefined,
        pickupLongitude: admin?.longitude ? Number(admin.longitude) : undefined,
        product: {
          id: sub.productId,
          name: sub.product?.name || 'Unknown Product',
          image: sub.product?.images?.[0],
          quantity: sub.quantity,
          price: sub.product?.price ? Number(sub.product.price) : undefined,
        },
      };
    });

    return {
      data: mappedData,
      meta: paginationResult.meta,
    };
  }
  /**
   * Get details for a specific subscription
   */
  async getSubscriptionById(
    deliveryPartnerId: string,
    subscriptionId: string,
  ): Promise<AssignedSubscriptionResponseDto> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const subQb = subscriptionRepo
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.customer', 'customer')
      .leftJoinAndSelect('subscription.product', 'product')
      .leftJoinAndSelect('subscription.deliveryLogs', 'deliveryLogs')
      .where('subscription.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId,
      })
      .andWhere('subscription.id = :subscriptionId', { subscriptionId });
    applyTenantFilter(subQb, tenantId, 'subscription', dedicated);
    const sub = await subQb.getOne();

    if (!sub) {
      throw new NotFoundException(
        'Subscription not found or not assigned to you',
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const isDeliveredToday = (sub.deliveryLogs || []).some(
      (log) =>
        log.deliveryDate === today && log.status === DeliveryStatus.DELIVERED,
    );

    // Fetch admin (shop) profile for pickup location
    const admin = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
    });

    return {
      subscriptionId: sub.id,
      planType: sub.planType,
      status: sub.status,
      quantity: sub.quantity,
      productName: sub.product?.name || 'Unknown Product',
      customerName: sub.customer?.name || 'Unknown Customer',
      customerPhone: sub.phoneSnapshot || sub.customer?.phone || '',
      deliveryAddress: sub.addressSnapshot || sub.customer?.address || '',
      deliveryLatitude: sub.customer?.latitude
        ? Number(sub.customer.latitude)
        : undefined,
      deliveryLongitude: sub.customer?.longitude
        ? Number(sub.customer.longitude)
        : undefined,
      googleMapsUrl:
        sub.customer?.latitude && sub.customer?.longitude
          ? `https://www.google.com/maps/dir/?api=1&destination=${sub.customer.latitude},${sub.customer.longitude}`
          : undefined,
      nextDeliveryDate: sub.nextDeliveryDate || undefined,
      selectedDays: sub.selectedDays || undefined,
      startDate: sub.startDate || undefined,
      endDate: sub.endDate || undefined,
      isDeliveredToday,
      deliveryLogs: (sub.deliveryLogs || []).map((log) => ({
        deliveryDate: log.deliveryDate,
        status: log.status,
        notes: log.notes,
      })),
      pickupAddress: admin?.address || undefined,
      pickupLatitude: admin?.latitude ? Number(admin.latitude) : undefined,
      pickupLongitude: admin?.longitude ? Number(admin.longitude) : undefined,
      product: {
        id: sub.productId,
        name: sub.product?.name || 'Unknown Product',
        image: sub.product?.images?.[0],
        quantity: sub.quantity,
        price: sub.product?.price ? Number(sub.product.price) : undefined,
      },
    };
  }

  /**
   * Update daily delivery status for a subscription
   */
  async updateSubscriptionDeliveryStatus(
    deliveryPartnerId: string,
    subscriptionId: string,
    dto: UpdateSubscriptionDeliveryStatusDto,
  ): Promise<SubscriptionDeliveryLog> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );
    const subscription = await subscriptionRepo.findOne({
      where: tenantWhere(tenantId, { id: subscriptionId }, dedicated),
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.deliveryPartnerId !== deliveryPartnerId) {
      throw new ForbiddenException('This subscription is not assigned to you');
    }

    const deliveryDate =
      dto.deliveryDate || new Date().toISOString().split('T')[0];

    // Check if a log already exists for this date
    let log = await deliveryLogRepo.findOne({
      where: tenantWhere(
        tenantId,
        {
          subscriptionId,
          deliveryDate,
        },
        dedicated,
      ),
    });

    if (log) {
      log.status = dto.status;
      log.notes = dto.notes || log.notes;
      log.deliveryProofUrl = dto.deliveryProofUrl || log.deliveryProofUrl;
      log.deliveryPartnerId = deliveryPartnerId;
    } else {
      log = deliveryLogRepo.create({
        tenantId: dedicated ? null : (subscription.tenantId ?? tenantId),
        subscriptionId,
        deliveryPartnerId,
        deliveryDate,
        status: dto.status,
        notes: dto.notes,
        deliveryProofUrl: dto.deliveryProofUrl,
      });
    }

    return deliveryLogRepo.save(log);
  }

  private async syncSubscriptionLogFromOrder(
    order: Order,
    status: OrderStatus,
    deliveryPartnerId: string,
    notes?: string,
    proofUrl?: string,
    dedicated?: boolean,
  ) {
    if (!order.subscriptionId) return;
    const tenantId = order.tenantId ?? this.requireTenantId();
    const skipFilter = dedicated ?? this.tenantContext.usesDedicatedDatabase();
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );

    const deliveryStatusMap: Partial<Record<OrderStatus, DeliveryStatus>> = {
      [OrderStatus.DELIVERED]: DeliveryStatus.DELIVERED,
      [OrderStatus.FAILED]: DeliveryStatus.FAILED,
      [OrderStatus.OUT_FOR_DELIVERY]: DeliveryStatus.OUT_FOR_DELIVERY,
    };

    const deliveryStatus = deliveryStatusMap[status];
    if (!deliveryStatus) return;

    // Use scheduled date if available, otherwise creation date
    const dateObj = order.scheduledDeliveryDate
      ? new Date(order.scheduledDeliveryDate)
      : new Date(order.createdAt);
    const deliveryDate = dateObj.toISOString().split('T')[0];

    let log = await deliveryLogRepo.findOne({
      where: tenantWhere(
        tenantId,
        {
          subscriptionId: order.subscriptionId,
          deliveryDate,
        },
        skipFilter,
      ),
    });

    if (log) {
      log.status = deliveryStatus;
      if (notes) log.notes = notes;
      if (proofUrl) log.deliveryProofUrl = proofUrl;
      log.deliveryPartnerId = deliveryPartnerId;
    } else {
      log = deliveryLogRepo.create({
        tenantId: skipFilter ? null : tenantId,
        subscriptionId: order.subscriptionId,
        deliveryPartnerId,
        deliveryDate,
        status: deliveryStatus,
        notes,
        deliveryProofUrl: proofUrl,
      });
    }

    await deliveryLogRepo.save(log);
    this.logger.log(
      `Synced subscription log for sub ${order.subscriptionId} from order ${order.id} status ${status}`,
    );
  }

  /**
   * Get a combined list of all deliveries (Orders and Subscriptions) for today
   * used for route planning and "deliver one by one" experience.
   */
  async getDailyRoute(
    deliveryPartnerId: string,
    date?: string,
  ): Promise<CombinedDeliveryResponseDto[]> {
    // 1. Get Assigned Orders
    const assignedOrders = await this.getAssignedOrders(
      deliveryPartnerId,
      date,
    );

    // 2. Get Assigned Subscriptions
    const assignedSubscriptions = await this.getAssignedSubscriptions(
      deliveryPartnerId,
      date,
    );

    const route: CombinedDeliveryResponseDto[] = [];

    // Map Orders to Combined Format
    assignedOrders.forEach((order) => {
      route.push({
        id: order.orderId,
        type: 'ORDER',
        status: order.orderStatus,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryLatitude: order.deliveryLatitude,
        deliveryLongitude: order.deliveryLongitude,
        googleMapsUrl: order.googleMapsUrl,
        items: order.items,
        deliverySlot: order.deliverySlot,
        isCompleted: order.orderStatus === OrderStatus.DELIVERED,
      });
    });

    // Map Subscriptions to Combined Format
    assignedSubscriptions.forEach((sub) => {
      route.push({
        id: sub.subscriptionId,
        type: 'SUBSCRIPTION',
        status: sub.isDeliveredToday
          ? DeliveryStatus.DELIVERED
          : DeliveryStatus.PENDING,
        customerName: sub.customerName,
        customerPhone: sub.customerPhone,
        deliveryAddress: sub.deliveryAddress,
        deliveryLatitude: sub.deliveryLatitude,
        deliveryLongitude: sub.deliveryLongitude,
        googleMapsUrl: sub.googleMapsUrl,
        items: [sub.product],
        deliverySlot: 'Morning (Subscription)', // Subscriptions are usually morning
        isCompleted: sub.isDeliveredToday,
      });
    });

    return route;
  }

  async registerFCMToken(
    userId: string,
    fcmToken: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const deliveryPartnerRepo =
      await this.tenantRepos.getRepository(DeliveryPartner);
    const partner = await deliveryPartnerRepo.findOne({
      where: tenantWhere(tenantId, { userId }, dedicated),
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    partner.fcmToken = fcmToken;
    await deliveryPartnerRepo.save(partner);

    return {
      success: true,
      message: 'FCM token registered successfully',
    };
  }

  /**
   * Start delivery trip: Batch update orders and subscription logs to OUT_FOR_DELIVERY
   */
  async startBatchDelivery(
    userId: string,
    dto: StartBatchDeliveryDto,
  ): Promise<void> {
    const partner = await this.getDeliveryPartnerByUserId(userId);
    const tenantId = this.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    const deliveryLogRepo = await this.tenantRepos.getRepository(
      SubscriptionDeliveryLog,
    );
    const { orderIds, subscriptionIds } = dto;
    const today = new Date().toISOString().split('T')[0];

    if (orderIds && orderIds.length > 0) {
      const orderWhere: any = {
        id: In(orderIds),
        deliveryPartnerId: partner.id,
        status: In([OrderStatus.ASSIGNED, OrderStatus.ACCEPTED]),
      };
      if (!dedicated) {
        orderWhere.tenantId = tenantId;
      }
      const orders = await orderRepo.find({ where: orderWhere });

      for (const order of orders) {
        order.status = OrderStatus.OUT_FOR_DELIVERY;
        await orderRepo.save(order);
      }
    }

    if (subscriptionIds && subscriptionIds.length > 0) {
      const subWhere: any = {
        id: In(subscriptionIds),
        deliveryPartnerId: partner.id,
        status: SubscriptionStatus.ACTIVE,
      };
      if (!dedicated) {
        subWhere.tenantId = tenantId;
      }
      const subscriptions = await subscriptionRepo.find({ where: subWhere });

      for (const sub of subscriptions) {
        let log = await deliveryLogRepo.findOne({
          where: tenantWhere(
            tenantId,
            {
              subscriptionId: sub.id,
              deliveryDate: today,
            },
            dedicated,
          ),
        });

        if (log) {
          log.status = DeliveryStatus.OUT_FOR_DELIVERY;
          log.deliveryPartnerId = partner.id;
          await deliveryLogRepo.save(log);
        } else {
          log = deliveryLogRepo.create({
            tenantId: dedicated ? null : (sub.tenantId ?? tenantId),
            subscriptionId: sub.id,
            deliveryPartnerId: partner.id,
            deliveryDate: today,
            status: DeliveryStatus.OUT_FOR_DELIVERY,
          });
          await deliveryLogRepo.save(log);
        }
      }
    }
  }
}
