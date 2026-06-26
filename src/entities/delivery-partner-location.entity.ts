import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { DeliveryPartner } from './delivery-partner.entity';

@Entity('delivery_partner_locations')
@Index(['orderId', 'createdAt'])
@Index(['deliveryPartnerId', 'createdAt'])
export class DeliveryPartnerLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'delivery_partner_id' })
  deliveryPartnerId: string;

  @Column('decimal', { precision: 10, scale: 8 })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8 })
  longitude: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @ManyToOne(() => DeliveryPartner)
  @JoinColumn({ name: 'delivery_partner_id' })
  deliveryPartner?: DeliveryPartner;
}
