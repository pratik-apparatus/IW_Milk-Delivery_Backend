import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Order, OrderStatus } from "src/entities/order.entity";
import { SubscriptionDeliveryLog, DeliveryStatus } from "src/entities/subscription-delivery-log.entity";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { applyPagination } from "src/common/utils/pagination.util";
import { applySearch } from "src/common/utils/search.util";
import { NoRecordsFoundException } from "src/common/exceptions/no-records-found.exception";
import { UpdateOrderStatusDto, AdminOrderFilterDto } from "src/dto/admin-order.dto";
import { TenantContextService } from "src/common/services/tenant-context.service";
import { TenantRepositoryService } from "src/common/database/tenant-repository.service";
import { applyTenantFilter, tenantWhere } from "src/common/utils/tenant-scope.util";

@Injectable()
export class AdminOrderService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly tenantContext: TenantContextService,
    ) { }

    async getAllOrders(query: AdminOrderFilterDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const { search, page, limit, date, deliveryPartnerId, status } = query;

        const qb = orderRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.items', 'items')
            .leftJoinAndSelect('items.product', 'product');
        applyTenantFilter(qb, tenantId, 'order', dedicated);

        if (search) {
            applySearch(qb, search, [
                'customer.name',
                'customer.phone',
                'customer.email',
                'order.status',
                'order.deliveryAddress',
                'order.deliveryPhone'
            ]);
        }

        if (date) {
            qb.andWhere('DATE(order.createdAt) = :date', { date });
        }

        if (deliveryPartnerId) {
            qb.andWhere('order.deliveryPartnerId = :deliveryPartnerId', { deliveryPartnerId });
        }

        if (status) {
            qb.andWhere('order.status = :status', { status });
        }

        qb.orderBy('order.createdAt', 'DESC');

        const result = await applyPagination(qb, page, limit);

        if (search && result.meta.total === 0) {
            throw new NoRecordsFoundException();
        }

        result.data = result.data.map((order: any) => {
            if (order.customer) {
                order.customerName = order.customer.name;
            } else {
                order.customerName = null;
            }
            return order;
        });

        return result;
    }

    async getOrderById(id: string): Promise<Order> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const order = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id }, dedicated),
            relations: ['customer', 'items', 'items.product']
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return order;
    }

    async updateOrderStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const order = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id }, dedicated),
            relations: ['customer', 'items', 'items.product']
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (dto.status) {
            order.status = dto.status;
        }

        if (dto.deliveryPartnerId) {
            order.deliveryPartnerId = dto.deliveryPartnerId;
            if (order.status === OrderStatus.PENDING) {
                order.status = OrderStatus.ASSIGNED;
            }
        }

        await orderRepo.save(order);

        if (order.subscriptionId) {
            await this.syncSubscriptionLogFromOrder(order, dedicated);
        }

        const updatedOrder = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id }, dedicated),
            relations: ['customer', 'items', 'items.product']
        });

        if (!updatedOrder) {
            throw new NotFoundException('Order not found after update');
        }

        return updatedOrder;
    }

    async deleteOrder(id: string): Promise<{ message: string; data: Order }> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const order = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id }, dedicated),
            relations: ['items']
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status === OrderStatus.DELIVERED) {
            throw new BadRequestException('Cannot delete a delivered order');
        }

        await orderRepo.remove(order);

        return {
            message: "Order deleted successfully",
            data: order
        };
    }

    private async syncSubscriptionLogFromOrder(order: Order, dedicated?: boolean) {
        if (!order.subscriptionId) return;
        const tenantId = order.tenantId ?? this.tenantContext.requireTenantId();
        const skipFilter = dedicated ?? this.tenantContext.usesDedicatedDatabase();
        const deliveryLogRepo = await this.tenantRepos.getRepository(SubscriptionDeliveryLog);

        const deliveryStatusMap: Partial<Record<OrderStatus, DeliveryStatus>> = {
            [OrderStatus.DELIVERED]: DeliveryStatus.DELIVERED,
            [OrderStatus.FAILED]: DeliveryStatus.FAILED,
            [OrderStatus.OUT_FOR_DELIVERY]: DeliveryStatus.OUT_FOR_DELIVERY,
        };

        const deliveryStatus = deliveryStatusMap[order.status];
        if (!deliveryStatus) return;

        const dateObj = order.scheduledDeliveryDate ? new Date(order.scheduledDeliveryDate) : new Date(order.createdAt);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const deliveryDate = `${year}-${month}-${day}`;

        let log = await deliveryLogRepo.findOne({
            where: tenantWhere(tenantId, {
                subscriptionId: order.subscriptionId,
                deliveryDate,
            }, skipFilter),
        });

        if (log) {
            log.status = deliveryStatus;
            log.deliveryPartnerId = order.deliveryPartnerId;
        } else {
            log = deliveryLogRepo.create({
                tenantId: skipFilter ? null : tenantId,
                subscriptionId: order.subscriptionId,
                deliveryPartnerId: order.deliveryPartnerId,
                deliveryDate,
                status: deliveryStatus,
                notes: 'Updated by Admin via Order status',
            });
        }

        await deliveryLogRepo.save(log);
    }
}
