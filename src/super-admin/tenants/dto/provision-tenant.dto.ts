import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ProvisionTenantDto {
  @ApiPropertyOptional({
    description:
      'Drop the existing tenant database and reprovision from scratch. Use only when intentionally clearing all tenant data.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceReset?: boolean;
}
