import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { PlatformInvoice } from '../entities/platform-invoice.entity';
import { PdfInvoiceRenderer } from './pdf/pdf-invoice.renderer';
import { CustomerInvoiceTemplate } from './pdf/customer-invoice.template';
import { PlatformInvoiceTemplate } from './pdf/platform-invoice.template';
import { CustomerInvoiceService } from './customer-invoice.service';
import { PlatformInvoiceService } from './platform-invoice.service';
import { CustomerInvoiceController } from './customer-invoice.controller';
import { AdminCustomerInvoiceController } from './admin-customer-invoice.controller';
import { AdminPlatformInvoiceController } from './admin-platform-invoice.controller';
import { SuperAdminPlatformInvoiceController } from './super-admin-invoice.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, PlatformInvoice])],
  controllers: [
    CustomerInvoiceController,
    AdminCustomerInvoiceController,
    AdminPlatformInvoiceController,
    SuperAdminPlatformInvoiceController,
  ],
  providers: [
    PdfInvoiceRenderer,
    CustomerInvoiceTemplate,
    PlatformInvoiceTemplate,
    CustomerInvoiceService,
    PlatformInvoiceService,
  ],
  exports: [CustomerInvoiceService, PlatformInvoiceService],
})
export class InvoiceModule {}
