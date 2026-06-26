import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';
import { DeliveryStatus } from '../entities/subscription-delivery-log.entity';
import { PlanType, SubscriptionStatus } from '../entities/subscription.entity';

export class DeliveryProductDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  image?: string;

  @ApiProperty()
  quantity: number;

  @ApiPropertyOptional()
  price?: number;
}

export class SubscriptionLogDto {
  @ApiProperty()
  deliveryDate: string;

  @ApiProperty({ enum: DeliveryStatus })
  status: DeliveryStatus;

  @ApiPropertyOptional()
  notes?: string;
}

// DTO for updating order status by delivery partner
export class UpdateDeliveryStatusDto {
  @ApiProperty({
    enum: [OrderStatus.DELIVERED, OrderStatus.FAILED],
    description: 'New delivery status (simplified to Delivered or Failed)',
  })
  @IsEnum([OrderStatus.DELIVERED, OrderStatus.FAILED])
  @IsNotEmpty()
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Optional notes or failure reason' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// Response DTOs for delivery partner
export class AssignedOrderResponseDto {
  @ApiProperty()
  orderId: string;

  @ApiProperty({ enum: OrderStatus })
  orderStatus: OrderStatus;

  @ApiProperty()
  deliveryAddress: string;

  @ApiProperty()
  deliveryLatitude: number;

  @ApiProperty()
  deliveryLongitude: number;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerPhone: string;

  @ApiPropertyOptional()
  deliverySlot?: string;

  @ApiPropertyOptional()
  totalAmount?: number;

  @ApiPropertyOptional()
  googleMapsUrl?: string;

  @ApiPropertyOptional()
  pickupAddress?: string;

  @ApiPropertyOptional()
  pickupLatitude?: number;

  @ApiPropertyOptional()
  pickupLongitude?: number;

  @ApiProperty({ type: [DeliveryProductDto] })
  items: DeliveryProductDto[];
}

export class AssignedSubscriptionResponseDto {
  @ApiProperty()
  subscriptionId: string;

  @ApiProperty({ enum: PlanType })
  planType: PlanType;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerPhone: string;

  @ApiProperty()
  deliveryAddress: string;

  @ApiPropertyOptional()
  deliveryLatitude?: number;

  @ApiPropertyOptional()
  deliveryLongitude?: number;

  @ApiPropertyOptional()
  googleMapsUrl?: string;

  @ApiPropertyOptional()
  nextDeliveryDate?: Date;

  @ApiPropertyOptional({ type: [String] })
  selectedDays?: string[];

  @ApiPropertyOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  endDate?: Date;

  @ApiProperty()
  isDeliveredToday: boolean;

  @ApiProperty({ type: [SubscriptionLogDto] })
  deliveryLogs: SubscriptionLogDto[];

  @ApiPropertyOptional()
  pickupAddress?: string;

  @ApiPropertyOptional()
  pickupLatitude?: number;

  @ApiPropertyOptional()
  pickupLongitude?: number;

  @ApiProperty({ type: DeliveryProductDto })
  product: DeliveryProductDto;
}

export class CustomerDetailsResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  deliveryAddress: string;

  @ApiPropertyOptional()
  googleMapsUrl?: string;
}

export class DeliveryPartnerApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: T;
}

export class UpdateSubscriptionDeliveryStatusDto {
  @ApiProperty({
    enum: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
    description: 'New delivery status for subscription (Simplified)',
  })
  @IsEnum([DeliveryStatus.DELIVERED, DeliveryStatus.FAILED])
  @IsNotEmpty()
  status: DeliveryStatus;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Optional delivery date (YYYY-MM-DD), defaults to today',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deliveryDate must be in YYYY-MM-DD format',
  })
  deliveryDate?: string;

  @ApiPropertyOptional({ description: 'Optional delivery proof image URL' })
  @IsOptional()
  @IsString()
  deliveryProofUrl?: string;
}

export class DeliveryPartnerProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  phone: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  vehicleNumber?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  currentOrders: number;
}

export class CombinedDeliveryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['ORDER', 'SUBSCRIPTION'] })
  type: 'ORDER' | 'SUBSCRIPTION';

  @ApiProperty()
  status: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerPhone: string;

  @ApiProperty()
  deliveryAddress: string;

  @ApiPropertyOptional()
  deliveryLatitude?: number;

  @ApiPropertyOptional()
  deliveryLongitude?: number;

  @ApiPropertyOptional()
  googleMapsUrl?: string;

  @ApiProperty({ type: [DeliveryProductDto] })
  items: DeliveryProductDto[];

  @ApiPropertyOptional()
  deliverySlot?: string;

  @ApiProperty()
  isCompleted: boolean;
}

export class StartBatchDeliveryDto {
  @ApiProperty({ type: [String], description: 'List of order IDs to start' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  @ApiProperty({
    type: [String],
    description: 'List of subscription IDs to start',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subscriptionIds: string[];
}

export class RegisterFCMTokenDto {
  @ApiProperty({ description: 'The FCM registration token' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
