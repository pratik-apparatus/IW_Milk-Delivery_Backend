import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  InvoiceBillToSnapshot,
  InvoiceIssuerSnapshot,
} from './subscription-invoice.entity';

export enum PlatformInvoiceStatus {
  PAID = 'PAID',
}

export interface PlatformInvoiceLineItem {
  description: string;
  planName: string;
  planDescription: string | null;
  durationDays: number;
  periodStart: string | null;
  periodEnd: string | null;
  amount: number;
}

@Entity('platform_invoices')
@Index(['invoiceNumber'], { unique: true })
@Index(['tenantId', 'razorpayPaymentId'], {
  unique: true,
  where: '"razorpayPaymentId" IS NOT NULL',
})
export class PlatformInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  tenantSubscriptionId: string;

  @Column({ type: 'uuid' })
  planId: string;

  @Column({ type: 'varchar', length: 40 })
  invoiceNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: PlatformInvoiceStatus.PAID,
  })
  status: PlatformInvoiceStatus;

  @Column({ type: 'timestamp' })
  issuedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  razorpayPaymentId: string | null;

  @Column({ type: 'varchar', nullable: true })
  razorpayOrderId: string | null;

  /** Dedup key for free / zero-amount activations (no Razorpay payment id). */
  @Column({ type: 'varchar', length: 80, nullable: true, unique: true })
  activationKey: string | null;

  @Column({ type: 'jsonb' })
  issuerSnapshot: InvoiceIssuerSnapshot;

  @Column({ type: 'jsonb' })
  billToSnapshot: InvoiceBillToSnapshot;

  @Column({ type: 'jsonb' })
  lineItemsSnapshot: PlatformInvoiceLineItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
