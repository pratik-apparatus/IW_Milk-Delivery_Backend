import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CommonModule } from '../../common/common.module';

@Module({
    imports: [WalletModule, CommonModule],
    controllers: [PaymentController],
    providers: [PaymentService],
})
export class PaymentModule { }
