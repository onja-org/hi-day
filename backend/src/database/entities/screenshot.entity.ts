import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { Membership } from './membership.entity';
import { Organisation } from './organisation.entity';

/**
 * A single screenshot captured by the desktop agent (see docs/adr/0012-...)
 * — metadata only, same "direct-to-storage" split as AppEvent: the image
 * bytes go straight from the agent to Wasabi (S3-compatible object
 * storage) via a presigned URL, and only the resulting `storageKey` ever
 * reaches this table (see docs/TECH_DESIGN.md §4's "Direct-to-storage
 * screenshots" and §1's "Screenshots bypass the API and upload directly to
 * object storage"). Attributed to the Membership that was signed in on the
 * Device at capture time, same rule as AppEvent/TimeEntry — never derived
 * from `Device`'s own columns (see CONTEXT.md's Device entry).
 *
 * `keptUntil` is computed once, at insert time, from the organisation's
 * `screenshotRetentionDays` setting *as it stood at capture time* — not
 * re-derived from the org's current setting on every cleanup pass. A
 * retention change therefore only affects screenshots captured after the
 * change, not existing ones (see docs/adr/0012-...). The retention cleanup
 * job (`ScreenshotsService.deleteExpired`) queries this column directly
 * rather than joining `organisations.settings`, keeping that query a
 * single indexed scan.
 *
 * No raw-event read API for browsing every organisation's screenshots —
 * only per-Membership listings (`ScreenshotsService.getMyScreenshots`/
 * `getScreenshotsForMembership`), same visibility rule as AppEvent/
 * Activity. Rows are write-once from the agent; nothing ever updates one
 * after insert.
 */
@Entity({ name: 'screenshots' })
@Index(['membershipId', 'capturedAt'])
@Index(['keptUntil'])
export class Screenshot {
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

  /** Object key inside the Wasabi bucket — never a full URL. */
  @Column()
  storageKey: string;

  @Column({ type: 'timestamptz', precision: 3 })
  capturedAt: Date;

  @Column({ type: 'timestamptz', precision: 3 })
  keptUntil: Date;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;
}
