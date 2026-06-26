import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BannerService } from '../../admin/banner/banner.service';
import { TenantScoped } from '../../auth/tenant-scoped.decorator';

@ApiTags('Customer | Banners')
@TenantScoped()
@Controller('customer/banners')
export class CustomerBannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active banners for the customer app' })
  @ApiResponse({ status: 200, description: 'List of active banners' })
  getActiveBanners() {
    return this.bannerService.getActiveBanners();
  }
}
