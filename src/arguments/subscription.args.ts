import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsEnum, IsOptional, IsUUID } from "class-validator";

import { SubscriptionStatus } from "src/entities/subscription.entity";
import { PlanType } from "src/entities/subscription.entity";

export class subscriptionArgs{
    @ApiPropertyOptional({ description: 'Filter by customer id' })
    @IsOptional()
    @IsUUID()
    customerId?: string;

    @ApiPropertyOptional({ description: 'Filter by product id' })
    @IsOptional()
    @IsUUID()
    productId?: string;

    @ApiPropertyOptional({ description: 'Filter by plan type' })
    @IsOptional()
    @IsEnum(PlanType)
    planType?: PlanType;

    @ApiPropertyOptional({ description: 'Filter by status' })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;

    @ApiPropertyOptional({ description: 'Filter by start date' })
    @IsOptional()
    @IsDate()
    startDate?: Date;

  
}