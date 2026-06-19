import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTenantPlanDto {
  @ApiProperty({ example: 'Starter' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'For small milk businesses' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 999, description: 'Monthly charge in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Subscription validity in days after payment',
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;
}
