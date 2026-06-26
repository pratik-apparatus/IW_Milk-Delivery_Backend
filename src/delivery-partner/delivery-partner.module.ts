import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryPartnerController } from './delivery-partner.controller';
import { DeliveryPartnerService } from './delivery-partner.service';
import { LocationService } from './location.service';
import { User } from '../entities/user.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), HttpModule, CommonModule],
  controllers: [DeliveryPartnerController],
  providers: [DeliveryPartnerService, LocationService],
  exports: [DeliveryPartnerService, LocationService],
})
export class DeliveryPartnerAppModule {}
