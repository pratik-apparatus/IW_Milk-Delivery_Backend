import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ManagedDatabaseStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
}

@Entity('managed_databases')
export class ManagedDatabase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  displayName: string | null;

  @Column({ type: 'varchar' })
  dbHost: string;

  @Column({ type: 'int' })
  dbPort: number;

  @Column({ type: 'varchar', unique: true })
  dbName: string;

  @Column({ type: 'varchar' })
  dbUser: string;

  @Column({ type: 'varchar' })
  dbPassword: string;

  @Column({
    type: 'enum',
    enum: ManagedDatabaseStatus,
    default: ManagedDatabaseStatus.AVAILABLE,
  })
  status: ManagedDatabaseStatus;

  @Column({ type: 'uuid', nullable: true, unique: true })
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
