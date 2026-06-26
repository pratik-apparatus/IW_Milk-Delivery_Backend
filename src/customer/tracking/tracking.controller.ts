import { Controller, Get, Param, Req, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import {
  OrderTrackingResDto,
  DeliveryPartnerResDto,
} from '../../dto/tracking.dto';
import { CustomerProtected } from '../../auth/customer-protected.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';

@ApiTags('Customer | Order Tracking')
@CustomerProtected()
@Controller('orders')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':id/track')
  @ApiOperation({ summary: 'Track order (status, location, ETA)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order tracking data',
    type: OrderTrackingResDto,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async trackOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trackingService.trackOrder(user.id, id);
  }

  @Get(':id/delivery-partner')
  @ApiOperation({ summary: 'Get delivery partner details for order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Delivery partner info',
    type: DeliveryPartnerResDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order or delivery partner not found',
  })
  async getDeliveryPartner(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trackingService.getDeliveryPartner(user.id, id);
  }
}
