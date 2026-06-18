import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AssignTenantPlanDto } from './dto/assign-tenant-plan.dto';
import { VerifyTenantBillingPaymentDto } from './dto/verify-tenant-billing-payment.dto';
import { TenantBillingPaymentService } from './tenant-billing-payment.service';
import { TenantSubscriptionService } from './tenant-subscription.service';

@ApiTags('Super Admin | Billing')
@ApiBearerAuth()
@Controller('super-admin/tenants/:tenantId/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantSubscriptionController {
  constructor(
    private readonly subscriptionService: TenantSubscriptionService,
    private readonly billingPayment: TenantBillingPaymentService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get tenant billing overview (available plans + current subscription)',
  })
  getStatus(@Param('tenantId') tenantId: string) {
    return this.subscriptionService.getStatus(tenantId);
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign a billing plan to this tenant' })
  assignPlan(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignTenantPlanDto,
  ) {
    return this.subscriptionService.assignPlan(tenantId, dto.planId);
  }

  @Post('create-order')
  @ApiOperation({ summary: 'Create Razorpay order for tenant plan payment' })
  createOrder(@Param('tenantId') tenantId: string) {
    return this.billingPayment.createOrder(tenantId);
  }

  @Post('verify-payment')
  @ApiOperation({ summary: 'Verify Razorpay payment and activate subscription' })
  verifyPayment(
    @Param('tenantId') tenantId: string,
    @Body() dto: VerifyTenantBillingPaymentDto,
  ) {
    return this.billingPayment.verifyPayment(
      tenantId,
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
  }

  @Patch('cancel')
  @ApiOperation({ summary: 'Cancel tenant subscription' })
  cancel(@Param('tenantId') tenantId: string) {
    return this.subscriptionService.cancel(tenantId);
  }

  @Delete()
  @ApiOperation({
    summary: 'Remove ended subscription (expired, cancelled, or unpaid only)',
  })
  remove(@Param('tenantId') tenantId: string) {
    return this.subscriptionService.removeEnded(tenantId);
  }
}
