import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalAuthController } from './internal-auth.controller';
import { InternalAuthService } from './internal-auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { InternalServiceGuard } from '../../auth/internal-service.guard';
import { BillingModule } from '../../super-admin/billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, RefreshToken]),
    BillingModule,
  ],
  controllers: [InternalAuthController],
  providers: [InternalAuthService, RefreshTokenService, InternalServiceGuard],
  exports: [InternalAuthService, RefreshTokenService],
})
export class InternalAuthModule {}

