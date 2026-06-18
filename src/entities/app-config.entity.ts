import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface AppStyleVariables {
  headings?: {
    h1?: string;
    h2?: string;
    h3?: string;
  };
  text?: {
    p1?: string;
    p2?: string;
  };
  bgColor?: string;
  borders?: {
    color?: string;
    width?: string;
  };
  borderRadius?: string;
  buttonPrimary?: {
    backgroundColor?: string;
    color?: string;
    borderColor?: string;
  };
  buttonSecondary?: {
    backgroundColor?: string;
    color?: string;
    borderColor?: string;
  };
}

@Entity('app_configs')
export class AppConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  theme: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  primaryColor: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  secondaryColor: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  styleVariables: AppStyleVariables;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fontFamily: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
