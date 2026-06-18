import { IsOptional, IsBooleanString, IsNumberString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryQueryArgs {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBooleanString()
    isActive?: string; // true | false

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumberString()
    page?: string; // default 1

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumberString()
    limit?: string; // default 10
}
