import { Injectable } from '@nestjs/common';
import { Customer } from '../../entities/customer.entity';
import { Order, OrderStatus } from '../../entities/order.entity';
import { Subscription } from '../../entities/subscription.entity';
import { DeliveryPartner } from '../../entities/delivery-partner.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { SalesReportQueryDto, SalesPeriod } from './dto/sales-report.query.dto';
import { BaseReportQueryDto } from './dto/base-report.query.dto';
import { PeriodReportQueryDto } from './dto/reportPeriod.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { applyPagination } from '../../common/utils/pagination.util';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { WalletTransaction, TransactionType } from '../../entities/wallet-transaction.entity';
import { getPeriodSelectAndGroup, ReportPeriod } from '../utils/report.utils';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { applyTenantFilter, tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class ReportsService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly tenantContext: TenantContextService,
    ) { }

    async getOverview(query?: BaseReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
        const deliveryPartnerRepo = await this.tenantRepos.getRepository(DeliveryPartner);
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const walletTransactionRepo = await this.tenantRepos.getRepository(WalletTransaction);
        const { startDate, endDate } = query || {};

        const customerQuery = customerRepo.createQueryBuilder('customer');
        applyTenantFilter(customerQuery, tenantId, 'customer', dedicated);
        const orderQuery = orderRepo.createQueryBuilder('order');
        applyTenantFilter(orderQuery, tenantId, 'order', dedicated);
        const subscriptionQuery = subscriptionRepo.createQueryBuilder('subscription');
        applyTenantFilter(subscriptionQuery, tenantId, 'subscription', dedicated);
        const deliveryPartnerQuery = deliveryPartnerRepo.createQueryBuilder('partner');
        applyTenantFilter(deliveryPartnerQuery, tenantId, 'partner', dedicated);

        // Apply date filters if provided
        if (startDate) {
            customerQuery.andWhere('customer.createdAt >= :startDate', { startDate });
            orderQuery.andWhere('order.createdAt >= :startDate', { startDate });
            subscriptionQuery.andWhere('subscription.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            customerQuery.andWhere('customer.createdAt <= :endDate', { endDate });
            orderQuery.andWhere('order.createdAt <= :endDate', { endDate });
            subscriptionQuery.andWhere('subscription.createdAt <= :endDate', { endDate });
        }

        // Wallet top-ups query
        const topUpsQuery = paymentRepo.createQueryBuilder('payment')
            .select('SUM(payment.amount)', 'total')
            .where('payment.status = :status', { status: PaymentStatus.SUCCESS });
        applyTenantFilter(topUpsQuery, tenantId, 'payment', dedicated);

        if (startDate) {
            topUpsQuery.andWhere('payment.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            topUpsQuery.andWhere('payment.createdAt <= :endDate', { endDate });
        }

        // Refunds query
        const refundsQuery = walletTransactionRepo.createQueryBuilder('transaction')
            .select('SUM(transaction.amount)', 'total')
            .where('transaction.type = :type', { type: TransactionType.CREDIT })
            .andWhere('transaction.description LIKE :refund', { refund: '%Refund%' });
        applyTenantFilter(refundsQuery, tenantId, 'transaction', dedicated);

        if (startDate) {
            refundsQuery.andWhere('transaction.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            refundsQuery.andWhere('transaction.createdAt <= :endDate', { endDate });
        }

        const [customers, orders, subscriptions, deliveryPartners, walletTopUps, refunds] = await Promise.all([
            customerQuery.getCount(),
            orderQuery.getCount(),
            subscriptionQuery.getCount(),
            deliveryPartnerQuery.getCount(),
            topUpsQuery.getRawOne(),
            refundsQuery.getRawOne(),
        ]);

        const totalTopUps = parseFloat(walletTopUps?.total || 0);
        const totalRefunds = parseFloat(refunds?.total || 0);
        const revenue = totalTopUps - totalRefunds;

        return {
            customers,
            orders,
            subscriptions,
            deliveryPartners,
            revenue: revenue > 0 ? revenue : 0,
        };
    }

    /**
     * Used for daily / weekly / monthly / yearly sales graph
     * Revenue = Wallet Top-ups (from successful payments) - Refunds
     */
    async getSalesReport(query: SalesReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const walletTransactionRepo = await this.tenantRepos.getRepository(WalletTransaction);
        const { period, startDate, endDate, page, limit } = query;

        const periodConfig = getPeriodSelectAndGroup(period as unknown as ReportPeriod);

        const topUpsQuery = paymentRepo.createQueryBuilder('payment')
            .select(periodConfig.select, 'period')
            .addSelect('SUM(payment.amount)', 'topUps')
            .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
            .groupBy(periodConfig.groupBy);
        applyTenantFilter(topUpsQuery, tenantId, 'payment', dedicated);

        if (startDate) {
            topUpsQuery.andWhere('payment.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            topUpsQuery.andWhere('payment.createdAt <= :endDate', { endDate });
        }

        // Get refunds grouped by period
        const refundsQuery = walletTransactionRepo.createQueryBuilder('transaction')
            .select(periodConfig.select, 'period')
            .addSelect('SUM(transaction.amount)', 'refunds')
            .where('transaction.type = :type', { type: TransactionType.CREDIT })
            .andWhere('transaction.description LIKE :refund', { refund: '%Refund%' })
            .groupBy(periodConfig.groupBy);
        applyTenantFilter(refundsQuery, tenantId, 'transaction', dedicated);

        if (startDate) {
            refundsQuery.andWhere('transaction.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            refundsQuery.andWhere('transaction.createdAt <= :endDate', { endDate });
        }

        const [topUpsData, refundsData] = await Promise.all([
            topUpsQuery.getRawMany(),
            refundsQuery.getRawMany(),
        ]);

        // Create maps for both top-ups and refunds
        const topUpsMap = new Map();
        topUpsData.forEach(item => {
            topUpsMap.set(item.period, parseFloat(item.topUps || 0));
        });

        const refundsMap = new Map();
        refundsData.forEach(item => {
            refundsMap.set(item.period, parseFloat(item.refunds || 0));
        });

        // Get all unique periods (from both top-ups and refunds)
        const allPeriods = new Set([
            ...topUpsData.map(item => item.period),
            ...refundsData.map(item => item.period)
        ]);

        // Combine top-ups and refunds, calculate revenue for all periods
        const combinedData = Array.from(allPeriods).map(period => {
            const topUps = topUpsMap.get(period) || 0;
            const refunds = refundsMap.get(period) || 0;
            const revenue = topUps - refunds;

            return {
                period,
                totalSales: revenue > 0 ? revenue : 0,
                topUps,
                refunds,
                orderCount: 0,
            };
        });

        // Sort by period descending
        combinedData.sort((a, b) => {
            if (period === SalesPeriod.MONTHLY || period === SalesPeriod.YEARLY) {
                return b.period.localeCompare(a.period);
            }
            return b.period - a.period;
        });

        // Apply pagination
        const safeLimit = Math.min(limit || 20, 100);
        const safePage = page || 1;
        const skip = (safePage - 1) * safeLimit;
        const paginatedData = combinedData.slice(skip, skip + safeLimit);

        return {
            data: paginatedData,
            meta: {
                total: combinedData.length,
                page: safePage,
                limit: safeLimit,
            },
        };
    }

    /**
     * Identify top selling products with period grouping
     */
    async getBestSellingProducts(query: PeriodReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderItemRepo = await this.tenantRepos.getRepository(OrderItem);
        const { page, limit, search, period, startDate, endDate } = query;

        const qb = orderItemRepo.createQueryBuilder('orderItem')
            .innerJoin('orderItem.product', 'product')
            .innerJoin('orderItem.order', 'order')
            .select('MIN(product.id)', 'productId')
            .addSelect('product.name', 'productName')
            .addSelect('SUM(orderItem.quantity)', 'unitsSold')
            .addSelect('MIN(product.quantity)', 'totalQuantity')
            .addSelect('MIN(product.remainingQuantity)', 'remainingQuantity')
            .groupBy('product.id')
            .addGroupBy('product.name')
            .orderBy('unitsSold', 'DESC');
        applyTenantFilter(qb, tenantId, 'order', dedicated);

        // Add period grouping if specified
        if (period) {
            const periodConfig = getPeriodSelectAndGroup(period, 'order.createdAt');
            qb.addSelect(periodConfig.select, 'period');
            qb.addGroupBy(periodConfig.groupBy);
        }

        // Apply date filtering
        if (startDate) {
            qb.andWhere('order.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('order.createdAt <= :endDate', { endDate });
        }

        if (search) {
            qb.andWhere('product.name LIKE :search', { search: `%${search}%` });
        }

        const safeLimit = Math.min(limit || 5, 100);
        const safePage = page || 1;
        const skip = (safePage - 1) * safeLimit;

        qb.offset(skip).limit(safeLimit);

        const [sql, params] = qb.getQueryAndParameters();
        const [data, totalResult] = await Promise.all([
            qb.getRawMany(),
            orderItemRepo.query(
                `SELECT COUNT(*) as count FROM (${sql}) as sub`,
                params
            )
        ]);

        return {
            data: data.map(item => ({
                ...item,
                unitsSold: parseInt(item.unitsSold || 0),
                totalQuantity: parseInt(item.totalQuantity || 0),
                remainingQuantity: parseInt(item.remainingQuantity || 0),
            })),
            meta: {
                total: parseInt(totalResult[0]?.count || 0),
                page: safePage,
                limit: safeLimit,
            },
        };
    }

    /**
     * Identify low performing products with period grouping
     */
    async getLeastSellingProducts(query: PeriodReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const orderItemRepo = await this.tenantRepos.getRepository(OrderItem);
        const { page, limit, search, period, startDate, endDate } = query;

        const qb = orderItemRepo.createQueryBuilder('orderItem')
            .innerJoin('orderItem.product', 'product')
            .innerJoin('orderItem.order', 'order')
            .select('MIN(product.id)', 'productId')
            .addSelect('product.name', 'productName')
            .addSelect('SUM(orderItem.quantity)', 'unitsSold')
            .addSelect('MIN(product.quantity)', 'totalQuantity')
            .addSelect('MIN(product.remainingQuantity)', 'remainingQuantity')
            .groupBy('product.id')
            .addGroupBy('product.name')
            .having('SUM(orderItem.quantity) > 0')
            .orderBy('unitsSold', 'ASC');
        applyTenantFilter(qb, tenantId, 'order', dedicated);

        // Add period grouping if specified
        if (period) {
            const periodConfig = getPeriodSelectAndGroup(period, 'order.createdAt');
            qb.addSelect(periodConfig.select, 'period');
            qb.addGroupBy(periodConfig.groupBy);
        }

        // Apply date filtering
        if (startDate) {
            qb.andWhere('order.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('order.createdAt <= :endDate', { endDate });
        }

        if (search) {
            qb.andWhere('product.name LIKE :search', { search: `%${search}%` });
        }

        const safeLimit = Math.min(limit || 5, 100);
        const safePage = page || 1;
        const skip = (safePage - 1) * safeLimit;

        qb.offset(skip).limit(safeLimit);

        const [sql, params] = qb.getQueryAndParameters();
        const [data, totalResult] = await Promise.all([
            qb.getRawMany(),
            orderItemRepo.query(
                `SELECT COUNT(*) as count FROM (${sql}) as sub`,
                params
            )
        ]);

        return {
            data: data.map(item => ({
                ...item,
                unitsSold: parseInt(item.unitsSold || 0),
                totalQuantity: parseInt(item.totalQuantity || 0),
                remainingQuantity: parseInt(item.remainingQuantity || 0),
            })),
            meta: {
                total: parseInt(totalResult[0]?.count || 0),
                page: safePage,
                limit: safeLimit,
            },
        };
    }

    /**
     * Graph showing new subscriptions over time with period grouping
     */
    async getSubscriptionTrends(query: PeriodReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
        const { page, limit, period, startDate, endDate } = query;

        const periodConfig = getPeriodSelectAndGroup(
            period || ReportPeriod.DAILY,
            'subscription.createdAt'
        );

        const qb = subscriptionRepo.createQueryBuilder('subscription')
            .select(periodConfig.select, periodConfig.label)
            .addSelect('COUNT(subscription.id)', 'count')
            .groupBy(periodConfig.groupBy)
            .orderBy(periodConfig.label, 'DESC');
        applyTenantFilter(qb, tenantId, 'subscription', dedicated);

        if (startDate) {
            qb.andWhere('subscription.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('subscription.createdAt <= :endDate', { endDate });
        }

        const safeLimit = Math.min(limit || 20, 100);
        const safePage = page || 1;
        const skip = (safePage - 1) * safeLimit;

        qb.offset(skip).limit(safeLimit);

        const [sql, params] = qb.getQueryAndParameters();
        const [data, totalResult] = await Promise.all([
            qb.getRawMany(),
            subscriptionRepo.query(
                `SELECT COUNT(*) as count FROM (${sql}) as sub`,
                params
            )
        ]);

        return {
            data: data.map(item => ({
                ...item,
                count: parseInt(item.count || 0)
            })),
            meta: {
                total: parseInt(totalResult[0]?.count || 0),
                page: safePage,
                limit: safeLimit,
            },
        };
    }

    /**
     * Fetch all payment transactions for audit with date filtering
     */
    async getPaymentTransactions(query: BaseReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const { page, limit, search, startDate, endDate } = query;

        const qb = paymentRepo.createQueryBuilder('payment')
            .leftJoinAndSelect('payment.customer', 'customer')
            .orderBy('payment.createdAt', 'DESC');
        applyTenantFilter(qb, tenantId, 'payment', dedicated);

        if (startDate) {
            qb.andWhere('payment.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('payment.createdAt <= :endDate', { endDate });
        }

        if (search) {
            qb.andWhere(
                '(payment.razorpayOrderId LIKE :search OR payment.razorpayPaymentId LIKE :search OR customer.name LIKE :search)',
                { search: `%${search}%` }
            );
        }

        return applyPagination(qb, page, limit);
    }


    // delete payment transactions
    async deletePaymentTransactions(paymentId:string){
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const payment = await paymentRepo.findOne({where: tenantWhere(tenantId, { id: paymentId }, dedicated)});
        if(!payment){
            throw new Error('Payment not found');
        }
        
        await paymentRepo.remove(payment);
        return {message:'Payment deleted successfully',
           
        };
    }



    /**
     * Track Partner Performance with period grouping
     */
    async getDeliveryPartnerPerformance(query: PeriodReportQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const deliveryPartnerRepo = await this.tenantRepos.getRepository(DeliveryPartner);
        const { page, limit, search, period, startDate, endDate } = query;

        const qb = deliveryPartnerRepo.createQueryBuilder('partner')
            .leftJoin(Order, 'order', dedicated
                ? 'order.deliveryPartnerId = partner.id'
                : 'order.deliveryPartnerId = partner.id AND order.tenantId = :tenantId', { tenantId })
            .select('partner.id', 'partnerId')
            .addSelect('partner.name', 'partnerName')
            .addSelect("COUNT(CASE WHEN order.status = 'DELIVERED' THEN 1 END)", 'deliveredOrders')
            .addSelect("COUNT(CASE WHEN order.status = 'CANCELLED' THEN 1 END)", 'cancelledOrders')
            .addSelect('COUNT(order.id)', 'totalOrders')
            .groupBy('partner.id')
            .orderBy('deliveredOrders', 'DESC');
        applyTenantFilter(qb, tenantId, 'partner', dedicated);

        // Add period grouping if specified
        if (period) {
            const periodConfig = getPeriodSelectAndGroup(period, 'order.createdAt');
            qb.addSelect(periodConfig.select, 'period');
            qb.addGroupBy(periodConfig.groupBy);
        }

        // Apply date filtering
        if (startDate) {
            qb.andWhere('order.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('order.createdAt <= :endDate', { endDate });
        }

        if (search) {
            qb.andWhere('partner.name LIKE :search', { search: `%${search}%` });
        }

        const safeLimit = Math.min(limit || 10, 100);
        const safePage = page || 1;
        const skip = (safePage - 1) * safeLimit;

        qb.offset(skip).limit(safeLimit);

        const [sql, params] = qb.getQueryAndParameters();
        const [data, totalResult] = await Promise.all([
            qb.getRawMany(),
            deliveryPartnerRepo.query(
                `SELECT COUNT(*) as count FROM (${sql}) as sub`,
                params
            )
        ]);

        return {
            data: data.map(item => ({
                ...item,
                deliveredOrders: parseInt(item.deliveredOrders || 0),
                cancelledOrders: parseInt(item.cancelledOrders || 0),
                totalOrders: parseInt(item.totalOrders || 0),
                successRate: item.totalOrders > 0
                    ? parseFloat(((item.deliveredOrders / item.totalOrders) * 100).toFixed(2))
                    : 0
            })),
            meta: {
                total: parseInt(totalResult[0]?.count || 0),
                page: safePage,
                limit: safeLimit,
            },
        };
    }

    /**
     * Clear Reports (deletes failed payments as a cleanup measure)
     */
    async clearReports() {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const result = await paymentRepo.delete(tenantWhere(tenantId, { status: PaymentStatus.FAILED }, dedicated));
        return {
            success: true,
            message: `Cleared ${result.affected} failed payment records from history.`,
        };
    }
}