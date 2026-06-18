import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateDeliveryPartnerDto {
    @ApiProperty({ example: 'Ramesh Kumar' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'ramesh@123' })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({ example: 'ramesh@123' })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({ example: 'ramesh@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;


    @ApiProperty({ example: 'Near MG Road, Pune', required: false })
    @IsOptional()
    @IsString()
    address?: string;
}
