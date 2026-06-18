import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InternalCustomerModule } from './internal/customer/internal-customer.module';
import { InternalAuthModule } from './internal/auth/internal-auth.module';
import { InternalAdminModule } from './internal/admin/internal-admin.module';
import { PLATFORM_ENTITIES } from './common/database/platform-database.config';
import { CategoryModule } from './admin/categories/categories.module';
import { CustomerProfileModule } from './customer/profile/profile.module';
import { ProductModule } from './admin/product/product.module';
import { AdminDeliveryPartnerModule } from './admin/deliveryPartner/deliverypartner.module';
import { CustomerModule } from './admin/customers/customer.module';
import { WalletModule } from './customer/wallet/wallet.module';
import { PaymentModule } from './customer/payment/payment.module';
import { SubscriptionModule } from './customer/subscription/subscription.module';
import { OrderModule } from './customer/order/order.module';
import { TrackingModule } from './customer/tracking/tracking.module';
import { DashboardModule } from './customer/dashboard/dashboard.module';
import { CustomerCategoryModule } from './customer/category/category.module';
import { CustomerProductModule } from './customer/product/product.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { subscriptionModule } from './admin/subscription/subscrition.module';
import { DeliveryPartnerAppModule } from './delivery-partner/delivery-partner.module';
import { ReportsModule } from './admin/reports/reports.module';
import { AdminProfileModule } from './admin/Profile/profile.module';
import { AdminOrderModule } from './admin/order/order.module';
import { CommonModule } from './common/common.module';
import { BannerModule } from './admin/banner/banner.module';
import { AppConfigModule } from './admin/app-config/app-config.module';
import { AdminAuditLogModule } from './admin/audit-log/admin-audit-log.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './super-admin/tenants/tenants.module';
import { BillingModule } from './super-admin/billing/billing.module';
import { MicroservicesModule } from './microservices/microservices.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { EnabledAppsMiddleware } from './common/middleware/enabled-apps.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CommonModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // Local bootstrap: set DB_SYNC=true to auto-create schema in Postgres.
        // Keep false in shared/staging/prod.
        type: 'postgres',
        host: configService.get('DB_HOST') || 'localhost',
        port: Number(configService.get('DB_PORT')) || 5432,
        username: configService.get('DB_USER') || 'postgres',
        password: configService.get('DB_PASSWORD') || 'postgres',
        database: configService.get('DB_NAME') || 'milk_delivery',
        entities: PLATFORM_ENTITIES,
        synchronize: true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    InternalCustomerModule,
    InternalAuthModule,
    InternalAdminModule,
    CategoryModule,
    ProductModule,
    AdminDeliveryPartnerModule,
    CustomerModule,
    // New Customer Modules
    CustomerProfileModule,
    WalletModule,
    PaymentModule,
    SubscriptionModule,
    OrderModule,
    TrackingModule,
    DashboardModule,
    CustomerCategoryModule,
    CustomerProductModule,
    AuthModule,
    subscriptionModule,
    DeliveryPartnerAppModule,
    ReportsModule,
    AdminProfileModule,
    AdminOrderModule,
    BannerModule,
    AppConfigModule,
    AdminAuditLogModule,
    HealthModule,
    TenantsModule,
    BillingModule,
    MicroservicesModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 30,
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'super-admin/(.*)', method: RequestMethod.ALL },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/(.*)', method: RequestMethod.ALL },
        { path: 'api-docs', method: RequestMethod.ALL },
        { path: 'api-docs/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(EnabledAppsMiddleware)
      .exclude(
        { path: 'super-admin/(.*)', method: RequestMethod.ALL },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/(.*)', method: RequestMethod.ALL },
        { path: 'api-docs', method: RequestMethod.ALL },
        { path: 'api-docs/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
