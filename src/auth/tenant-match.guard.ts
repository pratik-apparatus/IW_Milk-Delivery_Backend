import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class TenantMatchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestTenantId = request.tenantId;

    if (!user) {
      return true;
    }

    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user.tenantId || !requestTenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    if (user.tenantId !== requestTenantId) {
      throw new ForbiddenException('Token tenant does not match request tenant');
    }

    return true;
  }
}
