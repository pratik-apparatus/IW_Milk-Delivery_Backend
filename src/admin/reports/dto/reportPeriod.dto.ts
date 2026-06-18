// dto/period-report.query.dto.ts
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseReportQueryDto } from './base-report.query.dto';

export enum ReportPeriod {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
}

export class PeriodReportQueryDto extends BaseReportQueryDto {
    @ApiPropertyOptional({
        description: 'Time period for grouping data',
        enum: ReportPeriod,
        default: ReportPeriod.DAILY
    })
    @IsOptional()
    @IsEnum(ReportPeriod)
    period?: ReportPeriod = ReportPeriod.DAILY;
}