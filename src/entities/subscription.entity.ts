import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Product } from './product.entity';
import { DeliveryPartner } from './delivery-partner.entity';
import { SubscriptionDeliveryLog } from './subscription-delivery-log.entity';
import { Order } from './order.entity';

export enum PlanType {
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
}

export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    CANCELLED = 'CANCELLED',
    DELIVERED = 'DELIVERED',
}

@Entity('subscription')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    tenantId: string | null;

    @Column({ type: 'uuid' })
    customerId: string;

    @ManyToOne(() => Customer)
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @Column({ type: 'uuid' })
    productId: string;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({
        type: 'enum',
        enum: PlanType,
    })
    planType: PlanType;

    @Column({ type: 'int', nullable: true, comment: 'For NTH_DAY plan type' })
    nthDay: number | null;

    @Column({ type: 'text' })
    addressSnapshot: string;

    @Column({ type: 'varchar' })
    phoneSnapshot: string;

    @Column({
        type: 'varchar',
        length: 20,
        default: SubscriptionStatus.ACTIVE,
    })
    status: SubscriptionStatus;

    @Column({ type: 'date', nullable: true })
    nextDeliveryDate: Date | null;

    @Column({ type: 'date', nullable: true })
    startDate: Date | null;

    @Column({ type: 'date', nullable: true })
    endDate: Date | null;

    @Column({ type: 'json', nullable: true, comment: 'Selected days for WEEKLY plan, e.g. ["Mon","Wed","Fri"]' })
    selectedDays: string[] | null;

    @Column({ type: 'varchar', nullable: true, comment: 'Skip pattern for alternate days, e.g. "alternate"' })
    skipPattern: string | null;

    @Column({ type: 'int', default: 1, comment: 'Quantity per delivery' })
    quantity: number;

    @Column({ type: 'int', nullable: true, comment: 'Total number of deliveries calculated' })
    totalDeliveries: number | null;

    @Column({ type: 'int', nullable: true, comment: 'Remaining deliveries (calculated on read)' })
    remainingDeliveries: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Total amount calculated: product.price × totalDeliveries × quantity' })
    totalAmount: number | null;

    @Column({ type: 'boolean', default: false })
    isBanned: boolean;

    @Column({ type: 'uuid', nullable: true })
    deliveryPartnerId: string | null;

    @ManyToOne(() => DeliveryPartner)
    @JoinColumn({ name: 'deliveryPartnerId' })
    deliveryPartner: DeliveryPartner;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => SubscriptionDeliveryLog, (log) => log.subscription)
    deliveryLogs: SubscriptionDeliveryLog[];

    @OneToMany(() => Order, (order) => (order as any).subscription)
    orders: any[];
}
