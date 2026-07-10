import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionDeliveryLog } from '../../entities/subscription-delivery-log.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Cart } from '../../entities/cart.entity';
import { Payment } from '../../entities/payment.entity';
import {
  CreateCustomerProfileDto,
  UpdateCustomerProfileDto,
} from '../../dto/customer-profile.dto';
import { Role, User } from '../../entities/user.entity';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { TenantRepositoryService } from '../../common/database/tenant-repository.service';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';
import { tenantWhere } from '../../common/utils/tenant-scope.util';

@Injectable()
export class CustomerProfileService {
  constructor(
    private readonly tenantRepos: TenantRepositoryService,
    @InjectRepository(User)
    private readonly UserRepo: Repository<User>,
    private readonly tenantContext: TenantContextService,
    private readonly tenantDatabase: TenantDatabaseService,
  ) {}

  async createProfile(
    dto: CreateCustomerProfileDto,
    profilePic?: string | null,
  ): Promise<Customer> {
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

      if (
        existingByEmail &&
        (!customer || existingByEmail.id !== customer.id)
      ) {
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
      if (profilePic) {
        customer.profilePic = profilePic;
      }
    } else {
      customer = customerRepo.create({
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        houseNo: dto.houseNo,
        landmark: dto.landmark,
        area: dto.area,
        address: fullAddress,
        profilePic: profilePic ?? null,
        tenantId: dedicated ? null : tenantId,
      });
    }

    if (dto.latitude !== undefined) {
      customer.latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      customer.longitude = dto.longitude;
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
      throw new NotFoundException(
        `Customer profile not found for: ${identifier}`,
      );
    }

    return customer;
  }

  async updateProfile(
    id: string,
    dto: UpdateCustomerProfileDto,
    profilePic?: string | null,
  ): Promise<Customer> {
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
    if (profilePic) {
      customer.profilePic = profilePic;
    }

    customer.address = `${customer.houseNo}, ${customer.landmark}, ${customer.area}`;

    return customerRepo.save(customer);
  }

  async registerFCMToken(
    customerId: string,
    fcmToken: string,
  ): Promise<{ success: boolean; message: string }> {
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

  async deleteAccount(
    customerId: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const customerRepo = await this.tenantRepos.getRepository(Customer);
    const customer = await customerRepo.findOne({
      where: tenantWhere(tenantId, { id: customerId }, dedicated),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const dataSource = await this.tenantDatabase.getTenantDataSource(tenantId);
    const customerFilter = tenantWhere(tenantId, { customerId }, dedicated);

    await dataSource.transaction(async (manager) => {
      const subscriptions = await manager.find(Subscription, {
        where: customerFilter,
        select: ['id'],
      });
      const subscriptionIds = subscriptions.map((item) => item.id);

      if (subscriptionIds.length > 0) {
        await manager.delete(SubscriptionDeliveryLog, {
          subscriptionId: In(subscriptionIds),
        });
      }

      const orders = await manager.find(Order, {
        where: customerFilter,
        select: ['id'],
      });
      const orderIds = orders.map((item) => item.id);

      if (orderIds.length > 0) {
        await manager.delete(OrderItem, { orderId: In(orderIds) });
        await manager.delete(Order, { id: In(orderIds) });
      }

      if (subscriptionIds.length > 0) {
        await manager.delete(Subscription, { id: In(subscriptionIds) });
      }

      const wallet = await manager.findOne(Wallet, {
        where: customerFilter,
      });
      if (wallet) {
        await manager.delete(WalletTransaction, { walletId: wallet.id });
        await manager.delete(Wallet, { id: wallet.id });
      }

      await manager.delete(Cart, customerFilter);
      await manager.delete(Payment, customerFilter);
      await manager.delete(Customer, { id: customerId });
    });

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
