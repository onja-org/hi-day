import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { AllowedApps } from '../../organisations/allowed-apps';
import type { AppUrlTracking } from '../../organisations/app-url-tracking';
import type { TimesheetModifyTime } from '../../organisations/timesheet-settings';
import { MembershipRole } from './membership-role.enum';
import { MembershipStatus } from './membership-status.enum';
import { Organisation } from './organisation.entity';
import { ProjectMembership } from './project-membership.entity';
import { TeamMembership } from './team-membership.entity';
import { User } from './user.entity';

@Entity({ name: 'memberships' })
@Unique(['userId', 'organisationId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MembershipRole, enumName: 'MembershipRole' })
  role: MembershipRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    enumName: 'MembershipStatus',
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;

  @Column({ type: 'timestamp', precision: 3, nullable: true })
  deactivatedAt: Date | null;

  /**
   * The jurisdiction used to resolve which DisclosureVersion applies to
   * this person (see docs/adr/0014-... and CONTEXT.md's Disclosure region
   * entry) — admin-set only, not self-reported at signup. `null` means the
   * org's region-less default disclosure text applies. Deliberately not
   * named `region` — see `Organisation.region`'s own comment for the
   * unrelated, infrastructure-level concept that word already means here.
   */
  @Column({ type: 'character varying', nullable: true })
  disclosureRegion: string | null;

  /**
   * Per-member override of the Organisation's "Track apps & URLs" default.
   * `null` means inherit the org default (see
   * `Organisation.settings.appUrlTracking`).
   */
  @Column({ type: 'character varying', nullable: true })
  appUrlTracking: AppUrlTracking | null;

  /** `null` inherits (see `Organisation.settings.allowedApps`). */
  @Column({ type: 'character varying', nullable: true })
  allowedApps: AllowedApps | null;

  /** Per-member work time limits; each inherits the Organisation's when
   * null, independently of the others. */
  @Column({ type: 'jsonb', nullable: true })
  expectedWorkDays: number[] | null;

  @Column({ type: 'jsonb', nullable: true })
  trackingDisabledDays: number[] | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  expectedWeeklyHours: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  weeklyLimitHours: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  dailyLimitHours: string | null;
  /** Whether this member may delete their own screenshots; `null`
   * inherits the Organisation's setting. */
  @Column({ type: 'boolean', nullable: true })
  canDeleteScreenshots: boolean | null;

  /** Per-member screenshot frequency. `null` inherits the Organisation's;
   * `0` is "None", no screenshots for this member at all. */
  @Column({ type: 'integer', nullable: true })
  screenshotFrequencySeconds: number | null;

  /**
   * Per-member override of the Organisation's "Modify time (manual time)"
   * default. `null` inherits (see `Organisation.settings.timesheetModifyTime`).
   */
  @Column({ type: 'character varying', nullable: true })
  timesheetModifyTime: TimesheetModifyTime | null;

  /**
   * Per-member override of whether manual entries/edits require approval.
   * `null` inherits (see `Organisation.settings.timesheetRequireApproval`).
   */
  @Column({ type: 'boolean', nullable: true })
  timesheetRequireApproval: boolean | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.memberships, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, (organisation) => organisation.memberships, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @OneToMany(
    () => ProjectMembership,
    (projectMembership) => projectMembership.membership,
  )
  projectMemberships: ProjectMembership[];

  @OneToMany(
    () => TeamMembership,
    (teamMembership) => teamMembership.membership,
  )
  teamMemberships: TeamMembership[];
}
