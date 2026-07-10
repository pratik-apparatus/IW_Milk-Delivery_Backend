import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class TestDbConnectionDto {
  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  dbHost?: string;

  @ApiPropertyOptional({ example: 5432 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dbPort?: number;

  @ApiProperty({ example: 'milk_milkco' })
  @IsString()
  @MinLength(1)
  dbName: string;

  @ApiPropertyOptional({ example: 'postgres' })
  @IsOptional()
  @IsString()
  dbUser?: string;

  @ApiPropertyOptional({ example: 'tenant_db_password' })
  @IsOptional()
  @IsString()
  dbPassword?: string;
}
