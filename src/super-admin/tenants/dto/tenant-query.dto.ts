import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TenantStatus } from '../../../entities/tenant.entity';

export class TenantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TenantStatus,
    description: 'Filter by tenant status',
  })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
