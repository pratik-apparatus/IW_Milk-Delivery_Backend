import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AdminAuditLogService } from './admin-audit-log.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const path: string = request.path || request.url || '';

    if (!path.startsWith('/admin/')) {
      return next.handle();
    }

    if (path.startsWith('/admin/audit-logs')) {
      return next.handle();
    }

    const method = request.method?.toUpperCase() || 'GET';
    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.writeAuditEntry(context, request, method, path);
        },
        error: (error) => {
          void this.writeAuditEntry(context, request, method, path, error);
        },
      }),
    );
  }

  private async writeAuditEntry(
    context: ExecutionContext,
    request: {
      user?: { id?: string; role?: string };
      tenantId?: string;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    method: string,
    path: string,
    error?: { status?: number; message?: string },
  ) {
    const user = request.user;
    const tenantId = request.tenantId;

    if (!user?.id || user.role !== 'ADMIN' || !tenantId) {
      return;
    }

    const response = context.switchToHttp().getResponse();
    const action = `${method} ${path}`;
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const ipAddress =
      request.ip ||
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      null;

    await this.auditLogService.log({
      tenantId,
      adminId: user.id,
      method,
      path,
      action,
      statusCode: error?.status || response?.statusCode || null,
      ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
      metadata: {
        ...(error?.message ? { error: error.message } : {}),
        query: request.query || {},
        params: request.params || {},
      },
    });
  }
}
