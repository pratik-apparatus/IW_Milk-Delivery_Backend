import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../../entities/user.entity';

@Injectable()
export class DeliveryPartnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== Role.DELIVERY_PARTNER) {
      throw new ForbiddenException(
        'Access restricted to delivery partners only',
      );
    }

    return true;
  }
}
