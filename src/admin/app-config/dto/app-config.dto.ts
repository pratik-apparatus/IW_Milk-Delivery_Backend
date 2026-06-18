import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppStyleVariables } from '../../../entities/app-config.entity';

class HeadingsDto {
  @ApiPropertyOptional({ example: '#1a1a1a' })
  @IsOptional()
  @IsString()
  h1?: string;

  @ApiPropertyOptional({ example: '#2d2d2d' })
  @IsOptional()
  @IsString()
  h2?: string;

  @ApiPropertyOptional({ example: '#404040' })
  @IsOptional()
  @IsString()
  h3?: string;
}

class TextDto {
  @ApiPropertyOptional({ example: '#333333' })
  @IsOptional()
  @IsString()
  p1?: string;

  @ApiPropertyOptional({ example: '#666666' })
  @IsOptional()
  @IsString()
  p2?: string;
}

class BordersDto {
  @ApiPropertyOptional({ example: '#e0e0e0' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '1px' })
  @IsOptional()
  @IsString()
  width?: string;
}

class ButtonStyleDto {
  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  borderColor?: string;
}

export class AppStyleVariablesDto implements AppStyleVariables {
  @ApiPropertyOptional({ type: HeadingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HeadingsDto)
  headings?: HeadingsDto;

  @ApiPropertyOptional({ type: TextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TextDto)
  text?: TextDto;

  @ApiPropertyOptional({ example: '#f8fafc' })
  @IsOptional()
  @IsString()
  bgColor?: string;

  @ApiPropertyOptional({ type: BordersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BordersDto)
  borders?: BordersDto;

  @ApiPropertyOptional({ example: '8px' })
  @IsOptional()
  @IsString()
  borderRadius?: string;

  @ApiPropertyOptional({ type: ButtonStyleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ButtonStyleDto)
  buttonPrimary?: ButtonStyleDto;

  @ApiPropertyOptional({ type: ButtonStyleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ButtonStyleDto)
  buttonSecondary?: ButtonStyleDto;
}

export class CreateAppConfigDto {
  @ApiPropertyOptional({ example: 'light' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  theme?: string;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#64748b' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondaryColor?: string;

  @ApiPropertyOptional({ type: AppStyleVariablesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AppStyleVariablesDto)
  styleVariables?: AppStyleVariablesDto;

  @ApiPropertyOptional({ example: "'Inter', sans-serif" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fontFamily?: string;
}

export class UpdateAppConfigDto extends CreateAppConfigDto {}
