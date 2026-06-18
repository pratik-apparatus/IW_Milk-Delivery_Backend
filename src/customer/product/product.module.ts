import { Module } from '@nestjs/common';
import { CustomerProductController } from './product.controller';
import { ProductModule } from '../../admin/product/product.module';

@Module({
    imports: [ProductModule],
    controllers: [CustomerProductController],
})
export class CustomerProductModule { }
