import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString, MaxLength, MinLength, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerProfileDto {
    @ApiProperty({ example: 'John Doe', description: 'Customer name' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: 'john@example.com', description: 'Customer email' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: '+919876543210', description: 'Customer phone number' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'A-101', description: 'House number' })
    @IsString()
    @IsNotEmpty()
    houseNo: string;

    @ApiProperty({ example: 'Near Park', description: 'Landmark' })
    @IsString()
    @IsNotEmpty()
    landmark: string;

    @ApiProperty({ example: 'Kothrud', description: 'Area in India' })
    @IsString()
    @IsNotEmpty()
    area: string;

    @ApiProperty({ example: 18.5204, description: 'Latitude coordinate', required: false })
    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @ApiProperty({ example: 73.8567, description: 'Longitude coordinate', required: false })
    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    longitude?: number;
}

export class UpdateCustomerProfileDto {
    @ApiProperty({ example: 'John Doe', description: 'Customer name', required: false })
    @IsString()
    @IsOptional()
    @MinLength(2)
    @MaxLength(100)
    name?: string;

    @ApiProperty({ example: 'john@example.com', description: 'Customer email', required: false })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ example: '+919876543210', description: 'Customer phone number', required: false })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiProperty({ example: 'A-101', description: 'House number', required: false })
    @IsString()
    @IsOptional()
    houseNo?: string;

    @ApiProperty({ example: 'Near Park', description: 'Landmark', required: false })
    @IsString()
    @IsOptional()
    landmark?: string;

    @ApiProperty({ example: 'Kothrud', description: 'Area in India', required: false })
    @IsString()
    @IsOptional()
    area?: string;

    @ApiProperty({ example: 18.5204, description: 'Latitude coordinate', required: false })
    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @ApiProperty({ example: 73.8567, description: 'Longitude coordinate', required: false })
    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    longitude?: number;
}
