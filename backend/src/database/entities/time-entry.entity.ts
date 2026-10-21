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

  /**
   * True when this entry was closed by the abandoned-timer sweeper rather
   * than by anyone stopping it — the server giving up on a client it had
   * not heard from, and dating the end at the last heartbeat because that
   * is the last moment it knows the person was there.
   *
   * It is a guess, and it exists to be overruled. A Device that was simply
   * offline kept working past that point, and when it reconnects and
   * reports the real stop the entry is extended to it (see
   * `TimeEntriesService.stop`) — otherwise every offline stretch longer
   * than the 30-minute grace would be silently truncated to its first
   * half hour. Never set on an entry a person actually stopped, so a real
   * stop can never be reopened this way.
   */
  @Column({ type: 'boolean', default: false })
  closedAsAbandoned: boolean;

  /**
   * The agent's own id for the start that created this entry, and for the
   * stop that ended it — echoed back so a replay can be recognised rather
   * than acted on twice. A device that was offline replays queued starts
   * and stops on reconnect, and a connection that drops after the server
   * committed but before the agent read the response leaves it unable to
   * tell "accepted" from "never arrived"; without these it would send
   * again, and hours would be duplicated onto a payslip. Null for the web
   * and for any agent too old to send one.
   *
   * Two columns, not one: an entry is closed by a different operation from
   * the one that opened it, and either can be the one replayed.
   */
  @Column({ type: 'uuid', nullable: true })
  startOperationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  stopOperationId: string | null;

  /**
   * The last moment the client holding this running entry was heard from.
   * Only set for a web timer, which has no Device to heartbeat for it: the
   * browser's poll of `/time-entries/current` stamps it, and the hourly
   * closer ends an entry whose stamp has gone stale. A Device's entry reads
   * `Device.lastSeenAt` instead.
   */
  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 3 })
  updatedAt: Date;
}
