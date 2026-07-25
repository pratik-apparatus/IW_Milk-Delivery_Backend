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
import { CustomerProtected } from '../auth/customer-protected.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CustomerInvoiceService } from './customer-invoice.service';

@ApiTags('Customer | Invoices')
@CustomerProtected()
@Controller()
export class CustomerInvoiceController {
  constructor(private readonly invoiceService: CustomerInvoiceService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List my subscription invoices' })
  listMyInvoices(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    return this.invoiceService.listForCustomer(user.id, query);
  }

  @Get('subscriptions/:id/invoice')
  @ApiOperation({ summary: 'Get invoice metadata for a subscription' })
  getSubscriptionInvoice(
    @CurrentUser() user: { id: string },
    @Param('id') subscriptionId: string,
  ) {
    return this.invoiceService.getBySubscriptionForCustomer(
      subscriptionId,
      user.id,
    );
  }

  @Get('subscriptions/:id/invoice/pdf')
  @ApiOperation({ summary: 'Download PDF invoice for a subscription' })
  async downloadSubscriptionInvoicePdf(
    @CurrentUser() user: { id: string },
    @Param('id') subscriptionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoiceService.getBySubscriptionForCustomer(
      subscriptionId,
      user.id,
    );
    const pdf = await this.invoiceService.renderPdf(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
    });
    return new StreamableFile(pdf);
  }
}
