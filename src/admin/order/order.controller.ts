import { Controller, Get, Put, Delete, Param, Query, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { AdminOrderService } from "./order.service";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { UpdateOrderStatusDto, AdminOrderFilterDto } from "src/dto/admin-order.dto";
import { AdminProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin | Orders')
@AdminProtected()
@Controller("admin/orders")
export class AdminOrderController {
    constructor(private readonly orderService: AdminOrderService) { }

    @Get()
    @ApiOperation({ summary: 'Get all orders with optional date, partner, and status filters' })
    @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
    getAllOrders(@Query() query: AdminOrderFilterDto) {
        return this.orderService.getAllOrders(query);
    }

    @Get(":id")
    @ApiOperation({ summary: 'Get order by ID' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    getOrderById(@Param('id') id: string) {
        return this.orderService.getOrderById(id);
    }

    @Put(":id/status")
    @ApiOperation({ summary: 'Update order status' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiResponse({ status: 200, description: 'Order status updated successfully' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    @ApiResponse({ status: 400, description: 'Invalid status update' })
    updateOrderStatus(
        @Param('id') id: string,
        @Body() dto: UpdateOrderStatusDto
    ) {
        return this.orderService.updateOrderStatus(id, dto);
    }

    @Delete(":id")
    @ApiOperation({ summary: 'Delete order' })
    @ApiParam({ name: 'id', description: 'Order ID' })
    @ApiResponse({ status: 200, description: 'Order deleted successfully' })
    @ApiResponse({ status: 404, description: 'Order not found' })
    @ApiResponse({ status: 400, description: 'Cannot delete order' })
    deleteOrder(@Param('id') id: string) {
        return this.orderService.deleteOrder(id);
    }
}

