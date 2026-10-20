import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organisation } from './organisation.entity';
import { SubscriptionStatus } from './subscription-status.enum';

/**
 * An Organisation's billing state. Created with the Organisation itself,
 * always starting a 14-day trial — signup asks for no card, so there is
 * nothing else it could start as. Organisations that predate trials have no
 * row at all: that absence is how "never trialled" is spelled.
 */
@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index({ unique: true })
  organisationId: string;

  @OneToOne(() => Organisation, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    enumName: 'SubscriptionStatus',
    default: SubscriptionStatus.TRIALING,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', precision: 3 })
  trialStartedAt: Date;

  /** Stored rather than derived, so a trial can be extended by hand. */
  @Column({ type: 'timestamp', precision: 3 })
  trialEndsAt: Date;

  /**
   * The lowest reminder milestone already emailed, in days left; null until
   * the first one. Keeping the milestone rather than a flag per email lets
   * the list grow without a migration and makes the hourly job idempotent.
   */
  @Column({ type: 'integer', nullable: true })
  trialReminderSentAtDaysLeft: number | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
