import { IsOptional, IsString, IsEmail, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminProfileDto {
    @ApiPropertyOptional({ description: 'Admin username' })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiPropertyOptional({ description: 'Admin email address' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'Admin phone number' })
    @IsOptional()
    @IsString()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
    phone?: string;

    @ApiPropertyOptional({ description: 'Admin shop address' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ description: 'New password (min 6 characters)' })
    @IsOptional()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password?: string;

    @ApiPropertyOptional({ description: 'Admin map latitude' })
    @IsOptional()
    latitude?: number;

    @ApiPropertyOptional({ description: 'Admin map longitude' })
    @IsOptional()
    longitude?: number;
}

