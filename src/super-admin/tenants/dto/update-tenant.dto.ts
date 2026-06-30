import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OPTIONAL_TENANT_APPS } from '../../../common/constants/tenant-apps.constants';
import {
  TenantIntegrationConfigDto,
  UpdateTenantIntegrationConfigDto,
} from './tenant-integration-config.dto';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Milk Co Updated' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({ example: 'milkco-new' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/new-logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'owner@milkco.com' })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({ example: 'support@milkco.com' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({ example: '+91XXXXXXXXXX' })
  @IsOptional()
  @IsString()
  supportPhone?: string;

  @ApiPropertyOptional({ example: 'Kharadi, Pune, Maharashtra' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  adminAddress?: string;

  @ApiPropertyOptional({ example: 18.5515 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  adminLatitude?: number;

  @ApiPropertyOptional({ example: 73.9234 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  adminLongitude?: number;

  @ApiPropertyOptional({ example: 5, description: 'Delivery radius in km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  deliveryRadiusKm?: number;

  @ApiPropertyOptional({
    example: ['DELIVERY_APP', 'SUBSCRIPTIONS_MODULE'],
    enum: OPTIONAL_TENANT_APPS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn([...OPTIONAL_TENANT_APPS], { each: true })
  enabledApps?: string[];

  @ApiPropertyOptional({ example: { deliverySlots: ['MORNING'] } })
  @IsOptional()
  @IsObject()
  appSettings?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      razorpay: {
        keyId: 'rzp_live_xxx',
        keySecret: 'your_razorpay_key_secret',
        mode: 'live',
      },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantIntegrationConfigDto)
  integrationConfig?: UpdateTenantIntegrationConfigDto;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  dbHost?: string;

  @ApiPropertyOptional({ example: 5432 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dbPort?: number;

  @ApiPropertyOptional({ example: 'milk_tenant_001' })
  @IsOptional()
  @IsString()
  dbName?: string;

  @ApiPropertyOptional({ example: 'postgres' })
  @IsOptional()
  @IsString()
  dbUser?: string;

  @ApiPropertyOptional({ example: 'tenant_db_password' })
  @IsOptional()
  @IsString()
  dbPassword?: string;
}
