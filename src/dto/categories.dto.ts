import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Milk' })
    @MinLength(3)
    @MaxLength(60)
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: 'Fresh dair y products' })
    @IsOptional()
    @IsString()
    @MinLength(30)
    @MaxLength(60)
    description?: string;

    @ApiPropertyOptional({ example: '/uploads/categories/category-image.png' })
    @IsOptional()
    @IsString()
    image?: string;
}
