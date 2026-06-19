import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional } from 'class-validator';
import { OPTIONAL_TENANT_APPS } from '../../../common/constants/tenant-apps.constants';

export class UpdateTenantAppsDto {
  @ApiProperty({
    example: ['DELIVERY_APP', 'SUBSCRIPTIONS_MODULE'],
    description:
      'Optional modules to enable. CUSTOMER_APP and ADMIN_APP remain enabled.',
    enum: OPTIONAL_TENANT_APPS,
    isArray: true,
  })
  @IsArray()
  @IsIn([...OPTIONAL_TENANT_APPS], { each: true })
  enabledApps: string[];

  @ApiPropertyOptional({
    example: { deliverySlots: ['MORNING', 'EVENING'] },
  })
  @IsOptional()
  @IsObject()
  appSettings?: Record<string, unknown>;
}
