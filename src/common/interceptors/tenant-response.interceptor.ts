import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TenantContextService } from '../services/tenant-context.service';
import { enrichWithTenantId } from '../utils/tenant-response.util';

@Injectable()
export class TenantResponseInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId =
      request.tenantId || this.tenantContext.getTenantId() || null;

    if (!tenantId) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (
          data instanceof StreamableFile ||
          Buffer.isBuffer(data) ||
          data instanceof Uint8Array
        ) {
          return data;
        }
        return enrichWithTenantId(data, tenantId);
      }),
    );
  }
}
