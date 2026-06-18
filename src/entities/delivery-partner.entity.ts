import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('delivery_partners')
export class DeliveryPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ unique: true })
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isBanned: boolean;

  @Column({ type:'int',default:0})
  CurrentOrder: number;

  @Column({ nullable: true })
  vehicleNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fcmToken: string;

  @CreateDateColumn()
  createdAt: Date;
}
