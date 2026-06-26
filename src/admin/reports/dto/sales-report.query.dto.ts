// dto/sales-report.query.dto.ts
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseReportQueryDto } from './base-report.query.dto';

export enum SalesPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class SalesReportQueryDto extends BaseReportQueryDto {
  @ApiPropertyOptional({
    description: 'Time period for grouping sales data',
    enum: SalesPeriod,
    default: SalesPeriod.DAILY,
  })
  @IsOptional()
  @IsEnum(SalesPeriod)
  period?: SalesPeriod = SalesPeriod.DAILY;
}
