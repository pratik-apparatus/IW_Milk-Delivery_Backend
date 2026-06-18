import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Cart } from '../../entities/cart.entity';
import { Customer } from '../../entities/customer.entity';
import { Product } from '../../entities/product.entity';
import { WalletService } from '../wallet/wallet.service';
import { NotificationIntegrationService } from '../../common/services/notification-integration.service';
import { UpdateCartDto, CreateOrderDto } from '../../dto/order.dto';
import { DeliveryPartner } from '../../entities/delivery-partner.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { applyPagination } from '../../common/utils/pagination.util';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';
import { applyTenantFilter, tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class OrderService {
    private readonly logger = new Logger('OrderService');

    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly walletService: WalletService,
        private readonly notificationService: NotificationIntegrationService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly tenantDatabase: TenantDatabaseService,
        private readonly tenantContext: TenantContextService,
    ) { }

    private async createQueryRunner() {
        const tenantId = this.tenantContext.requireTenantId();
        if (this.tenantContext.usesDedicatedDatabase()) {
            const tenantDs = await this.tenantDatabase.getTenantDataSource(tenantId);
            return tenantDs.createQueryRunner();
        }
        return this.dataSource.createQueryRunner();
    }

    private validateAndExtractCoordinates(
        lat: number | null | undefined,
        lng: number | null | undefined,
        source: string,
    ): { latitude: number; longitude: number } {
        if (lat === null || lat === undefined || lng === null || lng === undefined) {
            throw new BadRequestException(
                `Delivery coordinates are required for location tracking. None found in ${source}.`
            );
        }

        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
            throw new BadRequestException(
                `Invalid coordinates in ${source}: coordinates must be valid numbers (not NaN or Infinity)`
            );
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new BadRequestException(
                `Invalid coordinates in ${source}: latitude must be -90 to 90, longitude must be -180 to 180`
            );
        }

        return { latitude: lat, longitude: lng };
    }

    async getCart(customerId: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const cartRepo = await this.tenantRepos.getRepository(Cart);
        const productRepo = await this.tenantRepos.getRepository(Product);
        let cart = await cartRepo.findOne({
            where: tenantWhere(tenantId, { customerId }, dedicated),
        });

        if (!cart) {
            cart = cartRepo.create({
                customerId,
                items: [],
                tenantId: dedicated ? null : tenantId,
            });
            cart = await cartRepo.save(cart);
        }

        const itemsWithDetails = await Promise.all(
            cart.items.map(async (item) => {
                const product = await productRepo.findOne({
                    where: tenantWhere(tenantId, { id: item.productId }, dedicated),
                });
                return {
                    ...item,
                    product: product ? {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        images: product.images,
                    } : null,
                };
            }),
        );

        return {
            ...cart,
            items: itemsWithDetails,
        };
    }

    async updateCart(customerId: string, dto: UpdateCartDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const cartRepo = await this.tenantRepos.getRepository(Cart);
        const productRepo = await this.tenantRepos.getRepository(Product);
        for (const item of dto.items) {
            const product = await productRepo.findOne({
                where: tenantWhere(tenantId, { id: item.productId }, dedicated),
            });

            if (!product) {
                throw new NotFoundException(`Product ${item.productId} not found`);
            }

            if (!product.isActive) {
                throw new BadRequestException(`Product ${product.name} is not available`);
            }

            if (product.quantity < item.quantity) {
                throw new BadRequestException(`Product ${product.name} is not available in this quantity`);
            }
        }

        let cart = await cartRepo.findOne({
            where: tenantWhere(tenantId, { customerId }, dedicated),
        });

        if (!cart) {
            cart = cartRepo.create({
                customerId,
                items: [],
                tenantId: dedicated ? null : tenantId,
            });
        }

        cart.items = await Promise.all(
            dto.items.map(async (item) => {
                const product = await productRepo.findOne({
                    where: tenantWhere(tenantId, { id: item.productId }, dedicated),
                });
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: product ? Number(product.price) : 0,
                };
            }),
        );

        return cartRepo.save(cart);
    }

    async createOrder(customerId: string, dto: CreateOrderDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const cartRepo = await this.tenantRepos.getRepository(Cart);
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const productRepo = await this.tenantRepos.getRepository(Product);
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const cart = await cartRepo.findOne({
            where: tenantWhere(tenantId, { customerId }, dedicated),
        });

        if (!cart || cart.items.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        const customer = await customerRepo.findOne({
            where: tenantWhere(tenantId, { id: customerId }, dedicated),
        });

        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        let totalAmount = 0;
        const orderItems: Array<{ productId: string; quantity: number; price: number }> = [];

        for (const item of cart.items) {
            const product = await productRepo.findOne({
                where: tenantWhere(tenantId, { id: item.productId }, dedicated),
            });

            if (!product || !product.isActive) {
                throw new BadRequestException(`Product ${item.productId} is not available`);
            }

            if (product.quantity < item.quantity) {
                throw new BadRequestException(`Insufficient stock for product ${product.name}. Available: ${product.quantity}`);
            }

            const itemTotal = Number(product.price) * item.quantity;
            totalAmount += itemTotal;

            orderItems.push({
                productId: product.id,
                quantity: item.quantity,
                price: Number(product.price),
            });
        }

        const hasBalance = await this.walletService.hasSufficientBalance(customerId, totalAmount);
        if (!hasBalance) {
            throw new BadRequestException('Insufficient wallet balance');
        }

        const queryRunner = await this.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let transactionCommitted = false;
        try {
            const useSavedAddress = dto.useSavedAddress !== false;

            let deliveryAddress: string;
            let deliveryLat: number;
            let deliveryLng: number;

            if (useSavedAddress) {
                if (!customer.address || customer.address.trim() === '') {
                    throw new BadRequestException('No saved address found. Please provide a delivery address.');
                }
                deliveryAddress = customer.address;
                deliveryLat = customer.latitude;
                deliveryLng = customer.longitude;

                const coords = this.validateAndExtractCoordinates(
                    customer.latitude,
                    customer.longitude,
                    'customer profile (saved address)'
                );
                deliveryLat = coords.latitude;
                deliveryLng = coords.longitude;
            } else {
                if (!dto.deliveryAddress) {
                    throw new BadRequestException('deliveryAddress is required when useSavedAddress is false');
                }
                deliveryAddress = dto.deliveryAddress;

                const coords = this.validateAndExtractCoordinates(
                    dto.latitude,
                    dto.longitude,
                    'order checkout (DTO coordinates)'
                );
                deliveryLat = coords.latitude;
                deliveryLng = coords.longitude;
            }

            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 1);
            deliveryDate.setHours(0, 0, 0, 0);

            const order = new Order();
            order.customerId = customerId;
            order.tenantId = dedicated ? null : tenantId;
            order.status = OrderStatus.PENDING;
            order.totalAmount = totalAmount;
            order.paymentMethod = PaymentMethod.WALLET;
            order.deliveryAddress = deliveryAddress;
            order.deliveryPhone = dto.deliveryPhone || customer.phone;
            order.deliveryLatitude = deliveryLat;
            order.deliveryLongitude = deliveryLng;
            order.scheduledDeliveryDate = deliveryDate;

            const savedOrder = await queryRunner.manager.save(Order, order);

            for (const item of orderItems) {
                const orderItem = queryRunner.manager.create(OrderItem, {
                    orderId: savedOrder.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    tenantId: dedicated ? null : tenantId,
                });
                await queryRunner.manager.save(orderItem);

                await queryRunner.manager.decrement(Product, tenantWhere(tenantId, { id: item.productId }, dedicated), 'quantity', item.quantity);
            }

            const partner = await queryRunner.manager.findOne(DeliveryPartner, {
                where: tenantWhere(tenantId, { isActive: true }, dedicated),
                order: {
                    CurrentOrder: 'ASC',
                    createdAt: 'ASC',
                },
                lock: { mode: 'pessimistic_write' },
            });

            if (!partner) {
                throw new BadRequestException('No delivery partner available');
            }

            savedOrder.deliveryPartnerId = partner.id;
            savedOrder.status = OrderStatus.ASSIGNED;

            await queryRunner.manager.save(savedOrder);

            partner.CurrentOrder += 1;
            await queryRunner.manager.save(partner);

            await queryRunner.commitTransaction();
            transactionCommitted = true;

            await this.walletService.debitWallet(
                customerId,
                totalAmount,
                savedOrder.id,
                `Order ${savedOrder.id} - ${orderItems.length} items`,
            );

            cart.items = [];
            await cartRepo.save(cart);

            const orderQb = orderRepo
                .createQueryBuilder('o')
                .leftJoinAndSelect('o.items', 'item')
                .leftJoinAndSelect('item.product', 'product')
                .where('o.id = :id', { id: savedOrder.id });
            applyTenantFilter(orderQb, tenantId, 'o', dedicated);
            const orderWithItems = await orderQb.getOne();

            this.notificationService.sendNotification({
                recipientId: customerId,
                recipientType: 'CUSTOMER',
                templateType: 'ORDER_PLACED',
                variables: {
                    customerName: customer.name || 'Customer',
                    orderId: savedOrder.id,
                    amount: totalAmount.toString(),
                    deliveryAddress: deliveryAddress,
                    estimatedTime: 'Within 2 hours',
                },
                channel: 'BOTH',
                fcmToken: customer.fcmToken,
            }).catch(err => this.logger.warn('Failed to send ORDER_PLACED notification:', err.message));

            if (partner) {
                this.notificationService.sendNotification({
                    recipientId: partner.id,
                    recipientType: 'DELIVERY_PARTNER',
                    templateType: 'NEW_ORDER_ASSIGNED',
                    variables: {
                        partnerName: partner.name || 'Partner',
                        orderId: savedOrder.id,
                        customerName: customer.name || 'Customer',
                        pickupLocation: 'Main Store',
                        deliveryLocation: deliveryAddress,
                        itemCount: orderItems.length.toString(),
                        amount: totalAmount.toString(),
                    },
                    channel: 'BOTH',
                    fcmToken: partner.fcmToken,
                }).catch(err => this.logger.warn('Failed to send NEW_ORDER_ASSIGNED notification:', err.message));
            }

            return orderWithItems;

        } catch (error) {
            if (!transactionCommitted) {
                await queryRunner.rollbackTransaction();
            }
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Failed to create order: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to create order');
        } finally {
            await queryRunner.release();
        }
    }

    async createOrderFromSubscription(
        customerId: string,
        subscriptionId: string,
        productId: string,
        productPrice: number,
        deliveryAddress: string,
        deliveryPhone: string,
        quantity: number = 1,
    ): Promise<Order> {
        const contextTenantId = this.tenantContext.getTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const productRepo = await this.tenantRepos.getRepository(Product);
        const customer = await customerRepo.findOne({
            where: contextTenantId
                ? tenantWhere(contextTenantId, { id: customerId }, dedicated)
                : { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        const tenantId = contextTenantId ?? customer.tenantId;

        const product = await productRepo.findOne({
            where: tenantId ? tenantWhere(tenantId, { id: productId }, dedicated) : { id: productId },
        });

        if (!product || !product.isActive) {
            throw new BadRequestException(`Product ${productId} is not available`);
        }

        if (product.quantity < quantity) {
            throw new BadRequestException(`Insufficient stock for product ${product.name} (ID: ${productId}) for subscription order. Available: ${product.quantity}, Requested: ${quantity}.`);
        }

        const totalAmount = productPrice * quantity;

        const queryRunner = await this.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const coords = this.validateAndExtractCoordinates(
                customer.latitude,
                customer.longitude,
                'customer profile for subscription delivery'
            );
            const deliveryLat = coords.latitude;
            const deliveryLng = coords.longitude;

            const order = new Order();
            order.customerId = customerId;
            order.tenantId = dedicated ? null : tenantId;
            order.subscriptionId = subscriptionId;
            order.status = OrderStatus.PENDING;
            order.totalAmount = totalAmount;
            order.paymentMethod = PaymentMethod.WALLET;
            order.scheduledDeliveryDate = new Date();
            order.deliveryAddress = deliveryAddress;
            order.deliveryPhone = deliveryPhone;
            order.deliveryLatitude = deliveryLat;
            order.deliveryLongitude = deliveryLng;

            const savedOrder = await queryRunner.manager.save(Order, order);

            const orderItem = queryRunner.manager.create(OrderItem, {
                orderId: savedOrder.id,
                productId: product.id,
                quantity: quantity,
                price: productPrice,
                tenantId: savedOrder.tenantId,
            });
            await queryRunner.manager.save(orderItem);

            await queryRunner.manager.decrement(
                Product,
                tenantId ? tenantWhere(tenantId, { id: product.id }, dedicated) : { id: product.id },
                'quantity',
                quantity,
            );

            const partner = await queryRunner.manager.findOne(DeliveryPartner, {
                where: tenantId ? tenantWhere(tenantId, { isActive: true }, dedicated) : { isActive: true },
                order: {
                    CurrentOrder: 'ASC',
                    createdAt: 'ASC',
                },
                lock: { mode: 'pessimistic_write' },
            });

            if (!partner) {
                throw new BadRequestException('No delivery partner available');
            }

            savedOrder.deliveryPartnerId = partner.id;
            savedOrder.status = OrderStatus.ASSIGNED;
            await queryRunner.manager.save(savedOrder);

            partner.CurrentOrder += 1;
            await queryRunner.manager.save(partner);

            await queryRunner.commitTransaction();

            return savedOrder;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Failed to create subscription order: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to create subscription order');
        } finally {
            await queryRunner.release();
        }
    }

    async getOrders(customerId: string, query: PaginationQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const queryBuilder = orderRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.items', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .where('o.customerId = :customerId', { customerId });
        applyTenantFilter(queryBuilder, tenantId, 'o', dedicated);
        queryBuilder.orderBy('o.createdAt', 'DESC');

        return applyPagination(queryBuilder, query.page, query.limit);
    }

    async cancelOrder(customerId: string, orderId: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const order = await orderRepo.findOne({
            where: tenantWhere(tenantId, { id: orderId, customerId }, dedicated),
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new BadRequestException('Only pending orders can be cancelled');
        }

        order.status = OrderStatus.CANCELLED;
        await orderRepo.save(order);

        await this.walletService.creditWallet(
            customerId,
            order.totalAmount,
            orderId,
            `Refund for cancelled order ${orderId}`,
        );

        return order;
    }
}
