import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateManagedDatabaseDto {
  @ApiPropertyOptional({ example: 'Milk Co staging DB' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  dbHost?: string;

  @ApiPropertyOptional({ example: 5432 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dbPort?: number;

  @ApiProperty({ example: 'milk_pool_001' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  dbName: string;

  @ApiPropertyOptional({ example: 'postgres' })
  @IsOptional()
  @IsString()
  dbUser?: string;

  @ApiPropertyOptional({ example: 'postgres_password' })
  @IsOptional()
  @IsString()
  dbPassword?: string;
}
