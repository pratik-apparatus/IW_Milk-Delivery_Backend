import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from 'src/entities/subscription.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class AdminSubscriptionFilterDto extends PaginationQueryDto {
    @ApiProperty({ required: false, description: 'Filter by date (YYYY-MM-DD)', example: '2026-02-26' })
    @IsOptional()
    @IsString()
    date?: string;

    @ApiProperty({ required: false, description: 'Filter by delivery partner ID' })
    @IsOptional()
    @IsString()
    deliveryPartnerId?: string;

    @ApiProperty({ required: false, enum: SubscriptionStatus })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;
}
