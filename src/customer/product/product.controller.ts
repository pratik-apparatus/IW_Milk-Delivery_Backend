import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductService } from '../../admin/product/product.sevices';
import { ProductQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Customer | Products')
@Controller('products')
export class CustomerProductController {
    constructor(private readonly productService: ProductService) { }

    @Get()
    @ApiOperation({ summary: 'Get all products with search and filters' })
    findAll(@Query() query: ProductQueryDto) {
        return this.productService.findAll(query);
    }

    @Get('category')
    @ApiOperation({ summary: 'Get product by category' })
    @ApiQuery({ name: 'categoryId', required: true })
    findByCategory(@Query('categoryId') categoryId: string) {
        return this.productService.findByCategory(categoryId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get product by id' })
    findById(@Param('id') id: string) {
        return this.productService.findById(id);
    }
}
