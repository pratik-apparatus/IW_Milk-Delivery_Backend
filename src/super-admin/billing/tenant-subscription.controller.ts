import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AssignTenantPlanDto } from './dto/assign-tenant-plan.dto';
import { TenantSubscriptionService } from './tenant-subscription.service';

@ApiTags('Super Admin | Billing')
@ApiBearerAuth()
@Controller('super-admin/tenants/:tenantId/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class TenantSubscriptionController {
  constructor(
    private readonly subscriptionService: TenantSubscriptionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get tenant billing overview (available plans + current subscription)',
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

  @Patch('plan')
  @ApiOperation({ summary: 'Update the billing plan for this tenant' })
  updatePlan(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignTenantPlanDto,
  ) {
    return this.subscriptionService.updatePlan(tenantId, dto.planId);
  }

  @Post('detach')
  @ApiOperation({
    summary:
      'Detach billing plan from tenant (cancels active subscription if needed)',
  })
  detachPlan(@Param('tenantId') tenantId: string) {
    return this.subscriptionService.detachPlan(tenantId);
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
