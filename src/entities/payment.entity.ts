import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

export enum PaymentStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
}

@Entity('payment')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    tenantId: string | null;

    @Column({ type: 'uuid' })
    customerId: string;

    @ManyToOne(() => Customer)
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @Column({ type: 'varchar', unique: true })
    razorpayOrderId: string;

    @Column({ type: 'varchar', nullable: true })
    razorpayPaymentId: string;

    @Column({ type: 'varchar', nullable: true })
    razorpaySignature: string;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    status: PaymentStatus;

    @Column({ type: 'boolean', default: false })
    isBanned: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
