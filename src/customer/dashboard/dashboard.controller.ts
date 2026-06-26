import { Controller, Get, Req, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CustomerProtected } from '../../auth/customer-protected.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Customer | Dashboard')
@CustomerProtected()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get products for dashboard (mobile app home)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of products (default: 10)',
  })
  @ApiResponse({ status: 200, description: 'Products retrieved' })
  async getProducts(@Query('limit') limit?: string) {
    const productLimit = limit ? parseInt(limit) : 10;
    return this.dashboardService.getProducts(productLimit);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get active subscriptions for dashboard' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  async getSubscriptions(@CurrentUser() user: any) {
    return this.dashboardService.getSubscriptions(user.id);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get recent orders for dashboard' })
  @ApiResponse({ status: 200, description: 'Recent orders retrieved' })
  async getOrders(@CurrentUser() user: any) {
    return this.dashboardService.getOrders(user.id);
  }

  @Get('wallet-balance')
  @ApiOperation({ summary: 'Get wallet balance for dashboard' })
  @ApiResponse({ status: 200, description: 'Wallet balance retrieved' })
  async getWalletBalance(@CurrentUser() user: any) {
    return this.dashboardService.getWalletBalance(user.id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get categories for dashboard' })
  @ApiResponse({ status: 200, description: 'Categories retrieved' })
  async getCategories() {
    return this.dashboardService.getcategories();
  }
}
