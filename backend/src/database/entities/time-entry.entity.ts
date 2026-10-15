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
import { Device } from './device.entity';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';
import { Project } from './project.entity';
import { Task } from './task.entity';
import { TimeEntrySource } from './time-entry-source.enum';
import { TimeEntryType } from './time-entry-type.enum';

/**
 * A single start/stop timer run, attributed to the org Membership it
 * belongs to — never `ProjectMembership` (that's `SET NULL` on removal,
 * fine for a Task assignee, destructive here since it would erase whose
 * hours these were). `endedAt IS NULL` means the timer is currently
 * running; the database enforces at most one such row per Membership (see
 * the partial unique index in the migration that creates this table) so
 * "one active timer per person" is structural, not just app-enforced.
 *
 * `startedAt`/`endedAt` are `timestamptz`, unlike this codebase's usual
 * `timestamp` (no time zone) columns — a deliberate divergence, since these
 * two are the ones the epic requires to be an unambiguous instant (payroll
 * and reporting read them), where the rest of the schema's `timestamp`
 * columns are just audit noise (createdAt/updatedAt).
 */
@Entity({ name: 'time_entries' })
export class TimeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organisationId: string;

  @ManyToOne(() => Organisation, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column()
  @Index()
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  /** `null` when the Organisation doesn't track time against Projects. */
  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @ManyToOne(() => Task, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'taskId' })
  task: Task | null;

  @Column({ type: 'timestamptz', precision: 3 })
  startedAt: Date;

  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  endedAt: Date | null;

  @Column({ type: 'enum', enum: TimeEntrySource, enumName: 'TimeEntrySource' })
  source: TimeEntrySource;

  /**
   * What kind of time this is — see `TimeEntryType`. Separate from `source`:
   * an entry tracked by the agent can still be idle or resumed, and the two
   * answer different questions.
   */
  @Column({
    type: 'enum',
    enum: TimeEntryType,
    enumName: 'TimeEntryType',
    default: TimeEntryType.NORMAL,
  })
  type: TimeEntryType;

  @Column({ type: 'uuid', nullable: true })
  deviceId: string | null;

  @ManyToOne(() => Device, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'deviceId' })
  device: Device | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
