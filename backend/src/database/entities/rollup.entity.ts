import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';
import { Project } from './project.entity';
import { RollupPeriodType } from './rollup-period-type.enum';

/**
 * A pre-summarised (member, project, day) worked-seconds bucket — what
 * dashboards and reports read instead of scanning raw `TimeEntry` rows on
 * every request. Always derived, never a source of truth: `RollupService`
 * recomputes a row (unconditional upsert, never a partial update) any time
 * a mutation could have changed it, so a row is either fully correct or
 * absent, never half-updated.
 *
 * Deliberately doesn't carry activity-level (from `ActivitySample`) —
 * that entity has no `projectId` at all (see its own doc comment: a
 * sample is attributed to a Membership+Device, not a project), so it
 * can't honestly be summarised at this table's per-project grain. It's
 * still computed live from raw samples (unchanged), which is fine: the
 * expensive part of the old query was pause-netting `TimeEntry` rows
 * across a week, not this small, already-indexed sample scan. A
 * membership-only activity rollup is a separate, later addition if it
 * ever needs one.
 *
 * FKs are `CASCADE`, deliberately unlike `TimeEntry`'s `RESTRICT` — a
 * rollup row has no standalone meaning once what it summarises is gone,
 * where `TimeEntry` itself is protected because it's payroll-relevant
 * history.
 */
@Entity({ name: 'rollups' })
@Unique('UQ_rollups_membership_project_period', [
  'membershipId',
  'projectId',
  'periodType',
  'periodStart',
])
export class Rollup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column()
  @Index()
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  @Column()
  @Index()
  projectId: string;

  @ManyToOne(() => Project, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({
    type: 'enum',
    enum: RollupPeriodType,
    enumName: 'RollupPeriodType',
  })
  periodType: RollupPeriodType;

  /** Start instant of the bucket (e.g. local midnight for a `DAY` row). */
  @Column({ type: 'timestamptz', precision: 3 })
  periodStart: Date;

  /** Net of pause spans — same `activeSeconds()` formula the live timer
   * and dashboard use, applied to a completed day. */
  @Column({ type: 'int', default: 0 })
  workedSeconds: number;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
