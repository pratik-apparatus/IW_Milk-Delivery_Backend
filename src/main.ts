import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CategoryModule } from './admin/categories/categories.module';
import { ProductModule } from './admin/product/product.module';
import { AdminDeliveryPartnerModule } from './admin/deliveryPartner/deliverypartner.module';
import { subscriptionModule } from './admin/subscription/subscrition.module';
import { CustomerModule } from './admin/customers/customer.module';


// New Customer Modules
import { CustomerProfileModule } from './customer/profile/profile.module';
import { WalletModule } from './customer/wallet/wallet.module';
import { PaymentModule } from './customer/payment/payment.module';
import { SubscriptionModule } from './customer/subscription/subscription.module';
import { OrderModule } from './customer/order/order.module';
import { TrackingModule } from './customer/tracking/tracking.module';
import { DashboardModule } from './customer/dashboard/dashboard.module';
import { CustomerCategoryModule } from './customer/category/category.module';
import { CustomerProductModule } from './customer/product/product.module';
import { DeliveryPartnerAppModule } from './delivery-partner/delivery-partner.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ReportsModule } from './admin/reports/reports.module';
import { AdminProfileModule } from './admin/Profile/profile.module';
import { AdminOrderModule } from './admin/order/order.module';
import { BannerModule } from './admin/banner/banner.module';
import { AppConfigModule } from './admin/app-config/app-config.module';
import { AdminAuditLogModule } from './admin/audit-log/admin-audit-log.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './super-admin/tenants/tenants.module';
import { BillingModule } from './super-admin/billing/billing.module';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files for delivery proofs
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });


  // Enable CORS - Allow all origins
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
    credentials: true,
  });

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Milk Delivery API')
    .setDescription('Backend API for Milk Delivery Mobile Application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [
      CategoryModule,
      ProductModule,
      AdminDeliveryPartnerModule,
      subscriptionModule,
      CustomerModule,
      CustomerProfileModule,
      WalletModule,
      PaymentModule,
      SubscriptionModule,
      OrderModule,
      TrackingModule,
      DashboardModule,
      CustomerCategoryModule,
      CustomerProductModule,
      DeliveryPartnerAppModule,
      ReportsModule,
      AdminProfileModule,
      AdminOrderModule,
      BannerModule,
      AppConfigModule,
      AdminAuditLogModule,
      HealthModule,
      TenantsModule,
      BillingModule

    ],
  });

  SwaggerModule.setup('api-docs', app, document);


  const port = process.env.PORT || 4010;
  const msHost = process.env.MS_HOST || '0.0.0.0';
  const msPort = Number(process.env.MS_PORT || 4012);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: msHost, port: msPort },
  });

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
  console.log(`Backend HTTP is running on: http://localhost:${port}`);
  console.log(`Backend TCP microservice listening on: ${msHost}:${msPort}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api-docs`);
}

bootstrap();


