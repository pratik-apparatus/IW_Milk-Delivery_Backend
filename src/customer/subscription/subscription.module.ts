import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { WalletModule } from '../wallet/wallet.module';
import { OrderModule } from '../order/order.module';
import { InvoiceModule } from '../../invoice/invoice.module';

@Module({
  imports: [WalletModule, OrderModule, forwardRef(() => InvoiceModule)],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionSchedulerService],
  exports: [SubscriptionService, SubscriptionSchedulerService],
})
export class SubscriptionModule {}
