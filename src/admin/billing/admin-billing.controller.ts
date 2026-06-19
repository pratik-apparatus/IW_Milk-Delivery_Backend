import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminBillingProtected } from '../../auth/admin-protected.decorator';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { VerifyTenantBillingPaymentDto } from '../../super-admin/billing/dto/verify-tenant-billing-payment.dto';
import { TenantBillingPaymentService } from '../../super-admin/billing/tenant-billing-payment.service';
import { TenantSubscriptionService } from '../../super-admin/billing/tenant-subscription.service';

@ApiTags('Admin | Billing')
@AdminBillingProtected()
@Controller('admin/billing')
export class AdminBillingController {
  constructor(
    private readonly subscriptionService: TenantSubscriptionService,
    private readonly billingPayment: TenantBillingPaymentService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get current SaaS subscription status and assigned plan',
  })
  getStatus() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.subscriptionService.getAdminBillingStatus(tenantId);
  }

  @Post('create-order')
  @ApiOperation({ summary: 'Create Razorpay order for assigned plan payment' })
  createOrder() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.billingPayment.createOrderForTenant(tenantId);
  }

  @Post('verify-payment')
  @ApiOperation({ summary: 'Verify Razorpay payment and activate subscription' })
  verifyPayment(@Body() dto: VerifyTenantBillingPaymentDto) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.billingPayment.verifyPaymentForTenant(
      tenantId,
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
  }
}
