import { Injectable } from '@nestjs/common';
import { Product } from '../../entities/product.entity';
import { Subscription, SubscriptionStatus } from '../../entities/subscription.entity';
import { Order, OrderStatus } from '../../entities/order.entity';
import { WalletService } from '../wallet/wallet.service';
import { Category } from '../../entities/categories.entity';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { applyTenantFilter, tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class DashboardService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly walletService: WalletService,
        private readonly tenantContext: TenantContextService,
    ) { }

    async getProducts(limit: number = 10) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const productRepo = await this.tenantRepos.getRepository(Product);
        return productRepo.find({
            where: tenantWhere(tenantId, { isActive: true }, dedicated),
            order: { createdAt: 'DESC' },
            take: limit,
            select: ['id', 'name', 'price', 'images', 'quantity', 'createdAt', 'description'],
        });
    }

    async getSubscriptions(customerId: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
        return subscriptionRepo.find({
            where: tenantWhere(tenantId, {
                customerId,
                status: SubscriptionStatus.ACTIVE,
            }, dedicated),
            relations: ['product'],
            select: {
                id: true,
                planType: true,
                nextDeliveryDate: true,
                status: true,
                createdAt: true,
                product: {
                    id: true,
                    name: true,
                    price: true,
                    images: true,
                },
            },
            take: 5,
            order: { createdAt: 'DESC' },
        });
    }

    async getOrders(customerId: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const qb = orderRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.items', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .where('o.customerId = :customerId', { customerId });
        applyTenantFilter(qb, tenantId, 'o', dedicated);
        const orders = await qb
            .orderBy('o.createdAt', 'DESC')
            .limit(5)
            .getMany();

        return orders.map(o => ({
            id: o.id,
            status: o.status,
            totalAmount: o.totalAmount,
            createdAt: o.createdAt,
            items: o.items.map(it => ({
                id: it.id,
                quantity: it.quantity,
                price: it.price,
                product: it.product ? {
                    id: it.product.id,
                    name: it.product.name,
                    images: it.product.images,
                } : null,
            })),
        }));
    }

    async getWalletBalance(customerId: string) {
        return this.walletService.getBalance(customerId);
    }

    async getcategories() {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const categoryRepo = await this.tenantRepos.getRepository(Category);
        return categoryRepo.find({
            where: tenantWhere(tenantId, { isActive: true }, dedicated),
            order: { createdAt: 'DESC' },
            take: 10,
            select: ['id', 'name', 'createdAt'],
        });
    }
}
