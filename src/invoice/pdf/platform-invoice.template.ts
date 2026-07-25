import { Injectable } from '@nestjs/common';
import { PlatformInvoice } from '../../entities/platform-invoice.entity';
import { PdfInvoiceRenderer } from './pdf-invoice.renderer';

@Injectable()
export class PlatformInvoiceTemplate {
  constructor(private readonly renderer: PdfInvoiceRenderer) {}

  render(invoice: PlatformInvoice): Promise<Buffer> {
    const item = invoice.lineItemsSnapshot[0];
    const period = [
      this.renderer.formatDate(item?.periodStart),
      this.renderer.formatDate(item?.periodEnd),
    ]
      .filter((v) => v !== '—')
      .join(' → ');

    const description =
      item?.description ||
      [
        item?.planName,
        item ? `${item.durationDays} days` : null,
        period || null,
      ]
        .filter(Boolean)
        .join(' · ');

    const paymentParts = ['Razorpay'];
    if (invoice.razorpayPaymentId) {
      paymentParts.push(invoice.razorpayPaymentId);
    }

    return this.renderer.render({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      status: invoice.status,
      currency: invoice.currency,
      amount: Number(invoice.amount),
      paymentLabel:
        Number(invoice.amount) <= 0
          ? 'Complimentary'
          : paymentParts.join(' · '),
      issuer: invoice.issuerSnapshot,
      billTo: invoice.billToSnapshot,
      columns: [
        { key: 'description', label: 'Description', width: 320 },
        { key: 'period', label: 'Period', width: 90, align: 'right' },
        { key: 'amount', label: 'Amount', width: 85, align: 'right' },
      ],
      rows: [
        {
          description,
          period: item ? `${item.durationDays}d` : '—',
          amount: this.renderer.formatMoney(
            item?.amount ?? Number(invoice.amount),
            invoice.currency,
          ),
        },
      ],
      footerNote:
        'Thank you for choosing our platform. This invoice covers your SaaS subscription period.',
    });
  }
}
