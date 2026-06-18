import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, IsOptional, Min,Max, IsArray, MinLength, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({example:"usha milk" })
  @MinLength(3)
  @MaxLength(60)
  @IsString() 
  name: string;

@ApiPropertyOptional({example: ["milk1.png", "milk2.png"]})
@IsOptional()
@IsArray()
@IsString({ each: true })
images?: string[];


  @ApiProperty({example:100})
  @Transform(({ value }) => {
    if (typeof value === 'string' && value !== '') {
      return parseFloat(value);
    }
    return value;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(9999)
  price: number;


  @ApiProperty({example:"full fat milk"})
  @IsString()
  @MinLength(30)
  @MaxLength(60)
  description: string;

  

  @ApiProperty({example:10})
  @Transform(({ value }) => {
    if (typeof value === 'string' && value !== '') {
      return parseInt(value, 10);
    }
    return value;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(9999)
  quantity: number;
}
