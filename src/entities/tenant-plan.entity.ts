import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenant_plans')
export class TenantPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Monthly charge in INR (super admin configurable). */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  /** How many days the subscription stays active after payment. */
  @Column({ type: 'int', default: 30 })
  durationDays: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
