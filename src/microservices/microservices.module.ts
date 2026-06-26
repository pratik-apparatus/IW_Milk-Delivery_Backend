import { Module } from '@nestjs/common';
import { InternalAuthModule } from '../internal/auth/internal-auth.module';
import { InternalCustomerModule } from '../internal/customer/internal-customer.module';
import { InternalAdminModule } from '../internal/admin/internal-admin.module';
import { InternalMicroserviceController } from './internal.microservice.controller';
import { MailClientModule } from './mail-client.module';

@Module({
  imports: [
    InternalAuthModule,
    InternalCustomerModule,
    InternalAdminModule,
    MailClientModule,
  ],
  controllers: [InternalMicroserviceController],
})
export class MicroservicesModule {}
