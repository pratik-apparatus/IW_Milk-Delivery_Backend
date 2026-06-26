import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Tenant } from '../../entities/tenant.entity';

const ROUTE_APP_MAP: Array<{ prefix: string; app: string }> = [
  { prefix: '/admin/subscriptions', app: 'SUBSCRIPTIONS_MODULE' },
  { prefix: '/subscriptions', app: 'SUBSCRIPTIONS_MODULE' },
  { prefix: '/admin/', app: 'ADMIN_APP' },
  { prefix: '/customer/', app: 'CUSTOMER_APP' },
  { prefix: '/delivery/', app: 'DELIVERY_APP' },
  { prefix: '/payments/', app: 'CUSTOMER_APP' },
];

const EXCLUDED_PREFIXES = [
  '/super-admin',
  '/internal',
  '/api-docs',
  '/health',
  '/uploads',
];

@Injectable()
export class EnabledAppsMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const path = req.path || '';
    if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const tenant = (req as Request & { tenant?: Tenant }).tenant;
    if (!tenant) {
      return next();
    }

    const enabledApps = tenant.enabledApps || [];
    if (enabledApps.length === 0) {
      return next();
    }

    const match = ROUTE_APP_MAP.find(({ prefix }) => path.startsWith(prefix));
    if (!match) {
      return next();
    }

    if (!enabledApps.includes(match.app)) {
      throw new ForbiddenException(
        `Application ${match.app} is not enabled for this tenant`,
      );
    }

    next();
  }
}
