import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AdminAuditLogService } from './admin-audit-log.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const path: string = request.path || request.url || '';

    if (!path.startsWith('/admin/')) {
      return next.handle();
    }

    const user = request.user;
    const tenantId = request.tenantId;
    if (!user?.id || user.role !== 'ADMIN' || !tenantId) {
      return next.handle();
    }

    const method = request.method;
    const action = `${method} ${path}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          void this.auditLogService.log({
            tenantId,
            adminId: user.id,
            method,
            path,
            action,
            statusCode: response.statusCode,
            ipAddress: request.ip || request.headers['x-forwarded-for'] || null,
            metadata: {
              query: request.query,
              params: request.params,
            },
          });
        },
        error: (error) => {
          void this.auditLogService.log({
            tenantId,
            adminId: user.id,
            method,
            path,
            action,
            statusCode: error?.status || 500,
            ipAddress: request.ip || request.headers['x-forwarded-for'] || null,
            metadata: {
              error: error?.message,
              query: request.query,
              params: request.params,
            },
          });
        },
      }),
    );
  }
}
