import { IsString, IsNotEmpty, IsUrl, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBannerDto {
    @ApiProperty({ example: 'Summer Special Offer', description: 'Title of the banner' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ description: 'Banner Image File (JPG, PNG, WEBP)' })
    @IsOptional()
    imageUrl?: string;

    // To prevent forbidding 'image' property when sent by Swagger form-data
    @IsOptional()
    image?: any;

    @ApiPropertyOptional({ example: true, description: 'Whether the banner is currently active' })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateBannerDto {
    @ApiPropertyOptional({ example: 'Winter Special Offer', description: 'Title of the banner' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ description: 'Banner Image File (JPG, PNG, WEBP)' })
    @IsOptional()
    imageUrl?: string;

    // To prevent forbidding 'image' property when sent by Swagger form-data
    @IsOptional()
    image?: any;

    @ApiPropertyOptional({ example: false, description: 'Whether the banner is currently active' })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    isActive?: boolean;
}
