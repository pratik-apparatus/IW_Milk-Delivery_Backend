import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRazorpayOrderDto {
    @ApiProperty({ example: 500, description: 'Amount in rupees' })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    amount: number;
}

export class CreateRazorpayOrderResDto {
    @ApiProperty({ example: 'order_123456789' })
    orderId: string;

    @ApiProperty({ example: 50000, description: 'Amount in paise' })
    amount: number;

    @ApiProperty({ example: 'INR' })
    currency: string;
}

export class VerifyRazorpayPaymentDto {
    @ApiProperty({ example: 'order_123456789' })
    @IsString()
    @IsNotEmpty()
    razorpay_order_id: string;

    @ApiProperty({ example: 'pay_123456789' })
    @IsString()
    @IsNotEmpty()
    razorpay_payment_id: string;

    @ApiProperty({ example: 'signature_string' })
    @IsString()
    @IsNotEmpty()
    razorpay_signature: string;
}

export class VerifyPaymentResDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Payment verified and wallet credited' })
    message: string;

    @ApiProperty({ example: 1500.00 })
    newBalance: number;
}
