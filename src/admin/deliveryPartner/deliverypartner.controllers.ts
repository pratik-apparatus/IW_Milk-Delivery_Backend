import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminDeliveryPartnerService } from './deliveryPartner.services';
import { CreateDeliveryPartnerDto } from '../../dto/deliverypartner.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AdminProtected } from '../../auth/admin-protected.decorator';

@ApiTags('Admin | Delivery Partners')
@AdminProtected()
@Controller('admin/delivery-partners')
export class AdminDeliveryPartnerController {
  constructor(
    private readonly adminDeliveryPartnerService: AdminDeliveryPartnerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Delivery Partner (Admin)' })
  async createDeliveryPartner(@Body() dto: CreateDeliveryPartnerDto) {
    return this.adminDeliveryPartnerService.createDeliveryPartner(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all Delivery Partners (excludes banned)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.adminDeliveryPartnerService.findAll(query);
  }

  @Get('banned')
  @ApiOperation({ summary: 'Get all banned Delivery Partners' })
  getBanned(@Query() query: PaginationQueryDto) {
    return this.adminDeliveryPartnerService.getBannedDeliveryPartners(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Delivery Partner by ID' })
  findById(@Param('id') id: string) {
    return this.adminDeliveryPartnerService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Delivery Partner' })
  update(@Param('id') id: string, @Body() dto: CreateDeliveryPartnerDto) {
    return this.adminDeliveryPartnerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Ban Delivery Partner and all related data' })
  ban(@Param('id') id: string) {
    return this.adminDeliveryPartnerService.banDeliveryPartner(id);
  }

  @Put(':id/restore')
  @ApiOperation({
    summary: 'Restore banned Delivery Partner and all related data',
  })
  restore(@Param('id') id: string) {
    return this.adminDeliveryPartnerService.restoreDeliveryPartner(id);
  }
}
