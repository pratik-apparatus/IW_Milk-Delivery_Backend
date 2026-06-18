import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { WalletModule } from '../wallet/wallet.module';
import { OrderModule } from '../order/order.module';

@Module({
    imports: [WalletModule, OrderModule],
    controllers: [SubscriptionController],
    providers: [SubscriptionService, SubscriptionSchedulerService],
    exports: [SubscriptionService, SubscriptionSchedulerService],
})
export class SubscriptionModule { }
