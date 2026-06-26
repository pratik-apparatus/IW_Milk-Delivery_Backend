import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { customerService } from './customer.service';

@Module({
  controllers: [CustomerController],
  providers: [customerService],
  exports: [customerService],
})
export class CustomerModule {}
