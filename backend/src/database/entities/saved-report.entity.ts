import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';

/** What opening a saved report restores — see the frontend's SavedReportSettings. */
export interface SavedReportSettings {
  datePreset: string | null;
  days: { from: string; to: string };
  scope: 'me' | 'all';
  grouping: string;
  filters: { memberIds: string[]; teamIds: string[]; projectIds: string[] };
}

/** When and to whom a saved report is emailed. */
export interface ReportScheduleSettings {
  emails: string[];
  message: string;
  fileType: 'pdf' | 'csv';
  dateRange: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  /** Hour of day to deliver in the organisation's timezone, 0–23. */
  hour: number;
  /** Weekdays to deliver on, 0 = Sunday … 6 = Saturday. */
  days: number[];
}

/**
 * A report a member saved from the Time and activity page, owned by that
 * member alone ("saved to your account only"). Optionally scheduled, in
 * which case the scheduler emails it on the `schedule` and records the
 * outcome in the `lastSent*` columns.
 */
@Index('IDX_saved_reports_scheduled', ['id'], {
  where: '"schedule" IS NOT NULL',
})
@Entity({ name: 'saved_reports' })
@Index('IDX_saved_reports_organisationId_membershipId', [
  'organisationId',
  'membershipId',
])
export class SavedReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'organisationId',
    foreignKeyConstraintName: 'FK_saved_reports_organisationId',
  })
  organisation: Organisation;

  @Column()
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'membershipId',
    foreignKeyConstraintName: 'FK_saved_reports_membershipId',
  })
  membership: Membership;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, default: 'time-and-activity' })
  reportType: string;

  @Column({ type: 'jsonb' })
  settings: SavedReportSettings;

  @Column({ type: 'jsonb', nullable: true })
  schedule: ReportScheduleSettings | null;

  /**
   * Local (organisation-timezone) calendar day of the last scheduled send,
   * YYYY-MM-DD. The scheduler claims a day by writing this first, so two
   * instances — or a retry in the same hour — can't both send.
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  lastSentOn: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  /** Why the last scheduled send failed; cleared by the next success. */
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
