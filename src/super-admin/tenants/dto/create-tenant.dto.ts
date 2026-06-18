import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional({
    example: ['CUSTOMER_APP', 'DELIVERY_APP', 'ADMIN_APP'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledApps?: string[];

  @ApiPropertyOptional({
    example: { deliverySlots: ['MORNING', 'EVENING'] },
  })
  @IsOptional()
  @IsObject()
  appSettings?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { razorpayKeyId: 'rzp_live_xxx', smsProvider: 'msg91' },
  })
  @IsOptional()
  @IsObject()
  integrationConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  dbHost?: string;

  @ApiPropertyOptional({ example: 5432 })
  @IsOptional()
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

