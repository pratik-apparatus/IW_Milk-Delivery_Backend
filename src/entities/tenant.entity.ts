import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  businessName: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  subdomain: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar' })
  adminEmail: string;

  @Column({ type: 'varchar', nullable: true })
  supportEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  supportPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  adminAddress: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  adminLatitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  adminLongitude: number | null;

  /** Delivery service area radius from admin location, in kilometers. */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  deliveryRadiusKm: number | null;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.INACTIVE,
  })
  status: TenantStatus;

  @Column({ type: 'varchar', nullable: true })
  dbHost: string | null;

  @Column({ type: 'int', nullable: true })
  dbPort: number | null;

  @Column({ type: 'varchar', nullable: true })
  dbName: string | null;

  @Column({ type: 'varchar', nullable: true })
  dbUser: string | null;

  @Column({ type: 'varchar', nullable: true })
  dbPassword: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  enabledApps: string[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  appSettings: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  integrationConfig: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
