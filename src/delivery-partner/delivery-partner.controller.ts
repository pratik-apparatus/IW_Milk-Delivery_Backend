import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DeliveryPartnerProtected } from '../auth/delivery-partner-protected.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { DeliveryPartnerService } from './delivery-partner.service';
import { LocationService } from './location.service';
import {
  UpdateDeliveryStatusDto,
  AssignedOrderResponseDto,
  CustomerDetailsResponseDto,
  DeliveryPartnerApiResponseDto,
  UpdateSubscriptionDeliveryStatusDto,
  AssignedSubscriptionResponseDto,
  DeliveryPartnerProfileResponseDto,
  CombinedDeliveryResponseDto,
  StartBatchDeliveryDto,
  RegisterFCMTokenDto,
} from '../dto/delivery-partner.dto';
import {
  UpdateLocationDto,
  LiveLocationResponseDto,
  RouteDataDto,
  LocationResponseDto,
} from '../dto/location.dto';
import { DeliveryStatus } from '../entities/subscription-delivery-log.entity';
import { DeliveryPartnerQueryDto } from './dto/delivery-partner-query.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file uploads
const storage = diskStorage({
  destination: './uploads/delivery-proofs',
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

@ApiTags('Delivery Partner')
@DeliveryPartnerProtected()
@Controller('delivery-partner')
export class DeliveryPartnerController {
  private readonly logger = new Logger('DeliveryPartnerController');

  constructor(
    private readonly deliveryPartnerService: DeliveryPartnerService,
    private readonly locationService: LocationService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get delivery partner profile' })
  @ApiResponse({
    status: 200,
    description: 'Delivery partner profile retrieved successfully',
    type: DeliveryPartnerProfileResponseDto,
  })
  async getProfile(
    @CurrentUser() user: any,
  ): Promise<DeliveryPartnerApiResponseDto<DeliveryPartnerProfileResponseDto>> {
    const profile = await this.deliveryPartnerService.getProfile(user.id);

    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: profile,
    };
  }

  @Post('profile/fcm-token')
  @ApiOperation({ summary: 'Register/Update FCM token for push notifications' })
  @ApiResponse({
    status: 200,
    description: 'FCM token registered successfully',
  })
  @ApiResponse({ status: 404, description: 'Delivery partner not found' })
  async registerFCMToken(
    @CurrentUser() user: any,
    @Body() dto: RegisterFCMTokenDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.deliveryPartnerService.registerFCMToken(user.id, dto.fcmToken);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders assigned to the delivery partner' })
  @ApiResponse({
    status: 200,
    description: 'List of assigned orders',
    type: [AssignedOrderResponseDto],
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Optional date filter (YYYY-MM-DD), defaults to today',
    example: '2026-02-26',
  })
  async getAssignedOrders(
    @CurrentUser() user: any,
    @Query('date') date?: string,
  ): Promise<DeliveryPartnerApiResponseDto<AssignedOrderResponseDto[]>> {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const orders = await this.deliveryPartnerService.getAssignedOrders(
      partner.id,
      date,
    );

    return {
      success: true,
      message: `Found ${orders.length} assigned order(s)`,
      data: orders,
    };
  }

  @Get('orders/in-progress')
  @ApiOperation({
    summary: 'Get in-progress (accepted) orders for the delivery partner',
  })
  @ApiResponse({
    status: 200,
    description: 'List of in-progress orders',
    type: [AssignedOrderResponseDto],
  })
  async getInProgressOrders(
    @CurrentUser() user: any,
  ): Promise<DeliveryPartnerApiResponseDto<AssignedOrderResponseDto[]>> {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const orders = await this.deliveryPartnerService.getInProgressOrders(
      partner.id,
    );

    return {
      success: true,
      message: `Found ${orders.length} in-progress order(s)`,
      data: orders,
    };
  }

  @Get('orders/completed')
  @ApiOperation({
    summary: 'Get all completed orders for the delivery partner',
  })
  @ApiResponse({
    status: 200,
    description: 'Completed orders retrieved with pagination',
  })
  async getCompletedOrders(
    @CurrentUser() user: any,
    @Query() query: DeliveryPartnerQueryDto,
  ) {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const result = await this.deliveryPartnerService.getCompletedOrders(
      partner.id,
      query,
    );

    return {
      success: true,
      message: `Found ${result.meta.total} completed order(s)`,
      data: result.data,
      meta: result.meta,
    };
  }

  @Post('orders/:id/accept')
  @ApiOperation({
    summary:
      'Accept an assigned order and start delivery (moves to OUT_FOR_DELIVERY)',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order accepted and delivery started',
  })
  @ApiResponse({ status: 400, description: 'Order cannot be accepted' })
  @ApiResponse({ status: 403, description: 'Order not assigned to you' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async acceptOrder(
    @Param('id') orderId: string,
    @CurrentUser() user: any,
  ): Promise<
    DeliveryPartnerApiResponseDto<{ orderId: string; status: string }>
  > {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const order = await this.deliveryPartnerService.acceptOrder(
      partner.id,
      orderId,
    );

    return {
      success: true,
      message: 'Order accepted and delivery started',
      data: {
        orderId: order.id,
        status: order.status,
      },
    };
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Update order delivery status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Order not assigned to you' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: any,
  ): Promise<
    DeliveryPartnerApiResponseDto<{ orderId: string; status: string }>
  > {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const order = await this.deliveryPartnerService.updateOrderStatus(
      partner.id,
      orderId,
      dto,
    );

    return {
      success: true,
      message: `Order status updated to ${order.status}`,
      data: {
        orderId: order.id,
        status: order.status,
      },
    };
  }

  @Post('orders/:id/proof')
  @ApiOperation({ summary: 'Upload proof of delivery' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Proof of delivery image',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Proof uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or order status' })
  @ApiResponse({ status: 403, description: 'Order not assigned to you' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadDeliveryProof(
    @Param('id') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ): Promise<
    DeliveryPartnerApiResponseDto<{ orderId: string; proofUrl: string }>
  > {
    if (!file) {
      throw new BadRequestException('Proof image file is required');
    }

    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const proofUrl = `/uploads/delivery-proofs/${file.filename}`;

    try {
      const order = await this.deliveryPartnerService.uploadDeliveryProof(
        partner.id,
        orderId,
        proofUrl,
      );

      return {
        success: true,
        message: 'Delivery proof uploaded successfully',
        data: {
          orderId: order.id,
          proofUrl: order.deliveryProofUrl,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error.status === 400 ||
        error.status === 403 ||
        error.status === 404
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to upload delivery proof');
    }
  }

  @Post('subscriptions/:id/proof')
  @ApiOperation({ summary: 'Upload proof of delivery for subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Proof of delivery image',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Proof uploaded successfully' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadSubscriptionDeliveryProof(
    @Param('id') subscriptionId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ): Promise<
    DeliveryPartnerApiResponseDto<{ subscriptionId: string; proofUrl: string }>
  > {
    if (!file) {
      throw new BadRequestException('Proof image file is required');
    }

    const proofUrl = `/uploads/delivery-proofs/${file.filename}`;

    return {
      success: true,
      message: 'Subscription delivery proof uploaded successfully',
      data: {
        subscriptionId,
        proofUrl,
      },
    };
  }

  @Get('customers/:customerId')
  @ApiOperation({ summary: 'Get customer details for calling' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer details retrieved',
    type: CustomerDetailsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'No access to this customer' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomerDetails(
    @Param('customerId') customerId: string,
    @CurrentUser() user: any,
  ): Promise<DeliveryPartnerApiResponseDto<CustomerDetailsResponseDto>> {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const customerDetails =
      await this.deliveryPartnerService.getCustomerDetails(
        partner.id,
        customerId,
      );

    return {
      success: true,
      message: 'Customer details retrieved successfully',
      data: customerDetails,
    };
  }

  @Get('subscriptions')
  @ApiOperation({
    summary: 'Get all subscriptions assigned to the delivery partner',
  })
  @ApiResponse({
    status: 200,
    description: 'List of assigned subscriptions',
    type: [AssignedSubscriptionResponseDto],
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Optional date filter (YYYY-MM-DD), defaults to today',
    example: '2026-02-26',
  })
  async getAssignedSubscriptions(
    @CurrentUser() user: any,
    @Query('date') date?: string,
  ): Promise<DeliveryPartnerApiResponseDto<AssignedSubscriptionResponseDto[]>> {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const subscriptions =
      await this.deliveryPartnerService.getAssignedSubscriptions(
        partner.id,
        date,
      );

    return {
      success: true,
      message: `Found ${subscriptions.length} assigned subscription(s)`,
      data: subscriptions,
    };
  }

  @Get('subscriptions/completed')
  @ApiOperation({
    summary: 'Get all completed subscriptions for the delivery partner',
  })
  @ApiResponse({
    status: 200,
    description: 'Completed subscriptions retrieved with pagination',
  })
  async getCompletedSubscriptions(
    @CurrentUser() user: any,
    @Query() query: DeliveryPartnerQueryDto,
  ) {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const result = await this.deliveryPartnerService.getCompletedSubscriptions(
      partner.id,
      query,
    );

    return {
      success: true,
      message: `Found ${result.meta.total} completed subscription(s)`,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get details for a specific subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription details retrieved successfully',
    type: AssignedSubscriptionResponseDto,
  })
  async getSubscriptionById(
    @Param('id') subscriptionId: string,
    @CurrentUser() user: any,
  ): Promise<DeliveryPartnerApiResponseDto<AssignedSubscriptionResponseDto>> {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const subscription = await this.deliveryPartnerService.getSubscriptionById(
      partner.id,
      subscriptionId,
    );

    return {
      success: true,
      message: 'Subscription details retrieved successfully',
      data: subscription,
    };
  }

  @Put('subscriptions/:id/status')
  @ApiOperation({ summary: 'Update daily delivery status for a subscription' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  async updateSubscriptionStatus(
    @Param('id') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDeliveryStatusDto,
    @CurrentUser() user: any,
  ) {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const log =
      await this.deliveryPartnerService.updateSubscriptionDeliveryStatus(
        partner.id,
        subscriptionId,
        dto,
      );

    return {
      success: true,
      message: 'Subscription delivery status updated successfully',
      data: log,
    };
  }

  @Get('route')
  @ApiOperation({
    summary: 'Get combined route for today (Orders + Subscriptions)',
  })
  @ApiResponse({
    status: 200,
    description: 'Combined route retrieved successfully',
    type: [CombinedDeliveryResponseDto],
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Optional date filter (YYYY-MM-DD), defaults to today',
    example: '2026-02-26',
  })
  async getDailyRoute(
    @CurrentUser() user: any,
    @Query('date') date?: string,
  ): Promise<DeliveryPartnerApiResponseDto<CombinedDeliveryResponseDto[]>> {
    const partner =
      await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);
    const route = await this.deliveryPartnerService.getDailyRoute(
      partner.id,
      date,
    );

    return {
      success: true,
      message: `Found ${route.length} stop(s) in your route`,
      data: route,
    };
  }

  @Post('location/update')
  @ApiOperation({ summary: 'Update delivery partner real-time location' })
  @ApiResponse({
    status: 200,
    description: 'Location updated',
    type: LocationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  async updateLocation(
    @CurrentUser() user: any,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationResponseDto> {
    try {
      const partner =
        await this.deliveryPartnerService.getDeliveryPartnerByUserId(user.id);

      return await this.locationService.updateDeliveryPartnerLocation(
        dto.orderId,
        partner.id,
        dto.latitude,
        dto.longitude,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update location for order ${dto.orderId}:`,
        error,
      );
      throw error;
    }
  }

  @Get('orders/:orderId/live-location')
  @ApiOperation({ summary: 'Get live location with distance and ETA' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Live location data',
    type: LiveLocationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getLiveLocation(
    @Param('orderId') orderId: string,
  ): Promise<LiveLocationResponseDto> {
    const latestLocation =
      await this.locationService.getLatestLocation(orderId);

    if (!latestLocation) {
      return {
        status: 'waiting',
        message: 'No real-time location data available for this order yet.',
      };
    }

    // Get distance and ETA
    const distanceData = await this.locationService.getDistanceAndETA(orderId);

    return {
      status: latestLocation.isStale ? 'stale' : 'active',
      orderId,
      coordinates: {
        lat: latestLocation.latitude,
        lng: latestLocation.longitude,
      },
      timestamp: latestLocation.timestamp.toISOString(),
      distance_remaining: distanceData?.distance_remaining,
      eta_seconds: distanceData?.eta_seconds,
      isStale: latestLocation.isStale,
      message: latestLocation.isStale
        ? 'Location data is older than 5 minutes'
        : undefined,
    };
  }

  @Get('orders/:orderId/route')
  @ApiOperation({ summary: 'Get optimized route to delivery address' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Route data', type: RouteDataDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOptimizedRoute(
    @Param('orderId') orderId: string,
  ): Promise<RouteDataDto> {
    return this.locationService.getOptimizedRoute(orderId);
  }

  @Post('start-delivery-trip')
  @ApiOperation({
    summary: 'Batch start delivery for multiple orders and subscriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders and Subscriptions marked as OUT_FOR_DELIVERY',
    type: DeliveryPartnerApiResponseDto,
  })
  async startBatchDelivery(
    @CurrentUser() user: any,
    @Body() dto: StartBatchDeliveryDto,
  ): Promise<DeliveryPartnerApiResponseDto<void>> {
    await this.deliveryPartnerService.startBatchDelivery(user.id, dto);

    return {
      success: true,
      message:
        'Trip started successfully. All items marked as OUT_FOR_DELIVERY.',
    };
  }
}
