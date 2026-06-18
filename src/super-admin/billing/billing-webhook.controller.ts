import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantBillingPaymentService } from './tenant-billing-payment.service';

@ApiTags('Super Admin | Billing Webhook')
@Controller('super-admin/billing')
export class BillingWebhookController {
  constructor(private readonly billingPayment: TenantBillingPaymentService) {}

  @Post('razorpay-webhook')
  @ApiOperation({ summary: 'Razorpay webhook for tenant SaaS payments' })
  handleWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.billingPayment.handleWebhook(payload, signature || '');
  }
}
