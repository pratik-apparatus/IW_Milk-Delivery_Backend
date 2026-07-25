import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {
  InvoiceBillToSnapshot,
  InvoiceIssuerSnapshot,
} from '../../entities/subscription-invoice.entity';

// pdfkit is CJS; default import can break under Nest/NodeNext and corrupt PDFs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface InvoiceTableColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
}

export interface InvoiceRenderInput {
  invoiceNumber: string;
  issuedAt: Date;
  status: string;
  currency: string;
  amount: number;
  paymentLabel: string;
  issuer: InvoiceIssuerSnapshot;
  billTo: InvoiceBillToSnapshot;
  columns: InvoiceTableColumn[];
  rows: Record<string, string>[];
  footerNote?: string;
}

@Injectable()
export class PdfInvoiceRenderer {
  private readonly logger = new Logger(PdfInvoiceRenderer.name);

  async render(input: InvoiceRenderInput): Promise<Buffer> {
    const logoBuffer = await this.loadLogo(input.issuer.logoUrl);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice ${input.invoiceNumber}`,
          Author: input.issuer.businessName,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const left = 50;
      const right = pageWidth - 50;
      let y = 50;

      // Header: logo + issuer
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, left, y, { fit: [72, 48] });
        } catch (err) {
          this.logger.warn(`Failed to embed logo: ${String(err)}`);
        }
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#111827')
        .text(input.issuer.businessName, left + (logoBuffer ? 84 : 0), y, {
          width: 260,
        });

      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#111827')
        .text('INVOICE', left, y, { align: 'right', width: right - left });

      y += 28;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6B7280')
        .text(`Invoice ${input.invoiceNumber}`, left, y, {
          align: 'right',
          width: right - left,
        });
      y += 14;
      doc.text(`Date ${this.formatDate(input.issuedAt)}`, left, y, {
        align: 'right',
        width: right - left,
      });
      y += 14;
      doc.fillColor('#059669').text(input.status.toUpperCase(), left, y, {
        align: 'right',
        width: right - left,
      });

      y += 28;
      doc
        .moveTo(left, y)
        .lineTo(right, y)
        .strokeColor('#E5E7EB')
        .lineWidth(1)
        .stroke();

      y += 24;

      // Bill to / From
      const colWidth = (right - left - 24) / 2;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#9CA3AF')
        .text('BILL TO', left, y);
      doc.text('FROM', left + colWidth + 24, y);

      y += 14;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111827')
        .text(input.billTo.name, left, y, { width: colWidth });
      doc.text(input.issuer.businessName, left + colWidth + 24, y, {
        width: colWidth,
      });

      y += 16;
      doc.font('Helvetica').fontSize(9).fillColor('#4B5563');

      const billLines = [
        input.billTo.email,
        input.billTo.phone,
        input.billTo.address,
      ].filter(Boolean) as string[];
      const fromLines = [
        input.issuer.supportEmail,
        input.issuer.supportPhone,
      ].filter(Boolean) as string[];

      const billBlock = billLines.join('\n') || '—';
      const fromBlock = fromLines.join('\n') || '—';
      const billHeight = doc.heightOfString(billBlock, { width: colWidth });
      const fromHeight = doc.heightOfString(fromBlock, { width: colWidth });

      doc.text(billBlock, left, y, { width: colWidth });
      doc.text(fromBlock, left + colWidth + 24, y, { width: colWidth });
      y += Math.max(billHeight, fromHeight) + 28;

      // Table header
      doc.rect(left, y, right - left, 24).fill('#F9FAFB');

      let x = left + 10;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#6B7280');
      for (const col of input.columns) {
        doc.text(col.label.toUpperCase(), x, y + 8, {
          width: col.width - 8,
          align: col.align ?? 'left',
        });
        x += col.width;
      }
      y += 28;

      // Rows
      doc.font('Helvetica').fontSize(9).fillColor('#111827');
      for (const row of input.rows) {
        const rowTop = y;
        let maxH = 14;
        x = left + 10;
        for (const col of input.columns) {
          const text = row[col.key] ?? '';
          const h = doc.heightOfString(text, { width: col.width - 8 });
          maxH = Math.max(maxH, h);
          doc.text(text, x, rowTop, {
            width: col.width - 8,
            align: col.align ?? 'left',
          });
          x += col.width;
        }
        y += maxH + 12;
        doc
          .moveTo(left, y - 4)
          .lineTo(right, y - 4)
          .strokeColor('#F3F4F6')
          .lineWidth(0.5)
          .stroke();
      }

      y += 16;

      // Totals
      const totalsX = right - 200;
      const labelX = totalsX;
      const valueX = right - 90;

      const addTotalRow = (
        label: string,
        value: string,
        bold = false,
        color = '#111827',
      ) => {
        doc
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 11 : 9)
          .fillColor(bold ? color : '#6B7280')
          .text(label, labelX, y, { width: 100 });
        doc
          .fillColor(color)
          .text(value, valueX, y, { width: 90, align: 'right' });
        y += bold ? 20 : 16;
      };

      addTotalRow('Subtotal', this.formatMoney(input.amount, input.currency));
      addTotalRow('Tax', this.formatMoney(0, input.currency));
      doc
        .moveTo(totalsX, y)
        .lineTo(right, y)
        .strokeColor('#E5E7EB')
        .lineWidth(1)
        .stroke();
      y += 10;
      addTotalRow(
        'Amount paid',
        this.formatMoney(input.amount, input.currency),
        true,
        '#111827',
      );

      y += 12;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6B7280')
        .text(`Payment method: ${input.paymentLabel}`, left, y);

      y += 36;
      doc
        .moveTo(left, y)
        .lineTo(right, y)
        .strokeColor('#E5E7EB')
        .lineWidth(1)
        .stroke();
      y += 16;

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#9CA3AF')
        .text(
          input.footerNote ||
            'Thank you for your business. This is a computer-generated invoice.',
          left,
          y,
          { width: right - left, align: 'center' },
        );

      doc.end();
    });
  }

  formatMoney(amount: number, currency = 'INR'): string {
    const value = Number(amount || 0).toFixed(2);
    if (currency === 'INR') {
      return `INR ${value}`;
    }
    return `${currency} ${value}`;
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private async loadLogo(logoUrl: string | null): Promise<Buffer | null> {
    if (!logoUrl) return null;

    try {
      if (logoUrl.startsWith('/uploads/')) {
        const relative = logoUrl.replace(/^\//, '');
        const candidates = [
          path.join(process.cwd(), relative),
          path.join(
            process.cwd(),
            'uploads',
            relative.replace(/^uploads[\\/]/, ''),
          ),
          path.join(__dirname, '..', '..', '..', relative),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            return fs.readFileSync(candidate);
          }
        }
        return null;
      }

      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        const response = await axios.get<ArrayBuffer>(logoUrl, {
          responseType: 'arraybuffer',
          timeout: 8000,
        });
        return Buffer.from(response.data);
      }
    } catch (err) {
      this.logger.warn(`Could not load invoice logo: ${String(err)}`);
    }

    return null;
  }
}
