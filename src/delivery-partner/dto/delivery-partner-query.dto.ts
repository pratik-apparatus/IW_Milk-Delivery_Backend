import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class DeliveryPartnerQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Optional date filter (YYYY-MM-DD)', example: '2026-02-26' })
    @IsOptional()
    @IsString()
    date?: string;
}
