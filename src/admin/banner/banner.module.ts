import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerController } from './banner.controller';
import { CustomerBannerController } from '../../customer/banner/banner.controller';

@Module({
  controllers: [BannerController, CustomerBannerController],
  providers: [BannerService],
  exports: [BannerService],
})
export class BannerModule {}
