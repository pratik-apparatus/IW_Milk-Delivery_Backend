import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SubscriptionInvoiceStatus {
  PAID = 'PAID',
}

export enum SubscriptionInvoicePaymentMethod {
  WALLET = 'WALLET',
}

export interface InvoiceIssuerSnapshot {
  businessName: string;
  logoUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
}

export interface InvoiceBillToSnapshot {
  name: string;
  phone: string;
  address: string | null;
  email?: string | null;
}

export interface SubscriptionInvoiceLineItem {
  description: string;
  productName: string;
  planType: string;
  selectedDays: string[] | null;
  startDate: string | null;
  endDate: string | null;
  quantity: number;
  totalDeliveries: number;
  unitPrice: number;
  amount: number;
}

@Entity('subscription_invoices')
@Index(['tenantId', 'invoiceNumber'], { unique: true })
@Index(['tenantId', 'subscriptionId'], { unique: true })
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 40 })
  invoiceNumber: string;

  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: SubscriptionInvoiceStatus.PAID,
  })
  status: SubscriptionInvoiceStatus;

  @Column({ type: 'timestamp' })
  issuedAt: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: SubscriptionInvoicePaymentMethod.WALLET,
  })
  paymentMethod: SubscriptionInvoicePaymentMethod;

  @Column({ type: 'jsonb' })
  issuerSnapshot: InvoiceIssuerSnapshot;

  @Column({ type: 'jsonb' })
  billToSnapshot: InvoiceBillToSnapshot;

  @Column({ type: 'jsonb' })
  lineItemsSnapshot: SubscriptionInvoiceLineItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
