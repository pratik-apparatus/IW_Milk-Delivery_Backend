import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, IsArray, ArrayMinSize, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanType } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Product ID' })
    @IsUUID()
    @IsNotEmpty()
    productId: string;

    @ApiProperty({ example: 'DAILY', enum: [ 'WEEKLY', 'MONTHLY'], description: 'Subscription plan type' })
    @IsEnum(PlanType)
    @IsNotEmpty()
    planType: PlanType;

    @ApiProperty({ example: '01/10/2026', description: 'Start date in DD/MM/YYYY format' })
    @IsString()
    @IsNotEmpty()
    startDate: string;

    @ApiPropertyOptional({ example: '31/12/2026', description: 'End date in DD/MM/YYYY format (optional)' })
    @IsString()
    @IsOptional()
    endDate?: string;

    @ApiPropertyOptional({ 
        example: ['Mon', 'Wed', 'Fri'], 
        description: 'Selected days for WEEKLY plan (required for WEEKLY)',
        type: [String]
    })
    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    @ValidateIf((o) => o.planType === PlanType.WEEKLY)
    @IsNotEmpty()
    selectedDays?: string[];

    @ApiPropertyOptional({ example: 'alternate', description: 'Skip pattern for NTH_DAY plan (e.g. "alternate")' })
    @IsString()
    @IsOptional()
    skipPattern?: string;

    @ApiPropertyOptional({ example: 1, description: 'Quantity per delivery (default: 1)', default: 1 })
    @IsNumber()
    @IsOptional()
    @Min(1)
    quantity?: number;

    @ApiPropertyOptional({ example: 3, description: 'For NTH_DAY plan type - deliver every nth day' })
    @IsNumber()
    @IsOptional()
    @Min(1)
    nthDay?: number;
}

export class SubscriptionResDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    planType: string;

    @ApiProperty()
    startDate: Date;

    @ApiProperty({ required: false })
    endDate?: Date;

    @ApiProperty({ required: false, type: [String] })
    selectedDays?: string[];

    @ApiProperty({ required: false })
    skipPattern?: string;

    @ApiProperty()
    quantity: number;

    @ApiProperty()
    totalDeliveries: number;

    @ApiProperty()
    remainingDeliveries: number;

    @ApiProperty()
    nextDeliveryDate: Date;

    @ApiProperty()
    totalAmount: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    product: {
        id: string;
        name: string;
        price: number;
        description: string;
        images: string[];
    };
}
