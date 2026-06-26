import { Module } from '@nestjs/common';
import { AdminOrderController } from './order.controller';
import { AdminOrderService } from './order.service';

@Module({
  controllers: [AdminOrderController],
  providers: [AdminOrderService],
})
export class AdminOrderModule {}
