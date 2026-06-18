import { Injectable, NotFoundException } from "@nestjs/common";
import { Customer } from "src/entities/customer.entity";
import { Order } from "src/entities/order.entity";
import { Subscription } from "src/entities/subscription.entity";
import { Payment } from "src/entities/payment.entity";
import { applyPagination } from "src/common/utils/pagination.util";
import { applySearch } from "src/common/utils/search.util";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { NoRecordsFoundException } from "src/common/exceptions/no-records-found.exception";
import { TenantContextService } from "src/common/services/tenant-context.service";
import { TenantRepositoryService } from "src/common/database/tenant-repository.service";
import { applyTenantFilter, tenantWhere } from "src/common/utils/tenant-scope.util";

@Injectable()
export class customerService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        private readonly tenantContext: TenantContextService,
    ) { }

    async getallCustomer(query: PaginationQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const { page, limit, search } = query;

        const qb = customerRepo.createQueryBuilder('customer')
            .leftJoinAndSelect('customer.subscriptions', 'subscriptions')
            .leftJoinAndSelect('subscriptions.product', 'product')
            .where('customer.isBanned = :isBanned', { isBanned: false });
        applyTenantFilter(qb, tenantId, 'customer', dedicated);

        if (search) {
            applySearch(qb, search, ['customer.name', 'customer.phone', 'customer.email', 'customer.address', 'subscriptions.planType']);
        }

        const result = await applyPagination(qb, page, limit);

        if (search && result.meta.total === 0) {
            throw new NoRecordsFoundException();
        }

        return result;
    }  

    async getCustomerById(id: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const qb = customerRepo.createQueryBuilder('customer')
            .leftJoinAndSelect('customer.subscriptions', 'subscriptions')
            .leftJoinAndSelect('subscriptions.product', 'product')
            .where('customer.id = :id', { id });
        applyTenantFilter(qb, tenantId, 'customer', dedicated);
        const customer = await qb.getOne();

        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        return customer;
    }

    async banCustomer(id: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const customer = await customerRepo.findOne({ where: tenantWhere(tenantId, { id }, dedicated) });
        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        customer.isBanned = true;
        customer.isActive = false;
        await customerRepo.save(customer);

        await orderRepo.update(
            tenantWhere(tenantId, { customerId: id }, dedicated),
            { isBanned: true }
        );

        await subscriptionRepo.update(
            tenantWhere(tenantId, { customerId: id }, dedicated),
            { isBanned: true }
        );

        await paymentRepo.update(
            tenantWhere(tenantId, { customerId: id }, dedicated),
            { isBanned: true }
        );

        return { message: 'Customer banned successfully' };
    }

    async getBannedCustomers(query: PaginationQueryDto) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const { page, limit, search } = query;

        const qb = customerRepo.createQueryBuilder('customer')
            .leftJoinAndSelect('customer.subscriptions', 'subscriptions')
            .leftJoinAndSelect('subscriptions.product', 'product')
            .where('customer.isBanned = :isBanned', { isBanned: true });
        applyTenantFilter(qb, tenantId, 'customer', dedicated);

        if (search) {
            applySearch(qb, search, ['customer.name', 'customer.phone', 'customer.email', 'customer.address', 'subscriptions.planType']);
        }

        const result = await applyPagination(qb, page, limit);

        if (search && result.meta.total === 0) {
            throw new NoRecordsFoundException();
        }

        return result;
    }

    async restoreCustomer(id: string) {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const orderRepo = await this.tenantRepos.getRepository(Order);
        const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
        const paymentRepo = await this.tenantRepos.getRepository(Payment);
        const customer = await customerRepo.findOne({ where: tenantWhere(tenantId, { id }, dedicated) });
        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        if (!customer.isBanned) {
            throw new NotFoundException('Customer is not banned');
        }

        customer.isBanned = false;
        customer.isActive = true;
        await customerRepo.save(customer);

        await orderRepo.update(
            tenantWhere(tenantId, { customerId: id }, dedicated),
            { isBanned: false }
        );

        await subscriptionRepo.update(
            tenantWhere(tenantId, { customerId: id }, dedicated),
            { isBanned: false }
        );

        await paymentRepo.update(
            tenantWhere(tenantId, { customerId: id }, dedicated),
            { isBanned: false }
        );

        return { message: 'Customer restored successfully' };
    }
}
