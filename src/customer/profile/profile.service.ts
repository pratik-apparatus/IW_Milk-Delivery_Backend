import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { CreateCustomerProfileDto, UpdateCustomerProfileDto } from '../../dto/customer-profile.dto';
import { Role, User } from '../../entities/user.entity';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class CustomerProfileService {
    constructor(
        private readonly tenantRepos: TenantRepositoryService,
        @InjectRepository(User)
        private readonly UserRepo: Repository<User>,
        private readonly tenantContext: TenantContextService,
    ) { }

    async createProfile(dto: CreateCustomerProfileDto): Promise<Customer> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        let customer = await customerRepo.findOne({
            where: tenantWhere(tenantId, { phone: dto.phone }, dedicated),
        });

        if (dto.email) {
            const existingByEmail = await customerRepo.findOne({
                where: tenantWhere(tenantId, { email: dto.email }, dedicated),
            });

            if (existingByEmail && (!customer || existingByEmail.id !== customer.id)) {
                throw new ConflictException('Email already in use by another account');
            }
        }

        const fullAddress = `${dto.houseNo}, ${dto.landmark}, ${dto.area}`;

        if (customer) {
            customer.name = dto.name;
            customer.email = dto.email;
            customer.houseNo = dto.houseNo;
            customer.landmark = dto.landmark;
            customer.area = dto.area;
            customer.address = fullAddress;
        } else {
            customer = customerRepo.create({
                name: dto.name,
                email: dto.email,
                phone: dto.phone,
                houseNo: dto.houseNo,
                landmark: dto.landmark,
                area: dto.area,
                address: fullAddress,
                tenantId: dedicated ? null : tenantId,
            });
        }

        return customerRepo.save(customer);
    }

    async getProfile(identifier: string): Promise<Customer> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        let customer = await customerRepo.findOne({
            where: tenantWhere(tenantId, { id: identifier }, dedicated),
        });

        if (!customer) {
            customer = await customerRepo.findOne({
                where: tenantWhere(tenantId, { phone: identifier }, dedicated),
            });
        }

        if (!customer) {
            throw new NotFoundException(`Customer profile not found for: ${identifier}`);
        }

        return customer;
    }

    async updateProfile(id: string, dto: UpdateCustomerProfileDto): Promise<Customer> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const customer = await customerRepo.findOne({
            where: tenantWhere(tenantId, { id }, dedicated),
        });

        if (!customer) {
            throw new NotFoundException('Customer profile not found');
        }

        if (dto.phone && dto.phone !== customer.phone) {
            const existingByPhone = await customerRepo.findOne({
                where: tenantWhere(tenantId, { phone: dto.phone }, dedicated),
            });

            if (existingByPhone) {
                throw new ConflictException('Phone number already in use');
            }
        }

        if (dto.name) customer.name = dto.name;
        if (dto.phone) customer.phone = dto.phone;
        if (dto.houseNo) customer.houseNo = dto.houseNo;
        if (dto.landmark) customer.landmark = dto.landmark;
        if (dto.area) customer.area = dto.area;

        if (dto.latitude !== undefined) customer.latitude = dto.latitude;
        if (dto.longitude !== undefined) customer.longitude = dto.longitude;

        customer.address = `${customer.houseNo}, ${customer.landmark}, ${customer.area}`;

        return customerRepo.save(customer);
    }

    async registerFCMToken(customerId: string, fcmToken: string): Promise<{ success: boolean; message: string }> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const customer = await customerRepo.findOne({
            where: tenantWhere(tenantId, { id: customerId }, dedicated),
        });

        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        customer.fcmToken = fcmToken;
        await customerRepo.save(customer);

        return {
            success: true,
            message: 'FCM token registered successfully',
        };
    }

    async deleteAccount(customerId: string): Promise<{ success: boolean; message: string }> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const customerRepo = await this.tenantRepos.getRepository(Customer);
        const customer = await customerRepo.findOne({
            where: tenantWhere(tenantId, { id: customerId }, dedicated),
        });

        if (!customer) {
            throw new NotFoundException('Customer not found');
        }

        await customerRepo.remove(customer);

        return {
            success: true,
            message: 'Account deleted successfully',
        };
    }

    async getAdminPhone(): Promise<string> {
        const tenantId = this.tenantContext.requireTenantId();
        const dedicated = this.tenantContext.usesDedicatedDatabase();
        const admin = await this.UserRepo.findOne({
            where: tenantWhere(tenantId, { role: Role.ADMIN }, dedicated),
        });

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        return admin.phone;
    }
}
