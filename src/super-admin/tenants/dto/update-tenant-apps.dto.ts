import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTenantAppsDto {
  @ApiProperty({
    example: ['CUSTOMER_APP', 'DELIVERY_APP'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  enabledApps: string[];

  @ApiProperty({
    required: false,
    example: {
      CUSTOMER_APP: { theme: 'light' },
      DELIVERY_APP: { liveTracking: true },
    },
  })
  @IsOptional()
  @IsObject()
  appSettings?: Record<string, unknown>;
}

