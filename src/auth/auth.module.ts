import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TenantMatchGuard } from './tenant-match.guard';
import { AdminTenantResolverGuard } from './admin-tenant-resolver.guard';
import { AdminSubscriptionGuard } from './admin-subscription.guard';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: (configService.get<string>('ACCESS_TOKEN_EXPIRY') ||
            '7d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TenantMatchGuard,
    AdminTenantResolverGuard,
    AdminSubscriptionGuard,
  ],
  exports: [
    PassportModule,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    TenantMatchGuard,
    AdminTenantResolverGuard,
    AdminSubscriptionGuard,
  ],
})
export class AuthModule {}
