import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { WalletModule } from '../wallet/wallet.module';
import { TrackingModule } from '../tracking/tracking.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [WalletModule, TrackingModule, CommonModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
