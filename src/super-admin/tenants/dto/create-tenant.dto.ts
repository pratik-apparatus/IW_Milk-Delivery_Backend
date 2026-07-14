import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OPTIONAL_TENANT_APPS } from '../../../common/constants/tenant-apps.constants';
import { TenantIntegrationConfigDto } from './tenant-integration-config.dto';

export class CreateTenantDto {
  @ApiProperty({ example: 'Milk Co' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  businessName: string;

  @ApiProperty({ example: 'milkco' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ example: 'owner@milkco.com' })
  @IsEmail()
  adminEmail: string;

  @ApiPropertyOptional({ example: 'support@milkco.com' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({ example: '+91XXXXXXXXXX' })
  @IsOptional()
  @IsString()
  supportPhone?: string;

  @ApiProperty({
    example: 'Kharadi, Pune, Maharashtra',
    description: 'Business / depot address',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  adminAddress: string;

  @ApiPropertyOptional({
    example: 18.5515,
    description:
      'Depot latitude. Required when DELIVERY_APP is enabled; set via map in the superadmin panel.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  adminLatitude?: number;

  @ApiPropertyOptional({
    example: 73.9234,
    description:
      'Depot longitude. Required when DELIVERY_APP is enabled; set via map in the superadmin panel.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  adminLongitude?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Delivery radius in km from depot. Required when DELIVERY_APP is enabled.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  deliveryRadiusKm?: number;

  @ApiPropertyOptional({
    example: ['DELIVERY_APP', 'SUBSCRIPTIONS_MODULE'],
    description:
      'Optional modules. CUSTOMER_APP and ADMIN_APP are always enabled by default.',
    enum: OPTIONAL_TENANT_APPS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn([...OPTIONAL_TENANT_APPS], { each: true })
  enabledApps?: string[];

  @ApiPropertyOptional({
    example: { deliverySlots: ['MORNING', 'EVENING'] },
  })
  @IsOptional()
  @IsObject()
  appSettings?: Record<string, unknown>;

  @ApiProperty({
    example: {
      razorpay: {
        keyId: 'rzp_live_xxx',
        keySecret: 'your_razorpay_key_secret',
        mode: 'live',
      },
    },
  })
  @ValidateNested()
  @Type(() => TenantIntegrationConfigDto)
  integrationConfig: TenantIntegrationConfigDto;

  @ApiPropertyOptional({
    description:
      'Select a pre-created database from the pool (POST /super-admin/databases). Do not combine with inline dbHost/dbName fields.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  databaseId?: string;

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
