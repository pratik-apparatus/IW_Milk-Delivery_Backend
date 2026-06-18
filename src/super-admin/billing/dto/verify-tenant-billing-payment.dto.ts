import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyTenantBillingPaymentDto {
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
