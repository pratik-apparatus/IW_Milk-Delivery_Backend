import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { InternalCustomerController } from './internal-customer.controller';
import { InternalCustomerService } from './internal-customer.service';
import { InternalServiceGuard } from '../../auth/internal-service.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [InternalCustomerController],
  providers: [InternalCustomerService, InternalServiceGuard],
  exports: [InternalCustomerService],
})
export class InternalCustomerModule { }
