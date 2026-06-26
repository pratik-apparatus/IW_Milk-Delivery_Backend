import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class BaseReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for filtering report (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering report (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
