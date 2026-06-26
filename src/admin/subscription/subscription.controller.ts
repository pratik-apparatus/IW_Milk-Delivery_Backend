import {
  Controller,
  Get,
  Query,
  Delete,
  Param,
  Post,
  Body,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { subscriptionService } from './subscription.service';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AdminSubscriptionFilterDto } from './dto/subscription-filter.dto';
import { AssignDeliveryPartnerDto } from './dto/assign-delivery-partner.dto';
import { UpdateSubscriptionLogStatusDto } from './dto/update-log-status.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { SubscriptionSchedulerService } from '../../customer/subscription/subscription-scheduler.service';
import { AdminProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin | Subscriptions')
@AdminProtected()
@Controller('admin/subscriptions')
export class subscriptionController {
  constructor(
    private readonly subscriptionService: subscriptionService,
    private readonly schedulerService: SubscriptionSchedulerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions with optional filters' })
  findAll(@Query() query: AdminSubscriptionFilterDto) {
    return this.subscriptionService.getallsub(query);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get all subscriptions of a specific customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No subscriptions found for this customer',
  })
  getSubscriptionsByCustomerId(@Param('customerId') customerId: string) {
    return this.subscriptionService.getSubscriptionsByCustomerId(customerId);
  }

  @Post(':id/assign-delivery-partner')
  @ApiOperation({ summary: 'Assign a delivery partner to a subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Delivery partner assigned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription or Delivery partner not found',
  })
  assignDeliveryPartner(
    @Param('id') id: string,
    @Body() assignDto: AssignDeliveryPartnerDto,
  ) {
    return this.subscriptionService.assignDeliveryPartner(
      id,
      assignDto.deliveryPartnerId,
    );
  }

  @Put(':id/update-delivery-partner')
  @ApiOperation({
    summary: 'Update/Edit the assigned delivery partner for a subscription',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Delivery partner updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription or Delivery partner not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot assign a banned or inactive delivery partner',
  })
  updateDeliveryPartner(
    @Param('id') id: string,
    @Body() assignDto: AssignDeliveryPartnerDto,
  ) {
    return this.subscriptionService.updateDeliveryPartner(
      id,
      assignDto.deliveryPartnerId,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get delivery history of all subscriptions' })
  getDeliveryHistory(@Query() query: PaginationQueryDto) {
    return this.subscriptionService.getDeliveryHistory(query);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get delivery history of a specific subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  getSubscriptionHistory(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.subscriptionService.getDeliveryHistory(query, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  delete(@Param('id') id: string) {
    return this.subscriptionService.deleteSubscription(id);
  }

  @Post('trigger-processing')
  @ApiOperation({
    summary:
      'Manually trigger subscription delivery processing (Data Healing + Order Generation)',
  })
  @ApiQuery({
    name: 'subscriptionId',
    required: false,
    description: 'Optional: Process only this specific subscription',
  })
  @ApiResponse({
    status: 200,
    description: 'Processing triggered successfully',
  })
  async triggerProcessing(@Query('subscriptionId') subscriptionId?: string) {
    const result =
      await this.schedulerService.triggerSubscriptionProcessing(subscriptionId);
    return {
      success: true,
      message: subscriptionId
        ? `Processing completed for subscription ${subscriptionId}`
        : 'Manual subscription processing completed',
      summary: result.summary,
      processedRecords: result.details,
    };
  }

  @Delete('logs/:id')
  @ApiOperation({ summary: 'Delete subscription logs' })
  @ApiParam({ name: 'id', description: 'Log entry ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription logs deleted successfully',
  })
  deleteSubscriptionLogs(@Param('id') id: string) {
    return this.subscriptionService.deleteSubscriptionLogs(id);
  }

  @Put('logs/:id/status')
  @ApiOperation({ summary: 'Update subscription delivery log status (Admin)' })
  @ApiParam({ name: 'id', description: 'Log ID' })
  @ApiResponse({ status: 200, description: 'Log status updated successfully' })
  updateLogStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionLogStatusDto,
  ) {
    return this.subscriptionService.updateSubscriptionLogStatus(id, dto);
  }

  @Post(':id/extend-missed')
  @ApiOperation({
    summary: 'Extend subscription end date due to missed delivery',
  })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription extended successfully',
  })
  extendMissed(@Param('id') id: string, @Body() dto: ExtendSubscriptionDto) {
    return this.subscriptionService.extendSubscriptionForMissedDelivery(
      id,
      dto,
    );
  }
}
