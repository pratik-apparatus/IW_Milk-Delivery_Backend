import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import type { Response } from 'express';
import { AdminProtected } from '../auth/admin-protected.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CustomerInvoiceService } from './customer-invoice.service';

class AdminCustomerInvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

@ApiTags('Admin | Customer Invoices')
@AdminProtected()
@Controller('admin/invoices')
export class AdminCustomerInvoiceController {
  constructor(private readonly invoiceService: CustomerInvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'List customer milk subscription invoices' })
  list(@Query() query: AdminCustomerInvoiceQueryDto) {
    return this.invoiceService.listForAdmin(query);
  }

  @Get('by-subscription/:subscriptionId')
  @ApiOperation({ summary: 'Get invoice for a customer subscription' })
  getBySubscription(@Param('subscriptionId') subscriptionId: string) {
    return this.invoiceService.getBySubscriptionForAdmin(subscriptionId);
  }

  @Get('by-subscription/:subscriptionId/pdf')
  @ApiOperation({ summary: 'Download PDF for a customer subscription invoice' })
  async downloadBySubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice =
      await this.invoiceService.getBySubscriptionForAdmin(subscriptionId);
    const pdf = await this.invoiceService.renderPdf(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    return new StreamableFile(pdf);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer invoice by id' })
  getOne(@Param('id') id: string) {
    return this.invoiceService.getByIdForAdmin(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download customer invoice PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoiceService.getByIdForAdmin(id);
    const pdf = await this.invoiceService.renderPdf(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    return new StreamableFile(pdf);
  }
}
