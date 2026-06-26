import { ApiProperty } from '@nestjs/swagger';

export class LatestLocationDto {
  @ApiProperty({ example: 18.5204 })
  latitude: number;

  @ApiProperty({ example: 73.8567 })
  longitude: number;

  @ApiProperty({ example: '2026-01-09T10:00:00Z' })
  timestamp: string;
}

export class DeliveryPartnerInfoDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'rajesh_kumar' })
  username: string;

  @ApiProperty({ example: '123-456-7890' })
  phone: string;
}

export class OrderTrackingResDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  orderId: string;

  @ApiProperty({
    example: 'OUT_FOR_DELIVERY',
    enum: [
      'PENDING',
      'PACKAGING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ],
  })
  status: string;

  @ApiProperty({ example: 18.5204, nullable: true })
  deliveryLatitude: number;

  @ApiProperty({ example: 73.8567, nullable: true })
  deliveryLongitude: number;

  @ApiProperty({ example: '15 mins', nullable: true })
  estimatedDeliveryTime: string;

  @ApiProperty({
    type: LatestLocationDto,
    nullable: true,
    description: 'Latest location of delivery partner',
  })
  latestLocation: LatestLocationDto | null;

  @ApiProperty({
    type: DeliveryPartnerInfoDto,
    nullable: true,
    description: 'Delivery partner information',
  })
  deliveryPartner: DeliveryPartnerInfoDto | null;

  @ApiProperty({ example: '2026-01-09T10:00:00Z' })
  createdAt: Date;
}

export class DeliveryPartnerResDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  deliveryPartnerId: string;

  @ApiProperty({ example: 'Rajesh Kumar' })
  name: string;

  @ApiProperty({ example: '+919876543210' })
  phone: string;
}
