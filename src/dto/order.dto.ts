import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Product ID',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class UpdateCartDto {
  @ApiProperty({ type: [CartItemDto], description: 'Cart items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Use saved address from customer profile',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  useSavedAddress?: boolean;

  @ApiProperty({
    description:
      'Delivery address, if different from profile (required if useSavedAddress is false)',
    required: false,
  })
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @ApiProperty({
    description: 'Delivery phone, if different from profile',
    required: false,
  })
  @IsString()
  @IsOptional()
  deliveryPhone?: string;

  @ApiProperty({
    example: 18.5204,
    description:
      'Latitude coordinate (required if useSavedAddress is false and providing new address)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    example: 73.8567,
    description:
      'Longitude coordinate (required if useSavedAddress is false and providing new address)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class OrderItemResDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  price: number;
}

export class OrderResDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  paymentMethod: string;

  @ApiProperty()
  deliveryAddress: string;

  @ApiProperty()
  deliveryPhone: string;

  @ApiProperty({ type: [OrderItemResDto] })
  items: OrderItemResDto[];

  @ApiProperty()
  createdAt: Date;
}
