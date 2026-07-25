import { Injectable } from '@nestjs/common';
import { SubscriptionInvoice } from '../../entities/subscription-invoice.entity';
import { PdfInvoiceRenderer } from './pdf-invoice.renderer';

@Injectable()
export class CustomerInvoiceTemplate {
  constructor(private readonly renderer: PdfInvoiceRenderer) {}

  render(invoice: SubscriptionInvoice): Promise<Buffer> {
    const item = invoice.lineItemsSnapshot[0];
    const days = item?.selectedDays?.length
      ? item.selectedDays.join(', ')
      : 'All scheduled days';
    const period = [
      this.renderer.formatDate(item?.startDate),
      this.renderer.formatDate(item?.endDate),
    ]
      .filter((v) => v !== '—')
      .join(' → ');

    const description =
      item?.description ||
      [
        item?.productName,
        item?.planType,
        days,
        period || null,
        item
          ? `${item.totalDeliveries} deliveries × qty ${item.quantity}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

    return this.renderer.render({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      status: invoice.status,
      currency: invoice.currency,
      amount: Number(invoice.amount),
      paymentLabel: invoice.paymentMethod,
      issuer: invoice.issuerSnapshot,
      billTo: invoice.billToSnapshot,
      columns: [
        { key: 'description', label: 'Description', width: 280 },
        { key: 'qty', label: 'Qty', width: 50, align: 'right' },
        { key: 'unit', label: 'Unit', width: 80, align: 'right' },
        { key: 'amount', label: 'Amount', width: 85, align: 'right' },
      ],
      rows: [
        {
          description,
          qty: String(item?.totalDeliveries ?? 1),
          unit: this.renderer.formatMoney(
            item?.unitPrice ?? 0,
            invoice.currency,
          ),
          amount: this.renderer.formatMoney(
            item?.amount ?? Number(invoice.amount),
            invoice.currency,
          ),
        },
      ],
      footerNote:
        'Thank you for subscribing. Keep this invoice for your records.',
    });
  }
}
