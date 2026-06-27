import { Controller, Delete, Get, Param, Query, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Customer } from 'src/entities/customer.entity';
import { customerService } from './customer.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AdminBillingProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin | Customers')
@AdminBillingProtected()
@Controller('admin/customers')
export class CustomerController {
  constructor(private readonly customerService: customerService) {}

  @Get()
  @ApiOperation({
    summary: 'get all customers (excludes banned)',
  })
  @ApiResponse({
    status: 200,
    description: 'paginated list of customers',
    type: [Customer],
  })
  getAllCustomers(@Query() query: PaginationQueryDto) {
    return this.customerService.getallCustomer(query);
  }

  @Get('all')
  @ApiOperation({
    summary: 'get all customers (alternative route, excludes banned)',
  })
  @ApiResponse({
    status: 200,
    description: 'paginated list of customers',
    type: [Customer],
  })
  getallc(@Query() query: PaginationQueryDto) {
    return this.customerService.getallCustomer(query);
  }

  @Get('banned')
  @ApiOperation({
    summary: 'get all banned customers with subscription details',
  })
  @ApiResponse({
    status: 200,
    description:
      'all banned customers with their subscriptions and product details',
    type: [Customer],
  })
  getBannedCustomers(@Query() query: PaginationQueryDto) {
    return this.customerService.getBannedCustomers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'get customer by id' })
  @ApiResponse({ status: 200, description: 'customer details', type: Customer })
  @ApiResponse({ status: 404, description: 'customer not found' })
  getCustomerById(@Param('id') id: string) {
    return this.customerService.getCustomerById(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'ban customer and all his data including subscriptions, orders, payments',
  })
  @ApiResponse({ status: 200, description: 'customer banned successfully' })
  @ApiResponse({ status: 404, description: 'customer not found' })
  banCustomer(@Param('id') id: string) {
    return this.customerService.banCustomer(id);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'restore banned customer and all related data' })
  @ApiResponse({ status: 200, description: 'customer restored successfully' })
  @ApiResponse({ status: 404, description: 'customer not found or not banned' })
  restoreCustomer(@Param('id') id: string) {
    return this.customerService.restoreCustomer(id);
  }
}
