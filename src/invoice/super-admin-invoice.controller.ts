import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PlatformInvoiceService } from './platform-invoice.service';

@ApiTags('Super Admin | Billing Invoices')
@ApiBearerAuth()
@Controller('super-admin/tenants/:tenantId/billing/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminPlatformInvoiceController {
  constructor(private readonly invoiceService: PlatformInvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'List platform invoices for a tenant' })
  list(
    @Param('tenantId') tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.invoiceService.listForTenant(tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a platform invoice for a tenant' })
  getOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.invoiceService.getForTenant(tenantId, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download platform invoice PDF for a tenant' })
  async downloadPdf(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoiceService.getForTenant(tenantId, id);
    const pdf = await this.invoiceService.renderPdf(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    return new StreamableFile(pdf);
  }
}
