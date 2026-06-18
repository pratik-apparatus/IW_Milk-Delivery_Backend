import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantStatus } from '../../../entities/tenant.entity';

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: TenantStatus, example: TenantStatus.SUSPENDED })
  @IsEnum(TenantStatus)
  status: TenantStatus;

  @ApiProperty({
    required: false,
    example: 'Billing issue',
    description: 'Recommended when status is SUSPENDED',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

