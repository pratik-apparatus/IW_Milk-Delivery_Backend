import { Controller, Post, Get, Put, Patch, Delete, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';
import { CreateSubscriptionDto, SubscriptionResDto } from '../../dto/subscription.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Customer | Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionController {
    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly subscriptionSchedulerService: SubscriptionSchedulerService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create new subscription' })
    @ApiResponse({ status: 201, description: 'Subscription created and wallet debited', type: SubscriptionResDto })
    @ApiResponse({ status: 400, description: 'Insufficient balance or invalid plan' })
    @ApiResponse({ status: 404, description: 'Customer or product not found' })
    async createSubscription(
        @CurrentUser() user: any,
        @Body() dto: CreateSubscriptionDto
    ) {
        return this.subscriptionService.createSubscription(user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all my subscriptions with pagination and search' })
    @ApiResponse({ status: 200, description: 'Subscriptions retrieved', type: [SubscriptionResDto] })
    async getMySubscriptions(
        @CurrentUser() user: any,
        @Query() query: PaginationQueryDto
    ) {
        return this.subscriptionService.getMySubscriptions(user.id, query);
    }

    // Keeping active for backwards compatibility if needed, but getMySubscriptions can replace it
    @Get('active')
    @ApiOperation({ summary: 'Get all active subscriptions' })
    @ApiResponse({ status: 200, description: 'Active subscriptions retrieved', type: [SubscriptionResDto] })
    async getActiveSubscriptions(
        @CurrentUser() user: any
    ) {
        return this.subscriptionService.getActiveSubscriptions(user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get subscription by ID' })
    @ApiParam({ name: 'id', description: 'Subscription ID' })
    @ApiResponse({ status: 200, description: 'Subscription retrieved', type: SubscriptionResDto })
    @ApiResponse({ status: 404, description: 'Subscription not found' })
    async getSubscriptionById(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.subscriptionService.getSubscriptionById(user.id, id);
    }

    @Post(':id/pause')
    @ApiOperation({ summary: 'Pause subscription' })
    @ApiParam({ name: 'id', description: 'Subscription ID' })
    @ApiResponse({ status: 200, description: 'Subscription paused', type: SubscriptionResDto })
    @ApiResponse({ status: 400, description: 'Cannot pause non-active subscription' })
    @ApiResponse({ status: 404, description: 'Subscription not found' })
    async pauseSubscription(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.subscriptionService.pauseSubscription(user.id, id);
    }

    @Post(':id/resume')
    @ApiOperation({ summary: 'Resume paused subscription' })
    @ApiParam({ name: 'id', description: 'Subscription ID' })
    @ApiResponse({ status: 200, description: 'Subscription resumed', type: SubscriptionResDto })
    @ApiResponse({ status: 400, description: 'Cannot resume non-paused subscription' })
    @ApiResponse({ status: 404, description: 'Subscription not found' })
    async resumeSubscription(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.subscriptionService.resumeSubscription(user.id, id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Cancel subscription' })
    @ApiParam({ name: 'id', description: 'Subscription ID' })
    @ApiResponse({ status: 200, description: 'Subscription cancelled' })
    @ApiResponse({ status: 404, description: 'Subscription not found' })
    async cancelSubscription(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        await this.subscriptionService.cancelSubscription(user.id, id);
        return { message: 'Subscription cancelled successfully' };
    }

    @Post('trigger-processing')
    @ApiOperation({ summary: 'Manually trigger subscription processing (for testing)' })
    @ApiResponse({ status: 200, description: 'Subscriptions processed successfully' })
    async triggerSubscriptionProcessing() {
        return await this.subscriptionSchedulerService.triggerSubscriptionProcessing();
    }

    @Patch(':id/add-missed-delivery')
    @ApiOperation({ summary: 'Add missed delivery for a subscription' })
    @ApiParam({ name: 'id', description: 'Subscription ID' })
    @ApiResponse({ status: 200, description: 'Missed delivery added successfully', type: SubscriptionResDto })
    @ApiResponse({ status: 404, description: 'Subscription not found' })
    async addMissedDelivery(
        @Param('id') subscriptionId: string,
        @CurrentUser() user: any,
    ) {
        return await this.subscriptionService.addMissedDelivery(user.id, subscriptionId);
    }
}
