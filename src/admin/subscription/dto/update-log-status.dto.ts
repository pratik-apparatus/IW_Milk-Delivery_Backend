import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryStatus } from 'src/entities/subscription-delivery-log.entity';

export class UpdateSubscriptionLogStatusDto {
    @ApiProperty({
        enum: DeliveryStatus,
        description: 'New delivery status for the subscription log',
    })
    @IsEnum(DeliveryStatus)
    @IsNotEmpty()
    status: DeliveryStatus;

    @ApiPropertyOptional({ description: 'Optional notes or adjustment reason' })
    @IsOptional()
    @IsString()
    notes?: string;
}
