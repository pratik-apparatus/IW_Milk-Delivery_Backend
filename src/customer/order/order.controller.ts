import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { UpdateCartDto, CreateOrderDto, OrderResDto } from '../../dto/order.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Customer | Orders & Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) { }

    @Get('cart')
    @ApiOperation({ summary: 'Get cart' })
    @ApiResponse({ status: 200, description: 'Cart retrieved' })
    async getCart(@CurrentUser() user: any) {
        return this.orderService.getCart(user.id);
    }

    @Put('cart')
    @ApiOperation({ summary: 'Update cart (add/remove/update items)' })
    @ApiResponse({ status: 200, description: 'Cart updated' })
    @ApiResponse({ status: 404, description: 'Product not found' })
    @ApiResponse({ status: 400, description: 'Product not available' })
    async updateCart(
        @CurrentUser() user: any,
        @Body() dto: UpdateCartDto
    ) {
        return this.orderService.updateCart(user.id, dto);
    }

    @Post()
    @ApiOperation({ summary: 'Create order from cart (checkout)' })
    @ApiResponse({ status: 201, description: 'Order created and wallet debited', type: OrderResDto })
    @ApiResponse({ status: 400, description: 'Cart empty or insufficient balance' })
    async createOrder(
        @CurrentUser() user: any,
        @Body() dto: CreateOrderDto
    ) {
        return this.orderService.createOrder(user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all orders' })
    @ApiResponse({ status: 200, description: 'Orders retrieved with pagination' })
    async getOrders(
        @CurrentUser() user: any,
        @Query() query: PaginationQueryDto
    ) {
        return this.orderService.getOrders(user.id, query);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Cancel order and refund to wallet' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiResponse({ status: 200, description: 'Order cancelled and refunded' })
    @ApiResponse({ status: 400, description: 'Cannot cancel non-pending order' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    async cancelOrder(
        @CurrentUser() user: any,
        @Param('id') id: string
    ) {
        return this.orderService.cancelOrder(user.id, id);
    }
}