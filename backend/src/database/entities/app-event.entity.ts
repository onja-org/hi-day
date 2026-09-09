import {
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
 * A single foreground-app/window sample from the desktop agent's window
 * tracking (see docs/adr/0010-...) — one row per ~5s tick, batched and
 * POSTed by the agent rather than sent one at a time (see
 * docs/TECH_DESIGN.md §4). Attributed to the Membership that was signed in
 * on the Device at sample time, same as `TimeEntry.membershipId` — never
 * derived from `Device`'s own columns (a shared machine's Device reflects
 * whoever logged in *last*; see CONTEXT.md's Device entry).
 *
 * There's no raw-event read API for browsing individual rows — only the
 * aggregated "time spent per app" summary (`AppEventsService`). Rows are
 * write-once from the agent; nothing ever updates one after insert.
 */
@Entity({ name: 'app_events' })
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

  @Column({ type: 'timestamptz', precision: 3 })
  sampledAt: Date;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
