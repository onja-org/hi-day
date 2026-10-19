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
 * An Organisation's billing state. Created in the same transaction as the
 * Organisation itself, always starting a 14-day trial — signup asks for no
 * card, so there is nothing else it could start as.
 *
 * Organisations that existed before trials did have no row at all, which is
 * how "never been on a trial" is spelled: a missing row, not a null date.
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

  /**
   * Stored rather than derived from `trialStartedAt`, so a trial can be
   * extended by hand without the 14-day constant having to lie.
   */
  @Column({ type: 'timestamp', precision: 3 })
  trialEndsAt: Date;

  /**
   * The lowest reminder milestone already emailed, in days left (so `3`
   * means the three-days-out email went out, `0` the last-day one). Null
   * until the first reminder. Keeping the milestone rather than a flag per
   * email means the milestone list can grow without a migration, and makes
   * the hourly job idempotent if it runs twice or restarts mid-sweep.
   */
  @Column({ type: 'integer', nullable: true })
  trialReminderSentAtDaysLeft: number | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
