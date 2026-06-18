import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Customer } from '../../entities/customer.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDatabaseService } from '../../common/database/tenant-database.service';

@Injectable()
export class InternalCustomerService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantDatabase: TenantDatabaseService,
  ) {}

  private async customerRepo(tenantId: string) {
    return this.tenantDatabase.getRepositoryForTenant(tenantId, Customer);
  }

  async findOrCreate(phone: string, tenantId?: string | null) {
    if (!tenantId) {
      throw new NotFoundException('Tenant context is required');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant?.dbName) {
      throw new NotFoundException('Tenant database is not configured');
    }

    const repo = await this.customerRepo(tenantId);
    let customer = await repo.findOne({ where: { phone, isBanned: false } });

    if (!customer) {
      const uniqueId = randomUUID();
      customer = repo.create({
        phone,
        tenantId: null,
        name: 'Guest User',
        email: `guest-${uniqueId}@example.com`,
        houseNo: '',
        landmark: '',
        area: '',
        address: '',
        isActive: true,
        isBanned: false,
      });
      customer = await repo.save(customer);
    }

    return {
      customerId: customer.id,
      phone: customer.phone,
      tenantId,
    };
  }

  async getAuthData(phone: string, tenantId?: string | null) {
    if (!tenantId) {
      throw new NotFoundException('Tenant context is required');
    }

    const repo = await this.customerRepo(tenantId);
    const customer = await repo.findOne({
      where: { phone, isActive: true, isBanned: false },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      customerId: customer.id,
      phone: customer.phone,
      tenantId,
      role: 'CUSTOMER',
    };
  }
}
