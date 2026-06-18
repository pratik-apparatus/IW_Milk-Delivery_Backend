import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    const token = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : null;
    const expected = this.configService.get<string>('INTERNAL_SERVICE_TOKEN');

    if (!token || !expected || token !== expected) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    const path = request.path || '';
    const tenantIdHeader = request.headers['x-tenant-id'];
    const tenantId = typeof tenantIdHeader === 'string' ? tenantIdHeader.trim() : '';

    // Keep internal admin creation global for platform superadmin bootstrap.
    const allowMissingTenant = path.startsWith('/internal/admin/create');
    if (!allowMissingTenant && !tenantId) {
      throw new ForbiddenException('x-tenant-id header is required');
    }

    return true;
  }
}

