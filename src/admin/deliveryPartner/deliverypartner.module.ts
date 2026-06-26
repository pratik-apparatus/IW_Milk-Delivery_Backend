import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { AdminDeliveryPartnerService } from './deliveryPartner.services';
import { AdminDeliveryPartnerController } from './deliverypartner.controllers';
import { InternalAuthModule } from 'src/internal/auth/internal-auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), InternalAuthModule],
  controllers: [AdminDeliveryPartnerController],
  providers: [AdminDeliveryPartnerService],
})
export class AdminDeliveryPartnerModule {}
