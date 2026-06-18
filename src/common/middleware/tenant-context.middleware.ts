import {
  Injectable,
  NestMiddleware,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NextFunction, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../../entities/tenant.entity';

const EXCLUDED_PREFIXES = ['/super-admin', '/internal', '/api-docs', '/health'];

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const path = req.path || '';
    if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const tenantIdHeader = req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdHeader === 'string' ? tenantIdHeader.trim() : null;

    const host = req.headers.host || '';
    const subdomain = this.extractSubdomain(host);

    let tenant: Tenant | null = null;
    if (tenantId) {
      tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    } else if (subdomain) {
      tenant = await this.tenantRepo.findOne({ where: { subdomain } });
    } else if (path.startsWith('/admin/')) {
      // Tenant ADMIN routes: tenant can be resolved from JWT in AdminTenantResolverGuard
      return next();
    }

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException('Tenant is not active');
    }

    if (tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    (req as any).tenant = tenant;
    (req as any).tenantId = tenant.id;
    next();
  }

  private extractSubdomain(host: string): string | null {
    const cleanedHost = host.split(':')[0];
    const parts = cleanedHost.split('.');
    if (parts.length < 3) {
      return null;
    }
    return parts[0];
  }
}

