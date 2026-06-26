import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { InternalAuthService } from 'src/internal/auth/internal-auth.service';
import { DeliveryPartner } from 'src/entities/delivery-partner.entity';
import { Order } from 'src/entities/order.entity';
import { Subscription } from 'src/entities/subscription.entity';
import { User, Role } from 'src/entities/user.entity';
import { CreateDeliveryPartnerDto } from 'src/dto/deliverypartner.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { applyPagination } from 'src/common/utils/pagination.util';
import { NoRecordsFoundException } from 'src/common/exceptions/no-records-found.exception';
import { TenantContextService } from 'src/common/services/tenant-context.service';
import { TenantRepositoryService } from 'src/common/database/tenant-repository.service';
import {
  applyTenantFilter,
  tenantWhere,
} from 'src/common/utils/tenant-scope.util';

@Injectable()
export class AdminDeliveryPartnerService {
  constructor(
    private readonly internalAuthService: InternalAuthService,
    private readonly tenantRepos: TenantRepositoryService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async attachUsers<T extends { userId: string }>(
    partners: T[],
  ): Promise<Array<T & { user?: User }>> {
    const userIds = [
      ...new Set(partners.map((partner) => partner.userId).filter(Boolean)),
    ];
    if (!userIds.length) {
      return partners;
    }

    const users = await this.userRepo.find({ where: { id: In(userIds) } });
    const userById = new Map(users.map((user) => [user.id, user]));

    return partners.map((partner) => ({
      ...partner,
      user: userById.get(partner.userId),
    }));
  }

  private async findUserIdsByPhoneSearch(search: string): Promise<string[]> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('user.phone ILIKE :search', { search: `%${search}%` })
      .getMany();

    return users.map((user) => user.id);
  }

  private applyDeliveryPartnerSearch(
    qb: ReturnType<Repository<DeliveryPartner>['createQueryBuilder']>,
    search: string,
    matchingUserIds: string[],
  ) {
    const searchTerm = `%${search}%`;
    qb.andWhere(
      new Brackets((subQb) => {
        subQb
          .where('dp.name ILIKE :search', { search: searchTerm })
          .orWhere('dp.vehicleNumber ILIKE :search', { search: searchTerm })
          .orWhere('dp.phoneNumber ILIKE :search', { search: searchTerm });

        if (matchingUserIds.length) {
          subQb.orWhere('dp.userId IN (:...matchingUserIds)', {
            matchingUserIds,
          });
        }
      }),
    );
  }

  async createDeliveryPartner(dto: CreateDeliveryPartnerDto) {
    try {
      const tenantId = this.tenantContext.requireTenantId();
      const dedicated = this.tenantContext.usesDedicatedDatabase();
      const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
      const user = await this.internalAuthService.createUser({
        role: Role.DELIVERY_PARTNER,
        username: dto.username,
        phone: dto.phone,
        email: dto.email,
        password: dto.password,
      });

      const partner = dpRepo.create({
        userId: user.userId,
        name: dto.name,
        address: dto.address,
        tenantId: dedicated ? null : tenantId,
      });

      const savedPartner = await dpRepo.save(partner);
      return savedPartner;
    } catch (error) {
      console.error('Error creating delivery partner:', error);
      throw error;
    }
  }

  async findAll(query: PaginationQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
    const { search, page, limit } = query;

    const qb = dpRepo
      .createQueryBuilder('dp')
      .where('dp.isBanned = :isBanned', { isBanned: false });
    applyTenantFilter(qb, tenantId, 'dp', dedicated);

    if (search) {
      const matchingUserIds = await this.findUserIdsByPhoneSearch(search);
      this.applyDeliveryPartnerSearch(qb, search, matchingUserIds);
    }

    qb.orderBy('dp.createdAt', 'DESC');

    const result = await applyPagination(qb, page, limit);
    result.data = await this.attachUsers(result.data);

    if (search && result.meta.total === 0) {
      throw new NoRecordsFoundException();
    }

    return result;
  }

  async findById(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const subscriptionRepo = await this.tenantRepos.getRepository(Subscription);
    let partner = await dpRepo.findOne({
      where: tenantWhere(tenantId, { id }, dedicated),
    });

    if (!partner) {
      partner = await dpRepo.findOne({
        where: tenantWhere(tenantId, { userId: id }, dedicated),
      });
    }

    if (!partner) {
      throw new NotFoundException('Delivery Partner not found');
    }

    const [partnerWithUser] = await this.attachUsers([partner]);
    partner = partnerWithUser;

    const orderQb = orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.deliveryPartnerId = :deliveryPartnerId', {
        deliveryPartnerId: partner.id,
      });
    applyTenantFilter(orderQb, tenantId, 'order', dedicated);
    const orders = await orderQb.orderBy('order.createdAt', 'DESC').getMany();

    const subscriptions = await subscriptionRepo.find({
      where: tenantWhere(
        tenantId,
        { deliveryPartnerId: partner.id },
        dedicated,
      ),
      relations: ['customer', 'product'],
    });

    return {
      ...partner,
      orderHistory: orders,
      subscriptions: subscriptions,
    };
  }

  async update(id: string, dto: CreateDeliveryPartnerDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
    const partner = await this.findById(id);

    partner.name = dto.name;
    partner.address = dto.address;
    await dpRepo.save(partner);

    const user = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { id: partner.userId }, dedicated),
    });
    if (user) {
      user.email = dto.email;
      user.phone = dto.phone;
      user.username = dto.username;

      if (dto.password) {
        user.password = await bcrypt.hash(dto.password, 10);
      }

      await this.userRepo.save(user);
    }

    return this.findById(id);
  }

  async banDeliveryPartner(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const partner = await this.findById(id);
    const userId = partner.userId;

    partner.isBanned = true;
    partner.isActive = false;
    await dpRepo.save(partner);

    const user = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { id: userId }, dedicated),
    });
    if (user) {
      user.isActive = false;
      await this.userRepo.save(user);
    }

    await orderRepo.update(
      tenantWhere(tenantId, { deliveryPartnerId: id }, dedicated),
      { isBanned: true },
    );

    return { message: 'Delivery partner banned successfully' };
  }

  async getBannedDeliveryPartners(query: PaginationQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
    const { search, page, limit } = query;

    const qb = dpRepo
      .createQueryBuilder('dp')
      .where('dp.isBanned = :isBanned', { isBanned: true });
    applyTenantFilter(qb, tenantId, 'dp', dedicated);

    if (search) {
      const matchingUserIds = await this.findUserIdsByPhoneSearch(search);
      this.applyDeliveryPartnerSearch(qb, search, matchingUserIds);
    }

    qb.orderBy('dp.createdAt', 'DESC');

    const result = await applyPagination(qb, page, limit);
    result.data = await this.attachUsers(result.data);

    if (search && result.meta.total === 0) {
      throw new NoRecordsFoundException();
    }

    return result;
  }

  async restoreDeliveryPartner(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dedicated = this.tenantContext.usesDedicatedDatabase();
    const dpRepo = await this.tenantRepos.getRepository(DeliveryPartner);
    const orderRepo = await this.tenantRepos.getRepository(Order);
    const partner = await this.findById(id);
    const userId = partner.userId;

    if (!partner.isBanned) {
      throw new NotFoundException('Delivery partner is not banned');
    }

    partner.isBanned = false;
    partner.isActive = true;
    await dpRepo.save(partner);

    const user = await this.userRepo.findOne({
      where: tenantWhere(tenantId, { id: userId }, dedicated),
    });
    if (user) {
      user.isActive = true;
      await this.userRepo.save(user);
    }

    await orderRepo.update(
      tenantWhere(tenantId, { deliveryPartnerId: id }, dedicated),
      { isBanned: false },
    );

    return { message: 'Delivery partner restored successfully' };
  }

  async delete(id: string) {
    return this.banDeliveryPartner(id);
  }
}
