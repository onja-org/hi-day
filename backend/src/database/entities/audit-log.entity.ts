import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';
import { User } from './user.entity';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  organisationId: string | null;

  @ManyToOne(() => Organisation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorUserId' })
  actorUser: User | null;
}
