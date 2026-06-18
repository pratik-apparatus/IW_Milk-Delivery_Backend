import { Module } from '@nestjs/common';
import { CustomerCategoryController } from './category.controller';
import { CategoryModule } from '../../admin/categories/categories.module';

@Module({
    imports: [CategoryModule],
    controllers: [CustomerCategoryController],
})
export class CustomerCategoryModule { }
