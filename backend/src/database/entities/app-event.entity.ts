import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppEventTitleUnavailableReason } from './app-event-title-unavailable-reason.enum';
import { Device } from './device.entity';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';

/**
 * A run of identical foreground-app/window samples from the desktop agent's
 * window tracking (see docs/adr/0010-...): `sampleCount` consecutive ~5s
 * ticks starting at `sampledAt` (older agents send one row per tick — a run
 * of one; see common/app-event-samples.util.ts), batched and
 * POSTed by the agent rather than sent one at a time (see
 * docs/TECH_DESIGN.md §4). Attributed to the Membership that was signed in
 * on the Device at sample time, same as `TimeEntry.membershipId` — never
 * derived from `Device`'s own columns (a shared machine's Device reflects
 * whoever logged in *last*; see CONTEXT.md's Device entry).
 *
 * There's no raw-event read API for browsing individual rows — only the
 * aggregated "time spent per app" summary (`AppEventsService`). Rows are
 * write-once from the agent; nothing ever updates one after insert. (When a
 * Time entry shrinks, `CaptureCleanupService` may replace a run with the
 * pieces of it that are still covered — delete and re-insert, not update.)
 */
@Entity({ name: 'app_events' })
@Check('CHK_app_events_sampleCount_positive', '"sampleCount" >= 1')
@Index(['membershipId', 'sampledAt'])
export class AppEvent {
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
  membershipId: string;

  @ManyToOne(() => Membership, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'membershipId' })
  membership: Membership;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @Column()
  appName: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({
    type: 'enum',
    enum: AppEventTitleUnavailableReason,
    enumName: 'AppEventTitleUnavailableReason',
    nullable: true,
  })
  titleUnavailableReason: AppEventTitleUnavailableReason | null;

  /** When the run's first sample was taken. */
  @Column({ type: 'timestamptz', precision: 3 })
  sampledAt: Date;

  /**
   * How many consecutive samples this row stands for, each
   * `APP_EVENT_SAMPLE_SECONDS` after the last. Read it only through
   * `expandAppEventSamples` / `appEventSamplesJoinSql`, never as a row count.
   */
  @Column({ type: 'integer', default: 1 })
  sampleCount: number;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
