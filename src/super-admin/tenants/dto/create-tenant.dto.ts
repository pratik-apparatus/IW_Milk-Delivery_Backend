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
    description: 'Business / depot address used as delivery zone center',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  adminAddress: string;

  @ApiProperty({ example: 18.5515, description: 'Admin depot latitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  adminLatitude: number;

  @ApiProperty({ example: 73.9234, description: 'Admin depot longitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  adminLongitude: number;

  @ApiProperty({
    example: 5,
    description: 'Delivery radius in km from admin location',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  deliveryRadiusKm: number;

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
