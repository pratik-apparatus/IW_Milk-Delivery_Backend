import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProvisioningJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  FAILED = 'FAILED',
  DONE = 'DONE',
}

@Entity('tenant_provisioning_jobs')
export class TenantProvisioningJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({
    type: 'enum',
    enum: ProvisioningJobStatus,
    default: ProvisioningJobStatus.PENDING,
  })
  status: ProvisioningJobStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  steps: string[];

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
