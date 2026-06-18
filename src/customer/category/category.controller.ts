import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoryService } from '../../admin/categories/categories.servics';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Customer | Categories')
@Controller('categories')
export class CustomerCategoryController {
    constructor(private readonly categoryService: CategoryService) { }

    @Get()
    @ApiOperation({ summary: 'Get all categories' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.categoryService.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get category by id' })
    findById(@Param('id') id: string) {
        return this.categoryService.findById(id);
    }
}
