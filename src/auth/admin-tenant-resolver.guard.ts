import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.entity';

@Injectable()
export class AdminTenantResolverGuard implements CanActivate {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'ADMIN') {
      return true;
    }

    const headerTenantId =
      typeof request.headers['x-tenant-id'] === 'string'
        ? request.headers['x-tenant-id'].trim()
        : null;

    const tenantId = headerTenantId || user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant context is required. Pass x-tenant-id header or use an admin token with tenantId.',
      );
    }

    if (user.tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Token tenant does not match request tenant');
    }

    if (!request.tenantId || request.tenantId !== tenantId) {
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      if (!tenant || tenant.deletedAt) {
        throw new NotFoundException('Tenant not found');
      }
      if (tenant.status !== TenantStatus.ACTIVE) {
        throw new ForbiddenException('Tenant is not active');
      }
      request.tenant = tenant;
      request.tenantId = tenant.id;
    }

    return true;
  }
}
