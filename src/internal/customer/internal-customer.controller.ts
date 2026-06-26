import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InternalCustomerService } from './internal-customer.service';
import { FindOrCreateCustomerDto } from '../../dto/customer-create.dto';
import { InternalServiceGuard } from '../../auth/internal-service.guard';

@Controller('internal/customer')
@UseGuards(InternalServiceGuard)
export class InternalCustomerController {
  constructor(
    private readonly internalCustomerService: InternalCustomerService,
  ) {}

  @Post('find-or-create')
  async findOrCreate(
    @Body() dto: FindOrCreateCustomerDto,
    @Req() req: Request,
  ) {
    const tenantIdHeader = req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdHeader === 'string' ? tenantIdHeader.trim() : null;
    return this.internalCustomerService.findOrCreate(dto.phone, tenantId);
  }

  @Post('get-auth-data')
  async getAuthData(@Body() dto: { phone: string }) {
    return this.internalCustomerService.getAuthData(dto.phone);
  }
}
