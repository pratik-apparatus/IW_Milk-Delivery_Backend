import { Module } from '@nestjs/common';
import { AppConfigService } from '../../admin/app-config/app-config.service';
import { SuperAdminAppConfigController } from '../../super-admin/app-config/app-config.controller';
import { CustomerAppConfigController } from '../../customer/app-config/app-config.controller';
import { DeliveryAppConfigController } from '../../delivery-partner/app-config/app-config.controller';

@Module({
  controllers: [
    SuperAdminAppConfigController,
    CustomerAppConfigController,
    DeliveryAppConfigController,
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
