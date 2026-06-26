import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { LocationService } from '../../delivery-partner/location.service';

@Module({
  imports: [HttpModule],
  controllers: [TrackingController],
  providers: [TrackingService, LocationService],
  exports: [LocationService],
})
export class TrackingModule {}
