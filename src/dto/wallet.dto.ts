import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMoneyDto {
    @ApiProperty({ example: 500, description: 'Amount to add in rupees' })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    amount: number;
}

export class WalletBalanceResDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    walletId: string;

    @ApiProperty({ example: 1500.00 })
    balance: number;
}

export class WalletTransactionResDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;

    @ApiProperty({ example: 500.00 })
    amount: number;

    @ApiProperty({ example: 'CREDIT', enum: ['CREDIT', 'DEBIT'] })
    type: string;

    @ApiProperty({ example: 'rzp_123456789' })
    referenceId: string;

    @ApiProperty({ example: 'Added money via Razorpay' })
    description: string;

    @ApiProperty({ example: '2026-01-09T10:00:00Z' })
    createdAt: Date;
}
