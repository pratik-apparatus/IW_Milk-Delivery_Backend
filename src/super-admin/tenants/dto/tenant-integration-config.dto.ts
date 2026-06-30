import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TenantRazorpayConfigDto {
  @ApiProperty({ example: 'rzp_live_xxx' })
  @IsString()
  @MinLength(8)
  keyId: string;

  @ApiProperty({ example: 'your_razorpay_key_secret' })
  @IsString()
  @MinLength(8)
  keySecret: string;

  @ApiPropertyOptional({ example: 'live', enum: ['live', 'test'] })
  @IsOptional()
  @IsIn(['live', 'test'])
  mode?: 'live' | 'test';
}

export class UpdateTenantRazorpayConfigDto {
  @ApiPropertyOptional({ example: 'rzp_live_xxx' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  keyId?: string;

  @ApiPropertyOptional({ example: 'your_razorpay_key_secret' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  keySecret?: string;

  @ApiPropertyOptional({ example: 'live', enum: ['live', 'test'] })
  @IsOptional()
  @IsIn(['live', 'test'])
  mode?: 'live' | 'test';
}

export class TenantIntegrationConfigDto {
  @ApiProperty({ type: TenantRazorpayConfigDto })
  @ValidateNested()
  @Type(() => TenantRazorpayConfigDto)
  razorpay: TenantRazorpayConfigDto;
}

export class UpdateTenantIntegrationConfigDto {
  @ApiPropertyOptional({ type: UpdateTenantRazorpayConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantRazorpayConfigDto)
  razorpay?: UpdateTenantRazorpayConfigDto;
}
