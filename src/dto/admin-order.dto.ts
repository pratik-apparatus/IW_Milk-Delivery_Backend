import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class UpdateOrderStatusDto {
    @ApiProperty({
        enum: OrderStatus,
        description: 'New order status',
        example: OrderStatus.DELIVERED,
        required: false
    })
    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;

    @ApiProperty({ required: false, description: 'Re-assign to a different delivery partner' })
    @IsOptional()
    @IsString()
    deliveryPartnerId?: string;
}

export class AdminOrderFilterDto extends PaginationQueryDto {
    @ApiProperty({ required: false, description: 'Filter by date (YYYY-MM-DD)', example: '2026-02-26' })
    @IsOptional()
    @IsString()
    date?: string;

    @ApiProperty({ required: false, description: 'Filter by delivery partner ID' })
    @IsOptional()
    @IsString()
    deliveryPartnerId?: string;

    @ApiProperty({ required: false, enum: OrderStatus })
    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus;
}

