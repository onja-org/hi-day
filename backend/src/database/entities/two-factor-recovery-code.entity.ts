import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A one-time code for signing in without the authenticator app (a lost
 * phone). Handed out in a set when two-step login is turned on or the set
 * is renewed; each works once. Only the hash is stored, like every other
 * token here.
 */
@Entity({ name: 'two_factor_recovery_codes' })
export class TwoFactorRecoveryCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index({ unique: true })
  codeHash: string;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
