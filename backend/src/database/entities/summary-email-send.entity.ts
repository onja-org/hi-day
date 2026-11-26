import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { SummaryEmailKind } from '../../organisations/summary-emails';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';

/**
 * One summary email for one person and one period. The sender claims the
 * row *before* building the email — the unique key is what stops a second
 * backend instance, or an overlapping run, from sending the same summary
 * twice. A failed send keeps its row (with `error`) and is not retried, so a
 * broken mailbox costs one attempt a period rather than one every tick.
 */
@Entity({ name: 'summary_email_sends' })
@Index(
  'UQ_summary_email_sends_membership_kind_period',
  ['membershipId', 'kind', 'periodStart'],
  { unique: true },
)
export class SummaryEmailSend {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'organisationId',
    foreignKeyConstraintName: 'FK_summary_email_sends_organisationId',
  })
  organisation: Organisation;

  @Column()
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'membershipId',
    foreignKeyConstraintName: 'FK_summary_email_sends_membershipId',
  })
  membership: Membership;

  @Column({ type: 'varchar', length: 20 })
  kind: SummaryEmailKind;

  /** First day the summary covers, YYYY-MM-DD in the Organisation's zone. */
  @Column({ type: 'varchar', length: 10 })
  periodStart: string;

  /** Set once the mail provider accepted it. */
  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /** Why it was not sent — including "nothing to report". */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
