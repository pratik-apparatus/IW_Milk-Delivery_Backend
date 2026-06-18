import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../services/tenant-context.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const usesDedicatedDatabase = Boolean(request.tenant?.dbName);
    return this.tenantContextService.runWithTenant(
      request.tenantId,
      () => next.handle(),
      usesDedicatedDatabase,
    );
  }
}
