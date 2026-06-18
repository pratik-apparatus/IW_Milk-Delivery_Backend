import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AppConfigService } from '../../admin/app-config/app-config.service';

@ApiTags('Customer | App Config')
@Controller('customer/app-config')
export class CustomerAppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get tenant app styling config for the customer app (no auth required)',
  })
  @ApiResponse({ status: 200, description: 'App config retrieved successfully' })
  getAppConfig(@Req() req: Request & { tenantId: string }) {
    return this.appConfigService.getByTenantId(req.tenantId);
  }
}
