import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ManagedDatabaseStatus } from '../../../entities/managed-database.entity';

export class ManagedDatabaseQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ManagedDatabaseStatus, example: 'AVAILABLE' })
  @IsOptional()
  @IsEnum(ManagedDatabaseStatus)
  status?: ManagedDatabaseStatus;

  @ApiPropertyOptional({ example: 'milk_pool' })
  @IsOptional()
  @IsString()
  search?: string;
}
