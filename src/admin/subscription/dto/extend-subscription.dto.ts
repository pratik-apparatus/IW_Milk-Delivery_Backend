import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendSubscriptionDto {
    @ApiProperty({
        description: 'The date that was missed (YYYY-MM-DD)',
        example: '2026-02-28'
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'missedDate must be in YYYY-MM-DD format' })
    missedDate: string;
}
