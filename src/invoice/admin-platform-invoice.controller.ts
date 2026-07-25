import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminBillingProtected } from '../auth/admin-protected.decorator';
import { TenantContextService } from '../common/services/tenant-context.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PlatformInvoiceService } from './platform-invoice.service';

@ApiTags('Admin | Billing Invoices')
@AdminBillingProtected()
@Controller('admin/billing/invoices')
export class AdminPlatformInvoiceController {
  constructor(
    private readonly invoiceService: PlatformInvoiceService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List platform SaaS invoices for this tenant' })
  list(@Query() query: PaginationQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.invoiceService.listForTenant(tenantId, query);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get the latest platform invoice for this tenant' })
  latest() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.invoiceService.getLatestForTenant(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a platform invoice by id' })
  getOne(@Param('id') id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.invoiceService.getForTenant(tenantId, id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download platform SaaS invoice PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = this.tenantContext.requireTenantId();
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
